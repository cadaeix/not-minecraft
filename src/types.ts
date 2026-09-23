import * as THREE from 'three';

export type ToolType = 
  | 'vortex'           // Injects rotational fluid velocity & luminescence
  | 'graviton_pull'    // Non-linear gravitational attractor
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

export interface SimulationTelemetry {
  fps: number;
  particleCount: number;
  fluidKineticEnergy: number;
  entropy: number;
  biomass: number;
  dominantHarmonicHz: number;
  activeOrganisms: number;
}
