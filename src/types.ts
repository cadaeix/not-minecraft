import * as THREE from 'three';

export type ToolType = 
  | 'vortex'           // Injects rotational fluid velocity & luminescence
  | 'liquid_spray'     // Continuous high-velocity bioluminescent liquid spray with SDF surface collision
  | 'place_attractor'  // Drops persistent gravitational singularities that bend liquid & matter
  | 'graviton_pull'    // Non-linear gravitational attractor brush
  | 'graviton_push'    // Repulsive cosmic shockwave
  | 'turing_seed'      // Gray-Scott activator/inhibitor injection
  | 'mycelium_spore'   // Spawns Physarum slime mold agents
  | 'chromatic_pulse'  // Emits synesthetic light wave & resonant chime
  | 'phase_melt';      // Mutates raymarching SDF topology (solid <-> fluid plasma)

export interface PresetConfig {
  name: string;
  subtitle: string;
  description: string;
  raymarch: {
    morphShape: number;       // 0: Gyroid, 1: Schwarz P, 2: Metaballs, 3: Mandelbulb/Fractal
    blendFactor: number;      // smin softness
    fractalIterations: number;
    subsurfaceGlow: number;
    colorA: THREE.Color;
    colorB: THREE.Color;
    colorInterior: THREE.Color;
    refractionIndex: number;
    surfaceTension: number;
  };
  particles: {
    count: number;
    speed: number;
    curlScale: number;
    trailDecay: number;
    colorHue: number;
    phosphorescence: number;
  };
  simulation: {
    viscosity: number;
    vorticity: number;
    reactionFeed: number;     // Gray-Scott F
    reactionKill: number;     // Gray-Scott K
    slimeSensorAngle: number;
    slimeSensorDist: number;
    slimeStepSize: number;
  };
  audio: {
    baseFrequency: number;
    scale: 'lydian' | 'harmonicMinor' | 'microtonal' | 'pentatonic' | 'celestial';
    droneIntensity: number;
    filterCutoff: number;
    reverbDecay: number;
  };
}

export interface GravitationalAttractor {
  id: string;
  position: THREE.Vector3;
  mass: number;             // Positive = black hole attraction, Negative = white hole repulsion
  radius: number;           // Event horizon radius
  color: THREE.Color;
  pulsePhase: number;
}

export interface SimulationTelemetry {
  fps: number;
  particleCount: number;
  fluidKineticEnergy: number;
  entropy: number;
  biomass: number;
  dominantHarmonicHz: number;
  activeOrganisms: number;
  activeAttractors: number;
  liquidDropletCount: number;
}
