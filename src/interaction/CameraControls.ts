import * as THREE from 'three';
import { PresetConfig } from '../types';

export type CameraMode = 'orbit' | 'free_glide';

export interface CameraTransitionOptions {
  position?: THREE.Vector3;
  target?: THREE.Vector3;
  fov?: number;
  duration?: number;
  easing?: (t: number) => number;
  onComplete?: () => void;
}

export interface CameraControlsConfig {
  mode?: CameraMode;
  moveSpeed?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  dampingFactor?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  fov?: number;
  organicSway?: boolean;
}

/**
 * Cinematic Dual-Mode Organic Camera Controller for ANIMA.
 * Supports:
 * - Orbit Mode: Celestial rotation around a focal attractor with spherical inertia.
 * - Free Glide (6-DOF): Viscous, deep-sea abyss drifting with hydrodynamic drag,
 *   banking roll, and subtle buoyant micro-current undulation.
 * - Cinematic Transitions: Lerp / Slerp camera paths between presets and points of interest.
 *
 * Designed for zero per-frame garbage collection.
 */
export class CameraControls {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public enabled: boolean = true;

  // Mode & configuration
  private mode: CameraMode = 'orbit';
  public moveSpeed: number = 18.0;
  public rotateSpeed: number = 0.0035;
  public zoomSpeed: number = 1.25;
  public dampingFactor: number = 0.08;
  public minDistance: number = 0.8;
  public maxDistance: number = 250.0;
  public minPolarAngle: number = 0.01;
  public maxPolarAngle: number = Math.PI - 0.01;
  public organicSway: boolean = true;

  // Orbit state
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private spherical: THREE.Spherical = new THREE.Spherical(20, Math.PI * 0.45, Math.PI * 0.25);
  private sphericalTarget: THREE.Spherical = new THREE.Spherical(20, Math.PI * 0.45, Math.PI * 0.25);
  private sphericalVelocity: THREE.Spherical = new THREE.Spherical(0, 0, 0);
  private panOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Free glide state (viscous deep-sea movement)
  private glideVelocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private glideEuler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private lookVelocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  private targetLookVelocity: THREE.Vector2 = new THREE.Vector2(0, 0);
  private fluidDrag: number = 0.92;
  private bankAngle: number = 0;
  private swayClock: number = 0;

  // Key tracking
  private keys: Record<string, boolean> = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    KeyE: false,
    KeyQ: false,
    Space: false,
    ShiftLeft: false,
    ShiftRight: false,
    ControlLeft: false,
  };

  // Pointer tracking
  private isPointerDown: boolean = false;
  private pointerButton: number = -1;
  private previousPointerX: number = 0;
  private previousPointerY: number = 0;
  private pointerDeltaX: number = 0;
  private pointerDeltaY: number = 0;
  private touchDistance: number = 0;

  // Cinematic preset transition state
  private isTransitioning: boolean = false;
  private transitionTime: number = 0;
  private transitionDuration: number = 1.8;
  private transitionStartPosition: THREE.Vector3 = new THREE.Vector3();
  private transitionEndPosition: THREE.Vector3 = new THREE.Vector3();
  private transitionStartTarget: THREE.Vector3 = new THREE.Vector3();
  private transitionEndTarget: THREE.Vector3 = new THREE.Vector3();
  private transitionStartQuat: THREE.Quaternion = new THREE.Quaternion();
  private transitionEndQuat: THREE.Quaternion = new THREE.Quaternion();
  private transitionStartFov: number = 60;
  private transitionEndFov: number = 60;
  private transitionEasing: (t: number) => number = CameraControls.smoothStep;
  private transitionCallback: (() => void) | null = null;

  // Preallocated scratch objects for zero GC per frame
  private _scratchV1: THREE.Vector3 = new THREE.Vector3();
  private _scratchV2: THREE.Vector3 = new THREE.Vector3();
  private _scratchV3: THREE.Vector3 = new THREE.Vector3();
  private _scratchQ1: THREE.Quaternion = new THREE.Quaternion();
  private _scratchM1: THREE.Matrix4 = new THREE.Matrix4();

  // Bound event handlers
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnContextMenu: (e: Event) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchStart: (e: TouchEvent) => void;

  public constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    config: CameraControlsConfig = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;

    if (config.mode !== undefined) this.mode = config.mode;
    if (config.moveSpeed !== undefined) this.moveSpeed = config.moveSpeed;
    if (config.rotateSpeed !== undefined) this.rotateSpeed = config.rotateSpeed;
    if (config.zoomSpeed !== undefined) this.zoomSpeed = config.zoomSpeed;
    if (config.dampingFactor !== undefined) this.dampingFactor = config.dampingFactor;
    if (config.minDistance !== undefined) this.minDistance = config.minDistance;
    if (config.maxDistance !== undefined) this.maxDistance = config.maxDistance;
    if (config.minPolarAngle !== undefined) this.minPolarAngle = config.minPolarAngle;
    if (config.maxPolarAngle !== undefined) this.maxPolarAngle = config.maxPolarAngle;
    if (config.organicSway !== undefined) this.organicSway = config.organicSway;
    if (config.fov !== undefined) this.camera.fov = config.fov;

    // Initialize spherical coords from initial camera position
    this._scratchV1.copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(this._scratchV1);
    this.sphericalTarget.copy(this.spherical);
    this.glideEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    // Bind listeners
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnContextMenu = this.onContextMenu.bind(this);
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    this.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    window.addEventListener('pointercancel', this.boundOnPointerUp);
    this.domElement.addEventListener('wheel', this.boundOnWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.boundOnContextMenu);
    this.domElement.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });

    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);
  }

  public dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('pointercancel', this.boundOnPointerUp);
    this.domElement.removeEventListener('wheel', this.boundOnWheel);
    this.domElement.removeEventListener('contextmenu', this.boundOnContextMenu);
    this.domElement.removeEventListener('touchstart', this.boundOnTouchStart);
    this.domElement.removeEventListener('touchmove', this.boundOnTouchMove);

    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);
  }

  // -------------------------------------------------------------
  // Mode & Transition Control
  // -------------------------------------------------------------

  public getMode(): CameraMode {
    return this.mode;
  }

  public setMode(mode: CameraMode): void {
    if (this.mode === mode) return;
    this.mode = mode;

    if (mode === 'orbit') {
      // Re-orient spherical coords around current target
      this._scratchV1.copy(this.camera.position).sub(this.target);
      this.spherical.setFromVector3(this._scratchV1);
      this.sphericalTarget.copy(this.spherical);
      this.sphericalVelocity.set(0, 0, 0);
    } else {
      // Switch to free glide: sync glide euler with current camera orientation
      this.glideEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.glideVelocity.set(0, 0, 0);
      this.lookVelocity.set(0, 0);
    }
  }

  public toggleMode(): CameraMode {
    const nextMode = this.mode === 'orbit' ? 'free_glide' : 'orbit';
    this.setMode(nextMode);
    return nextMode;
  }

  public setTarget(target: THREE.Vector3, immediate: boolean = false): void {
    this.target.copy(target);
    if (immediate) {
      this._scratchV1.copy(this.camera.position).sub(this.target);
      this.spherical.setFromVector3(this._scratchV1);
      this.sphericalTarget.copy(this.spherical);
      this.sphericalVelocity.set(0, 0, 0);
      this.panOffset.set(0, 0, 0);
    }
  }

  public setPosition(pos: THREE.Vector3, immediate: boolean = false): void {
    this.camera.position.copy(pos);
    if (immediate) {
      this._scratchV1.copy(this.camera.position).sub(this.target);
      this.spherical.setFromVector3(this._scratchV1);
      this.sphericalTarget.copy(this.spherical);
      this.sphericalVelocity.set(0, 0, 0);
    }
  }
  public reset(target?: THREE.Vector3, distance?: number): void {
    const t = target || new THREE.Vector3(0, 0, 0);
    const d = distance || 22.0;
    this.transitionTo({
      target: t,
      position: new THREE.Vector3(0, 4, d),
      duration: 1.5,
    });
  }

  /**
   * Starts a smooth cinematic interpolation to a target camera pose.
   */
  public transitionTo(options: CameraTransitionOptions): void {
    this.isTransitioning = true;
    this.transitionTime = 0;
    this.transitionDuration = Math.max(0.1, options.duration ?? 2.0);
    this.transitionEasing = options.easing ?? CameraControls.smoothStep;
    this.transitionCallback = options.onComplete ?? null;

    this.transitionStartPosition.copy(this.camera.position);
    this.transitionEndPosition.copy(options.position ?? this.camera.position);

    this.transitionStartTarget.copy(this.target);
    this.transitionEndTarget.copy(options.target ?? this.target);

    this.transitionStartQuat.copy(this.camera.quaternion);

    // Compute target end quaternion
    this._scratchM1.lookAt(
      this.transitionEndPosition,
      this.transitionEndTarget,
      THREE.Object3D.DEFAULT_UP
    );
    this.transitionEndQuat.setFromRotationMatrix(this._scratchM1);

    this.transitionStartFov = this.camera.fov;
    this.transitionEndFov = options.fov ?? this.camera.fov;
  }

  /**
   * Cinematic transition tailored to an ANIMA preset profile.
   */
  public transitionToPreset(preset: PresetConfig, duration: number = 2.4): void {
    // Generate an evocative viewpoint based on the preset's non-Euclidean morphology
    const distanceFactor = preset.raymarch.morphShape === 3 ? 16 : 24;
    const targetOffset = new THREE.Vector3(
      Math.sin(preset.particles.colorHue * Math.PI * 2) * 4.0,
      (preset.simulation.vorticity - 2.5) * 2.0,
      Math.cos(preset.particles.colorHue * Math.PI * 2) * 4.0
    );

    const destTarget = new THREE.Vector3(0, 0, 0).add(targetOffset);
    const destPosition = new THREE.Vector3(
      Math.cos(preset.particles.colorHue * Math.PI * 2 + 0.8) * distanceFactor,
      8.0 + preset.raymarch.blendFactor * 6.0,
      Math.sin(preset.particles.colorHue * Math.PI * 2 + 0.8) * distanceFactor
    );

    const fov = 52 + preset.raymarch.refractionIndex * 4.0;

    this.transitionTo({
      position: destPosition,
      target: destTarget,
      fov,
      duration,
      onComplete: () => {
        // Sync internal spherical and euler coordinates with destination pose
        this._scratchV1.copy(this.camera.position).sub(this.target);
        this.spherical.setFromVector3(this._scratchV1);
        this.sphericalTarget.copy(this.spherical);
        this.glideEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      },
    });
  }

  // -------------------------------------------------------------
  // Input Handling
  // -------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    this.isPointerDown = true;
    this.pointerButton = e.button;
    this.previousPointerX = e.clientX;
    this.previousPointerY = e.clientY;
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled || !this.isPointerDown) return;

    this.pointerDeltaX = e.clientX - this.previousPointerX;
    this.pointerDeltaY = e.clientY - this.previousPointerY;
    this.previousPointerX = e.clientX;
    this.previousPointerY = e.clientY;

    if (this.mode === 'orbit') {
      if (this.pointerButton === 2 || (this.pointerButton === 0 && (e.altKey || e.ctrlKey))) {
        // Celestial Orbit rotation (Right click or Alt/Ctrl + Left click)
        const deltaTheta = -this.pointerDeltaX * this.rotateSpeed;
        const deltaPhi = -this.pointerDeltaY * this.rotateSpeed;
        this.sphericalTarget.theta += deltaTheta;
        this.sphericalTarget.phi += deltaPhi;
        this.sphericalTarget.phi = Math.max(
          this.minPolarAngle,
          Math.min(this.maxPolarAngle, this.sphericalTarget.phi)
        );
      } else if (this.pointerButton === 1 || (this.pointerButton === 2 && e.shiftKey)) {
        // Orbit Pan on camera plane (Middle click or Shift + Right click)
        const factor = this.spherical.radius * 0.0018;
        this._scratchV1.set(-this.pointerDeltaX * factor, this.pointerDeltaY * factor, 0);
        this._scratchV1.applyQuaternion(this.camera.quaternion);
        this.panOffset.add(this._scratchV1);
      }
    } else {
      // Free Glide mouse look (Right click or Alt/Ctrl + Left click)
      if (this.pointerButton === 2 || (this.pointerButton === 0 && (e.altKey || e.ctrlKey))) {
        this.targetLookVelocity.x = -this.pointerDeltaX * this.rotateSpeed * 1.1;
        this.targetLookVelocity.y = -this.pointerDeltaY * this.rotateSpeed * 1.1;
      }
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    this.isPointerDown = false;
    this.pointerButton = -1;
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) return;
    e.preventDefault();

    const zoomDelta = Math.sign(e.deltaY) * this.zoomSpeed * 1.2;

    if (this.mode === 'orbit') {
      this.sphericalTarget.radius = Math.max(
        this.minDistance,
        Math.min(this.maxDistance, this.sphericalTarget.radius + zoomDelta)
      );
    } else {
      // Free glide: wheel pushes velocity surge forward/back
      this._scratchV1.set(0, 0, -zoomDelta * 2.0).applyQuaternion(this.camera.quaternion);
      this.glideVelocity.add(this._scratchV1);
    }
  }

  private onTouchStart(e: TouchEvent): void {
    if (!this.enabled) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.touchDistance = Math.hypot(dx, dy);
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.enabled) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const deltaDist = this.touchDistance - dist;
      this.touchDistance = dist;

      if (this.mode === 'orbit') {
        this.sphericalTarget.radius = Math.max(
          this.minDistance,
          Math.min(this.maxDistance, this.sphericalTarget.radius + deltaDist * 0.05)
        );
      }
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code in this.keys) {
      this.keys[e.code] = true;
    }
    // Quick toggle mode with key 'C' (when not holding Ctrl)
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && (e.target as HTMLElement)?.tagName !== 'INPUT') {
      this.toggleMode();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code in this.keys) {
      this.keys[e.code] = false;
    }
  }

  private onContextMenu(e: Event): void {
    e.preventDefault();
  }

  // -------------------------------------------------------------
  // Per-Frame Update Loop (Zero GC)
  // -------------------------------------------------------------

  public update(deltaTime: number): void {
    if (!this.enabled) return;

    // Clamp delta time to avoid large physics spikes on tab switch
    const dt = Math.min(deltaTime, 0.1);

    // 1. Process active cinematic preset transition
    if (this.isTransitioning) {
      this.updateTransition(dt);
      return;
    }

    // 2. Process active camera mode
    if (this.mode === 'orbit') {
      this.updateOrbit(dt);
    } else {
      this.updateFreeGlide(dt);
    }
  }

  private updateTransition(dt: number): void {
    this.transitionTime += dt;
    const progress = Math.min(1.0, this.transitionTime / this.transitionDuration);
    const eased = this.transitionEasing(progress);

    // Interpolate position and target
    this.camera.position.lerpVectors(
      this.transitionStartPosition,
      this.transitionEndPosition,
      eased
    );
    this.target.lerpVectors(
      this.transitionStartTarget,
      this.transitionEndTarget,
      eased
    );

    // Slerp orientation
    this.camera.quaternion.slerpQuaternions(
      this.transitionStartQuat,
      this.transitionEndQuat,
      eased
    );

    // Lerp FOV
    if (Math.abs(this.transitionStartFov - this.transitionEndFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.lerp(
        this.transitionStartFov,
        this.transitionEndFov,
        eased
      );
      this.camera.updateProjectionMatrix();
    }

    if (progress >= 1.0) {
      this.isTransitioning = false;
      if (this.transitionCallback) {
        this.transitionCallback();
        this.transitionCallback = null;
      }
    }
  }

  private updateOrbit(dt: number): void {
    const damp = Math.min(1.0, this.dampingFactor * (dt * 60));

    // Smoothly apply pan offset
    if (this.panOffset.lengthSq() > 1e-6) {
      this.target.add(this.panOffset);
      this.panOffset.multiplyScalar(1.0 - damp);
    }

    // Spherical interpolation with momentum
    this.spherical.theta = THREE.MathUtils.lerp(
      this.spherical.theta,
      this.sphericalTarget.theta,
      damp
    );
    this.spherical.phi = THREE.MathUtils.lerp(
      this.spherical.phi,
      this.sphericalTarget.phi,
      damp
    );
    this.spherical.radius = THREE.MathUtils.lerp(
      this.spherical.radius,
      this.sphericalTarget.radius,
      damp
    );

    // Calculate position from spherical coordinates
    this._scratchV1.setFromSpherical(this.spherical);

    // Subtle celestial micro-drift when idle
    if (this.organicSway && !this.isPointerDown) {
      this.swayClock += dt * 0.4;
      const swayElevation = Math.sin(this.swayClock * 0.8) * 0.15;
      const swayAzimuth = Math.cos(this.swayClock * 0.5) * 0.15;
      this._scratchV1.y += swayElevation;
      this._scratchV1.x += swayAzimuth;
    }

    this.camera.position.copy(this.target).add(this._scratchV1);
    this.camera.lookAt(this.target);
  }

  private updateFreeGlide(dt: number): void {
    const damp = Math.min(1.0, this.dampingFactor * (dt * 60));

    // Smooth mouse look rotation with momentum
    this.lookVelocity.lerp(this.targetLookVelocity, damp * 1.5);
    this.targetLookVelocity.multiplyScalar(0.75);

    this.glideEuler.y += this.lookVelocity.x;
    this.glideEuler.x += this.lookVelocity.y;
    // Clamp pitch between -85 and +85 degrees
    const maxPitch = Math.PI * 0.48;
    this.glideEuler.x = Math.max(-maxPitch, Math.min(maxPitch, this.glideEuler.x));

    // Organic banking roll when yawing or strafing
    const strafeInput = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const targetRoll = (-this.lookVelocity.x * 2.8) - (strafeInput * 0.05);
    this.bankAngle = THREE.MathUtils.lerp(this.bankAngle, targetRoll, damp * 0.8);
    this.glideEuler.z = this.bankAngle;

    this.camera.quaternion.setFromEuler(this.glideEuler);

    // Compute input acceleration vector
    const speed = this.moveSpeed * (this.keys.ShiftLeft || this.keys.ShiftRight ? 2.5 : 1.0);
    const moveZ = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const moveX = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const moveY = (this.keys.Space || this.keys.KeyE ? 1 : 0) - (this.keys.KeyQ || this.keys.ControlLeft ? 1 : 0);

    this._scratchV1.set(moveX, moveY, -moveZ);
    if (this._scratchV1.lengthSq() > 0) {
      this._scratchV1.normalize().multiplyScalar(speed * dt * 2.0);
      this._scratchV1.applyQuaternion(this.camera.quaternion);
      this.glideVelocity.add(this._scratchV1);
    }

    // Viscous hydrodynamic drag (feels like swimming in deep bioluminescent fluid)
    const dragMultiplier = Math.pow(this.fluidDrag, dt * 60);
    this.glideVelocity.multiplyScalar(dragMultiplier);

    // Deep sea buoyant micro-undulation (subtle breathing of the ocean)
    if (this.organicSway) {
      this.swayClock += dt * 0.7;
      const swayY = Math.sin(this.swayClock * 1.1) * 0.035;
      const swayX = Math.cos(this.swayClock * 0.7) * 0.015;
      this._scratchV2.set(swayX, swayY, 0).applyQuaternion(this.camera.quaternion);
      this.camera.position.add(this._scratchV2);
    }

    // Apply integrated velocity
    this._scratchV3.copy(this.glideVelocity).multiplyScalar(dt);
    this.camera.position.add(this._scratchV3);

    // Update target to remain ahead of the gliding camera
    this._scratchV1.set(0, 0, -10).applyQuaternion(this.camera.quaternion);
    this.target.copy(this.camera.position).add(this._scratchV1);
  }

  public resize(width: number, height: number): void {
    if (height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  private static smoothStep(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
