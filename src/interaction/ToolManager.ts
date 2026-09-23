import * as THREE from 'three';
import { ToolType } from '../types';

/**
 * Metadata definition for each of the 7 Anti-Minecraft Organic Tools.
 */
export interface ToolMetadata {
  type: ToolType;
  name: string;
  hotkey: string;
  tagline: string;
  description: string;
  primaryColor: THREE.Color;
  secondaryColor: THREE.Color;
  defaultRadius: number;
  minRadius: number;
  maxRadius: number;
  defaultStrength: number;
  minStrength: number;
  maxStrength: number;
  soundCue: string;
}

/**
 * Continuous real-time tool interaction stroke event.
 * Reused each frame to achieve ZERO garbage collection allocations.
 */
export interface ToolStroke {
  tool: ToolType;
  active: boolean;              // True if pointer is currently held down
  justStarted: boolean;         // True on the very first frame of interaction
  justEnded: boolean;           // True on pointer release
  time: number;                 // Total elapsed time in seconds

  // Spatial coordinates
  screenPos: THREE.Vector2;     // Client pixel position [0..W, 0..H]
  screenDelta: THREE.Vector2;   // Frame-to-frame pixel delta
  ndc: THREE.Vector2;           // Normalized device coordinates [-1..1, -1..1]
  ray: THREE.Ray;               // 3D world ray from camera eye
  point3D: THREE.Vector3;       // 3D interaction point projected in space
  velocity3D: THREE.Vector3;    // 3D velocity vector of the brush head

  // Modulated dynamics
  pressure: number;             // Pointer pressure [0..1]
  speed: number;                // Cursor speed in px/s
  radius: number;               // Effective brush radius in world units
  strength: number;             // Effective brush intensity [0..1]

  // Specific physical/chemical parameters for simulation engines
  vortex: {
    angularVelocity: THREE.Vector3;
    spinDirection: number;      // +1 (clockwise) or -1 (counter-clockwise)
    luminescence: number;       // Bioluminescent photon injection [0..1]
  };
  graviton: {
    intensity: number;          // Attraction (+ve) or repulsion (-ve) force
    falloff: number;            // Softening epsilon (prevents infinite singularity)
    shockwaveRadius: number;    // Expanding concentric wavefront radius
    shockwavePhase: number;     // Wave oscillation phase
  };
  turing: {
    activatorDelta: number;     // Gray-Scott U morphogen injection
    inhibitorDelta: number;     // Gray-Scott V morphogen injection
    feedPerturbation: number;   // Local feed rate perturbation
    killPerturbation: number;   // Local kill rate perturbation
  };
  mycelium: {
    sporeCount: number;         // Count of slime mold agents to spawn
    chemoattractant: number;    // Trail scent deposition
    spreadAngle: number;        // Emission cone angle
  };
  chromatic: {
    frequencyHz: number;        // Procedural chime harmonic frequency
    resonance: number;          // Chime Q factor
    waveSpeed: number;          // Resonant photon wavefront speed
    lightEnergy: number;        // Luminescent pulse excitation
  };
  phaseMelt: {
    meltRate: number;           // Gyroid <-> fluid plasma blending rate
    targetMorphShape: number;   // Target raymarch topology index
    viscosityDrop: number;      // Local fluid viscosity reduction
  };
}

export type ToolStrokeListener = (stroke: ToolStroke) => void;
export type ToolChangeListener = (tool: ToolType, meta: ToolMetadata) => void;
export type PulseTriggerListener = (tool: ToolType, point3D: THREE.Vector3, strength: number) => void;

/**
 * Complete metadata dictionary for all 7 organic tools.
 */
export const TOOL_METADATA_TABLE: Record<ToolType, ToolMetadata> = {
  vortex: {
    type: 'vortex',
    name: 'Vortex Swirl',
    hotkey: '1',
    tagline: 'Swirling Angular Momentum & Bioluminescence',
    description: 'Injects rotational velocity into fluid vectors and excites phosphorescent particles with swirling bioluminescence.',
    primaryColor: new THREE.Color(0x00f0ff),
    secondaryColor: new THREE.Color(0x0066ff),
    defaultRadius: 3.5,
    minRadius: 0.8,
    maxRadius: 16.0,
    defaultStrength: 0.75,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'vortex_swirl',
  },
  graviton_pull: {
    type: 'graviton_pull',
    name: 'Graviton Pull',
    hotkey: '2',
    tagline: 'Spacetime Curvature & Cosmic Attractor',
    description: 'Bends space inward with non-linear inverse-square gravity, drawing particles and fluid into ultra-dense accretion rings.',
    primaryColor: new THREE.Color(0x9d00ff),
    secondaryColor: new THREE.Color(0xff00aa),
    defaultRadius: 5.0,
    minRadius: 1.0,
    maxRadius: 22.0,
    defaultStrength: 0.8,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'graviton_attract',
  },
  graviton_push: {
    type: 'graviton_push',
    name: 'Graviton Push',
    hotkey: '3',
    tagline: 'Repulsive Cosmic Shockwave',
    description: 'Detonates outward repulsive cosmic shockwaves in expanding concentric rings, blasting fluid and matter into void corridors.',
    primaryColor: new THREE.Color(0xff6600),
    secondaryColor: new THREE.Color(0xffcc00),
    defaultRadius: 4.5,
    minRadius: 1.0,
    maxRadius: 20.0,
    defaultStrength: 0.85,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'graviton_repel',
  },
  turing_seed: {
    type: 'turing_seed',
    name: 'Turing Seed',
    hotkey: '4',
    tagline: 'Morphogen Chemical Inoculation',
    description: 'Directly injects concentrated morphogens into the Gray-Scott reaction-diffusion substrate to catalyze spontaneous labyrinth and spot morphogenesis.',
    primaryColor: new THREE.Color(0x00ff66),
    secondaryColor: new THREE.Color(0xbfff00),
    defaultRadius: 2.8,
    minRadius: 0.5,
    maxRadius: 12.0,
    defaultStrength: 0.7,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'turing_catalyst',
  },
  mycelium_spore: {
    type: 'mycelium_spore',
    name: 'Mycelial Spore',
    hotkey: '5',
    tagline: 'Physarum Slime Mold Burst',
    description: 'Releases a burst of living Physarum slime mold agents that deposit chemoattractants and weave self-optimizing biological nutrient bridges.',
    primaryColor: new THREE.Color(0xffbf00),
    secondaryColor: new THREE.Color(0xff8800),
    defaultRadius: 3.2,
    minRadius: 0.6,
    maxRadius: 14.0,
    defaultStrength: 0.65,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'spore_bloom',
  },
  chromatic_pulse: {
    type: 'chromatic_pulse',
    name: 'Chromatic Pulse',
    hotkey: '6',
    tagline: 'Synesthetic Resonant Light Wave',
    description: 'Emits a resonant harmonic light wave that excites all ambient matter and rings the procedural chime synthesizer across the harmonic series.',
    primaryColor: new THREE.Color(0xff0088),
    secondaryColor: new THREE.Color(0xaa00ff),
    defaultRadius: 6.0,
    minRadius: 1.5,
    maxRadius: 28.0,
    defaultStrength: 0.9,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'chromatic_chime',
  },
  phase_melt: {
    type: 'phase_melt',
    name: 'Phase Melt',
    hotkey: '7',
    tagline: 'Non-Euclidean Topology Mutator',
    description: 'Thermally mutates raymarching SDF topology, blending crystalline gyroids and Schwarz minimal surfaces into superheated fluid plasma.',
    primaryColor: new THREE.Color(0xff1744),
    secondaryColor: new THREE.Color(0xd500f9),
    defaultRadius: 4.0,
    minRadius: 0.8,
    maxRadius: 18.0,
    defaultStrength: 0.75,
    minStrength: 0.1,
    maxStrength: 1.0,
    soundCue: 'phase_liquefy',
  },
};

/** All tool keys ordered by their hotkeys */
export const TOOL_ORDER: ToolType[] = [
  'vortex',
  'graviton_pull',
  'graviton_push',
  'turing_seed',
  'mycelium_spore',
  'chromatic_pulse',
  'phase_melt',
];

/**
 * High-performance Tool Interaction Manager for ANIMA.
 * Handles mouse, stylus, touch, keyboard shortcuts, screen-to-world raycasting,
 * pressure/speed sensitivity, and delivers clean physics payloads to simulation systems.
 */
export class ToolManager {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public enabled: boolean = true;

  // Active tool state
  private activeTool: ToolType = 'vortex';
  public brushRadius: number = 3.5;
  public brushStrength: number = 0.75;
  private focalDistance: number = 18.0;

  // Pointer state
  private isPointerDown: boolean = false;
  private justPointerDown: boolean = false;
  private justPointerUp: boolean = false;
  private pointerPressure: number = 1.0;
  private pointerSpeed: number = 0;
  private clientX: number = 0;
  private clientY: number = 0;
  private prevClientX: number = 0;
  private prevClientY: number = 0;
  private strokeTimer: number = 0;
  private shockwaveTimer: number = 0;

  // Scratch objects for raycasting and 3D projection
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private focalPlane: THREE.Plane = new THREE.Plane();
  private prevPoint3D: THREE.Vector3 = new THREE.Vector3();
  private currentPoint3D: THREE.Vector3 = new THREE.Vector3();
  private velocity3D: THREE.Vector3 = new THREE.Vector3();
  private cameraDirection: THREE.Vector3 = new THREE.Vector3();
  private cameraPlaneNormal: THREE.Vector3 = new THREE.Vector3();
  private scratchV1: THREE.Vector3 = new THREE.Vector3();
  private scratchV2: THREE.Vector3 = new THREE.Vector3();

  // Reusable stroke event object (zero per-frame allocations)
  private strokeEvent: ToolStroke = {
    tool: 'vortex',
    active: false,
    justStarted: false,
    justEnded: false,
    time: 0,
    screenPos: new THREE.Vector2(),
    screenDelta: new THREE.Vector2(),
    ndc: new THREE.Vector2(),
    ray: new THREE.Ray(),
    point3D: new THREE.Vector3(),
    velocity3D: new THREE.Vector3(),
    pressure: 1.0,
    speed: 0,
    radius: 3.5,
    strength: 0.75,
    vortex: {
      angularVelocity: new THREE.Vector3(),
      spinDirection: 1,
      luminescence: 0.8,
    },
    graviton: {
      intensity: 1.0,
      falloff: 1.5,
      shockwaveRadius: 0,
      shockwavePhase: 0,
    },
    turing: {
      activatorDelta: 0.5,
      inhibitorDelta: 0.25,
      feedPerturbation: 0.015,
      killPerturbation: -0.01,
    },
    mycelium: {
      sporeCount: 250,
      chemoattractant: 1.0,
      spreadAngle: 0.6,
    },
    chromatic: {
      frequencyHz: 440,
      resonance: 8.0,
      waveSpeed: 12.0,
      lightEnergy: 1.0,
    },
    phaseMelt: {
      meltRate: 0.8,
      targetMorphShape: 2,
      viscosityDrop: 0.4,
    },
  };

  // Event listeners
  private strokeListeners: ToolStrokeListener[] = [];
  private changeListeners: ToolChangeListener[] = [];
  private pulseListeners: PulseTriggerListener[] = [];

  // Bound DOM handlers
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  public constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Apply default active tool parameters
    const meta = TOOL_METADATA_TABLE[this.activeTool];
    this.brushRadius = meta.defaultRadius;
    this.brushStrength = meta.defaultStrength;

    // Bind event handlers
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnKeyDown = this.onKeyDown.bind(this);

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    this.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    window.addEventListener('pointercancel', this.boundOnPointerUp);
    this.domElement.addEventListener('wheel', this.boundOnWheel, { passive: false });
    window.addEventListener('keydown', this.boundOnKeyDown);
  }

  public dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
    window.removeEventListener('pointercancel', this.boundOnPointerUp);
    this.domElement.removeEventListener('wheel', this.boundOnWheel);
    window.removeEventListener('keydown', this.boundOnKeyDown);

    this.strokeListeners.length = 0;
    this.changeListeners.length = 0;
    this.pulseListeners.length = 0;
  }

  // -------------------------------------------------------------
  // Tool Selection & Configuration
  // -------------------------------------------------------------

  public getActiveTool(): ToolType {
    return this.activeTool;
  }

  public getActiveMetadata(): ToolMetadata {
    return TOOL_METADATA_TABLE[this.activeTool];
  }

  public setTool(tool: ToolType): void {
    if (this.activeTool === tool) return;
    this.activeTool = tool;

    const meta = TOOL_METADATA_TABLE[tool];
    this.brushRadius = meta.defaultRadius;
    this.brushStrength = meta.defaultStrength;

    for (let i = 0; i < this.changeListeners.length; i++) {
      this.changeListeners[i](tool, meta);
    }
  }

  public cycleTool(direction: number = 1): ToolType {
    const currentIndex = TOOL_ORDER.indexOf(this.activeTool);
    const nextIndex = (currentIndex + direction + TOOL_ORDER.length) % TOOL_ORDER.length;
    const nextTool = TOOL_ORDER[nextIndex];
    this.setTool(nextTool);
    return nextTool;
  }

  public setRadius(radius: number): void {
    const meta = TOOL_METADATA_TABLE[this.activeTool];
    this.brushRadius = Math.max(meta.minRadius, Math.min(meta.maxRadius, radius));
  }

  public setStrength(strength: number): void {
    const meta = TOOL_METADATA_TABLE[this.activeTool];
    this.brushStrength = Math.max(meta.minStrength, Math.min(meta.maxStrength, strength));
  }

  public setFocalDistance(dist: number): void {
    this.focalDistance = Math.max(1.0, Math.min(100.0, dist));
  }
  public getPoint3D(): THREE.Vector3 {
    return this.currentPoint3D;
  }

  public isInteracting(): boolean {
    return this.isPointerDown;
  }

  // -------------------------------------------------------------
  // Event Subscription
  // -------------------------------------------------------------

  public onStroke(listener: ToolStrokeListener): () => void {
    this.strokeListeners.push(listener);
    return () => {
      const idx = this.strokeListeners.indexOf(listener);
      if (idx !== -1) this.strokeListeners.splice(idx, 1);
    };
  }

  public onToolChange(listener: ToolChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx !== -1) this.changeListeners.splice(idx, 1);
    };
  }

  public onPulse(listener: PulseTriggerListener): () => void {
    this.pulseListeners.push(listener);
    return () => {
      const idx = this.pulseListeners.indexOf(listener);
      if (idx !== -1) this.pulseListeners.splice(idx, 1);
    };
  }

  /**
   * Fires a resonant impulse wave at the current 3D interaction point.
   */
  public triggerPulse(): void {
    for (let i = 0; i < this.pulseListeners.length; i++) {
      this.pulseListeners[i](this.activeTool, this.currentPoint3D, this.brushStrength);
    }
  }

  // -------------------------------------------------------------
  // Input Listeners
  // -------------------------------------------------------------

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) return;
    // Left-click (button 0) activates tool
    if (e.button === 0 && !e.shiftKey && !e.altKey) {
      this.isPointerDown = true;
      this.justPointerDown = true;
      this.clientX = e.clientX;
      this.clientY = e.clientY;
      this.prevClientX = e.clientX;
      this.prevClientY = e.clientY;
      this.pointerPressure = e.pressure > 0 ? e.pressure : 1.0;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) return;
    this.clientX = e.clientX;
    this.clientY = e.clientY;
    if (e.pressure > 0) {
      this.pointerPressure = e.pressure;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isPointerDown && e.button === 0) {
      this.isPointerDown = false;
      this.justPointerUp = true;
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) return;
    // If holding Alt or Shift, adjust tool radius or strength instead of zooming
    if (e.altKey || e.shiftKey) {
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      if (e.shiftKey) {
        // Adjust radius
        const step = (TOOL_METADATA_TABLE[this.activeTool].maxRadius - TOOL_METADATA_TABLE[this.activeTool].minRadius) * 0.05;
        this.setRadius(this.brushRadius - delta * step);
      } else {
        // Adjust strength
        this.setStrength(this.brushStrength - delta * 0.05);
      }
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key) {
      case '1':
        this.setTool('vortex');
        break;
      case '2':
        this.setTool('graviton_pull');
        break;
      case '3':
        this.setTool('graviton_push');
        break;
      case '4':
        this.setTool('turing_seed');
        break;
      case '5':
        this.setTool('mycelium_spore');
        break;
      case '6':
        this.setTool('chromatic_pulse');
        break;
      case '7':
        this.setTool('phase_melt');
        break;
      case 'Tab':
        e.preventDefault();
        this.cycleTool(e.shiftKey ? -1 : 1);
        break;
      case ' ':
        e.preventDefault();
        this.triggerPulse();
        break;
      case '[':
        this.setRadius(this.brushRadius * 0.85);
        break;
      case ']':
        this.setRadius(this.brushRadius * 1.15);
        break;
      case '-':
      case '_':
        this.setStrength(this.brushStrength - 0.05);
        break;
      case '=':
      case '+':
        this.setStrength(this.brushStrength + 0.05);
        break;
    }
  }

  // -------------------------------------------------------------
  // Per-Frame Update (Zero Garbage Collection)
  // -------------------------------------------------------------

  public update(deltaTime: number): void {
    if (!this.enabled) return;

    const dt = Math.max(0.001, Math.min(0.1, deltaTime));
    this.strokeTimer += dt;
    this.shockwaveTimer += dt;

    // 1. Calculate screen coordinates and normalized device coordinates
    const rect = this.domElement.getBoundingClientRect();
    const pixelX = this.clientX - rect.left;
    const pixelY = this.clientY - rect.top;
    const ndcX = (pixelX / rect.width) * 2 - 1;
    const ndcY = -(pixelY / rect.height) * 2 + 1;

    // 2. Cursor speed calculation with exponential decay
    const dx = this.clientX - this.prevClientX;
    const dy = this.clientY - this.prevClientY;
    const instantSpeed = Math.hypot(dx, dy) / dt;
    this.pointerSpeed = THREE.MathUtils.lerp(this.pointerSpeed, instantSpeed, 0.25);
    this.prevClientX = this.clientX;
    this.prevClientY = this.clientY;

    // 3. Compute 3D world ray from camera
    this.strokeEvent.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.strokeEvent.ndc, this.camera);
    this.strokeEvent.ray.copy(this.raycaster.ray);

    // 4. Compute 3D interaction hit point on camera focal plane
    this.camera.getWorldDirection(this.cameraDirection);
    this.cameraPlaneNormal.copy(this.cameraDirection).negate();

    // Focal plane passes through point at focalDistance ahead of camera
    this.scratchV1.copy(this.camera.position).addScaledVector(this.cameraDirection, this.focalDistance);
    this.focalPlane.setFromNormalAndCoplanarPoint(this.cameraPlaneNormal, this.scratchV1);

    // Intersect ray with focal plane
    const hit = this.raycaster.ray.intersectPlane(this.focalPlane, this.currentPoint3D);
    if (!hit) {
      // Fallback if ray is parallel
      this.currentPoint3D.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, this.focalDistance);
    }

    // 5. Compute 3D brush velocity
    if (this.justPointerDown) {
      this.prevPoint3D.copy(this.currentPoint3D);
      this.velocity3D.set(0, 0, 0);
    } else {
      this.velocity3D.copy(this.currentPoint3D).sub(this.prevPoint3D).multiplyScalar(1.0 / dt);
      this.prevPoint3D.copy(this.currentPoint3D);
    }

    // 6. Dynamic pressure and speed modulation
    const speedRatio = Math.min(1.0, this.pointerSpeed / 1200.0);
    const dynamicPressure = Math.max(0.15, Math.min(1.0, this.pointerPressure * 0.7 + speedRatio * 0.3));
    const effectiveRadius = this.brushRadius * (0.8 + dynamicPressure * 0.4);
    const effectiveStrength = this.brushStrength * dynamicPressure;

    // 7. Populate reusable ToolStroke event payload
    this.strokeEvent.tool = this.activeTool;
    this.strokeEvent.active = this.isPointerDown;
    this.strokeEvent.justStarted = this.justPointerDown;
    this.strokeEvent.justEnded = this.justPointerUp;
    this.strokeEvent.time = this.strokeTimer;

    this.strokeEvent.screenPos.set(pixelX, pixelY);
    this.strokeEvent.screenDelta.set(dx, dy);
    this.strokeEvent.point3D.copy(this.currentPoint3D);
    this.strokeEvent.velocity3D.copy(this.velocity3D);
    this.strokeEvent.pressure = dynamicPressure;
    this.strokeEvent.speed = this.pointerSpeed;
    this.strokeEvent.radius = effectiveRadius;
    this.strokeEvent.strength = effectiveStrength;

    // 8. Compute specific physics/chemical payloads based on tool
    this.computeToolParameters(dt, dynamicPressure, effectiveStrength);

    // 9. Dispatch to all active subscribers
    if (this.isPointerDown || this.justPointerUp) {
      for (let i = 0; i < this.strokeListeners.length; i++) {
        this.strokeListeners[i](this.strokeEvent);
      }
    }

    // Reset single-frame trigger flags
    this.justPointerDown = false;
    this.justPointerUp = false;
  }

  /**
   * Calculates continuous physical and chemical parameters for the active tool.
   */
  private computeToolParameters(dt: number, pressure: number, strength: number): void {
    switch (this.activeTool) {
      case 'vortex': {
        // Rotational vector perpendicular to camera ray and brush movement
        if (this.velocity3D.lengthSq() > 0.01) {
          this.scratchV2.copy(this.velocity3D).normalize();
          this.strokeEvent.vortex.angularVelocity.crossVectors(this.cameraDirection, this.scratchV2).multiplyScalar(strength * 8.0);
        } else {
          this.strokeEvent.vortex.angularVelocity.copy(this.cameraDirection).multiplyScalar(strength * 6.0);
        }
        this.strokeEvent.vortex.spinDirection = 1;
        this.strokeEvent.vortex.luminescence = Math.min(1.0, 0.4 + pressure * 0.6);
        break;
      }

      case 'graviton_pull': {
        // Space curvature drawing particles inward with inverse-square + smoothing
        this.strokeEvent.graviton.intensity = strength * 24.0;
        this.strokeEvent.graviton.falloff = Math.max(0.5, this.brushRadius * 0.25);
        this.strokeEvent.graviton.shockwaveRadius = 0;
        this.strokeEvent.graviton.shockwavePhase = 0;
        break;
      }

      case 'graviton_push': {
        // Repulsive cosmic shockwave in expanding concentric rings
        this.strokeEvent.graviton.intensity = -strength * 32.0;
        this.strokeEvent.graviton.falloff = Math.max(0.8, this.brushRadius * 0.35);
        this.strokeEvent.graviton.shockwaveRadius = (this.shockwaveTimer * 14.0) % (this.brushRadius * 2.5);
        this.strokeEvent.graviton.shockwavePhase = this.shockwaveTimer * 8.0;
        break;
      }

      case 'turing_seed': {
        // Concentrated chemical morphogen injection into Gray-Scott field
        this.strokeEvent.turing.activatorDelta = 0.65 * strength;
        this.strokeEvent.turing.inhibitorDelta = 0.35 * strength;
        this.strokeEvent.turing.feedPerturbation = 0.012 * pressure;
        this.strokeEvent.turing.killPerturbation = -0.008 * pressure;
        break;
      }

      case 'mycelium_spore': {
        // Spawns burst of Physarum slime mold agents
        this.strokeEvent.mycelium.sporeCount = Math.round(150 + pressure * 350);
        this.strokeEvent.mycelium.chemoattractant = strength * 1.5;
        this.strokeEvent.mycelium.spreadAngle = 0.5 + pressure * 0.4;
        break;
      }

      case 'chromatic_pulse': {
        // Resonant harmonic excitation ringing procedural chime synthesizer
        // Map Y coordinate to musical pitch in C pentatonic / Lydian overtone series
        const pitchNorm = Math.max(0, Math.min(1, (this.currentPoint3D.y + 10) / 20));
        const baseFreq = 130.81; // C3
        const harmonicMultiplier = 1 + Math.floor(pitchNorm * 8);
        this.strokeEvent.chromatic.frequencyHz = baseFreq * harmonicMultiplier;
        this.strokeEvent.chromatic.resonance = 6.0 + strength * 10.0;
        this.strokeEvent.chromatic.waveSpeed = 16.0 * (0.8 + pressure * 0.4);
        this.strokeEvent.chromatic.lightEnergy = strength;
        break;
      }

      case 'phase_melt': {
        // Mutates raymarching SDF topology (solid <-> plasma)
        this.strokeEvent.phaseMelt.meltRate = strength * (0.5 + pressure * 0.5);
        this.strokeEvent.phaseMelt.targetMorphShape = 2; // Plasma / Metaballs
        this.strokeEvent.phaseMelt.viscosityDrop = strength * 0.6;
        break;
      }
    }
  }
}
