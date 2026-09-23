import * as THREE from 'three';

export interface RendererManagerOptions {
  canvas?: HTMLCanvasElement;
  container?: HTMLElement;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'high-performance' | 'default' | 'low-power';
  maxDpr?: number;
  maxDeltaTime?: number;
}

export type RenderCallback = (dt: number, time: number) => void;
export type ResizeCallback = (width: number, height: number, aspect: number) => void;

export class RendererManager {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly canvas: HTMLCanvasElement;
  public readonly container: HTMLElement;

  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private maxDeltaTime: number;
  private maxDpr: number;

  private width: number = 0;
  private height: number = 0;
  private aspect: number = 1;
  private dpr: number = 1;

  private renderCallbacks: Set<RenderCallback> = new Set();
  private resizeCallbacks: Set<ResizeCallback> = new Set();
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: RendererManagerOptions = {}) {
    this.maxDpr = options.maxDpr ?? 2.0;
    this.maxDeltaTime = options.maxDeltaTime ?? 0.1;

    // Resolve or create container element
    if (options.container) {
      this.container = options.container;
    } else if (typeof document !== 'undefined') {
      this.container = document.body;
    } else {
      this.container = {} as HTMLElement;
    }

    // Resolve or create canvas element
    if (options.canvas) {
      this.canvas = options.canvas;
    } else if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'anima-canvas';
      this.canvas.style.display = 'block';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.outline = 'none';
      if (this.container.appendChild) {
        this.container.appendChild(this.canvas);
      }
    } else {
      this.canvas = {} as HTMLCanvasElement;
    }

    // Request WebGL2 context explicitly
    let glContext: WebGL2RenderingContext | null = null;
    if (this.canvas.getContext) {
      glContext = this.canvas.getContext('webgl2', {
        antialias: options.antialias ?? true,
        alpha: options.alpha ?? false,
        powerPreference: options.powerPreference ?? 'high-performance',
      });
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: glContext ?? undefined,
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false,
      powerPreference: options.powerPreference ?? 'high-performance',
      stencil: false,
      depth: true,
    });

    // Configure renderer color space and defaults
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // Handled in post-processing pipeline

    this.initDimensions();
    this.setupResizeListeners();
  }

  private initDimensions(): void {
    const parent = this.container;
    const w = parent.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const h = parent.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1080);
    this.dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, this.maxDpr);

    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.aspect = this.width / this.height;

    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
  }

  private setupResizeListeners(): void {
    if (typeof window === 'undefined') return;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    if (typeof ResizeObserver !== 'undefined' && this.container instanceof HTMLElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  public handleResize(): void {
    const parent = this.container;
    const w = parent.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const h = parent.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 1080);
    this.dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, this.maxDpr);

    if (w === this.width && h === this.height) {
      return;
    }

    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.aspect = this.width / this.height;

    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);

    for (const callback of this.resizeCallbacks) {
      callback(this.width, this.height, this.aspect);
    }
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.aspect = this.width / this.height;
    this.dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, this.maxDpr);

    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);

    for (const callback of this.resizeCallbacks) {
      callback(this.width, this.height, this.aspect);
    }
  }

  public onResize(callback: ResizeCallback): () => void {
    this.resizeCallbacks.add(callback);
    return () => this.resizeCallbacks.delete(callback);
  }

  public onRender(callback: RenderCallback): () => void {
    this.renderCallbacks.add(callback);
    return () => this.renderCallbacks.delete(callback);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick = this.tick.bind(this);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    const rawDelta = (now - this.lastTime) * 0.001;
    this.lastTime = now;

    // Clamp delta time to prevent physics/shader explosions on background tabs
    const dt = Math.min(Math.max(rawDelta, 0.0001), this.maxDeltaTime);
    const time = now * 0.001;

    for (const callback of this.renderCallbacks) {
      callback(dt, time);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public async toggleFullscreen(targetElement?: HTMLElement): Promise<void> {
    if (typeof document === 'undefined') return;

    const elem = targetElement ?? this.container ?? document.documentElement;

    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
    this.handleResize();
  }

  public isFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.fullscreenElement;
  }

  public getWidth(): number {
    return this.width;
  }

  public getHeight(): number {
    return this.height;
  }

  public getAspect(): number {
    return this.aspect;
  }

  public getPixelRatio(): number {
    return this.dpr;
  }

  public dispose(): void {
    this.stop();
    this.renderCallbacks.clear();
    this.resizeCallbacks.clear();

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.renderer.dispose();
  }
}
