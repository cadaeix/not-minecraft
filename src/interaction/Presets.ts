import * as THREE from 'three';
import { PresetConfig } from '../types';

/**
 * 5 Deeply distinct and evocative presets for ANIMA: The Anti-Minecraft.
 * Zero voxels, continuous fluid-organic cosmos.
 */

export const PRESET_ABYSSAL_BLOOM: PresetConfig = {
  name: 'The Abyssal Bloom',
  subtitle: 'Deep Bioluminescent Hydrothermal Abyss',
  description: 'Pulsing soft jellies and hydrothermal fluid plumes drifting through endless oceanic trenches, illuminated by cyan and magenta bioluminescence.',
  raymarch: {
    morphShape: 2, // Metaballs / Organic membrane
    blendFactor: 0.68,
    fractalIterations: 4,
    subsurfaceGlow: 0.88,
    colorA: new THREE.Color(0x00f0ff), // Electrified cyan
    colorB: new THREE.Color(0xff0088), // Deep bioluminescent magenta
    colorInterior: new THREE.Color(0x020814), // Midnight abyssal navy
    refractionIndex: 1.34,
    surfaceTension: 0.42,
  },
  particles: {
    count: 120000,
    speed: 0.48,
    curlScale: 1.85,
    trailDecay: 0.94,
    colorHue: 0.52, // Teal / Cyan spectrum
    phosphorescence: 0.92,
  },
  simulation: {
    viscosity: 0.985,
    vorticity: 2.6,
    reactionFeed: 0.038,
    reactionKill: 0.061,
    slimeSensorAngle: 0.45,
    slimeSensorDist: 18.0,
    slimeStepSize: 1.25,
  },
  audio: {
    baseFrequency: 65.41, // C2 deep oceanic root
    scale: 'lydian',
    droneIntensity: 0.68,
    filterCutoff: 1400,
    reverbDecay: 5.2,
  },
};

export const PRESET_NEBULAR_GYROID: PresetConfig = {
  name: 'Nebular Gyroid',
  subtitle: 'Cosmic Non-Euclidean Minimal Surface',
  description: 'Morphing triply periodic gyroid manifolds folded across infinite dimensional voids, glistening with violet and gold iridescence.',
  raymarch: {
    morphShape: 0, // Gyroid minimal surface
    blendFactor: 0.38,
    fractalIterations: 8,
    subsurfaceGlow: 0.65,
    colorA: new THREE.Color(0xffc233), // Astral starlight amber
    colorB: new THREE.Color(0x8a2be2), // Cosmic royal violet
    colorInterior: new THREE.Color(0x120324), // Void hyper-purple
    refractionIndex: 1.65,
    surfaceTension: 0.78,
  },
  particles: {
    count: 100000,
    speed: 0.65,
    curlScale: 2.6,
    trailDecay: 0.96,
    colorHue: 0.78, // Violet / Amethyst spectrum
    phosphorescence: 0.82,
  },
  simulation: {
    viscosity: 0.992,
    vorticity: 3.4,
    reactionFeed: 0.029,
    reactionKill: 0.057,
    slimeSensorAngle: 0.54,
    slimeSensorDist: 26.0,
    slimeStepSize: 1.6,
  },
  audio: {
    baseFrequency: 110.0, // A2 celestial harmonic
    scale: 'celestial',
    droneIntensity: 0.82,
    filterCutoff: 2600,
    reverbDecay: 6.8,
  },
};

export const PRESET_MYCELIAL_NEXUS: PresetConfig = {
  name: 'Mycelial Nexus',
  subtitle: 'Golden Physarum Slime Mold Topology',
  description: 'Hyper-connected biological network pulsing with golden bio-data currents, routing nutrient flows across living spatial lattices.',
  raymarch: {
    morphShape: 1, // Schwarz P minimal surface
    blendFactor: 0.56,
    fractalIterations: 5,
    subsurfaceGlow: 0.96,
    colorA: new THREE.Color(0xffea00), // Radiant golden spore
    colorB: new THREE.Color(0xff6a00), // Bioluminescent orange vein
    colorInterior: new THREE.Color(0x1a0f02), // Deep fertile humus
    refractionIndex: 1.48,
    surfaceTension: 0.62,
  },
  particles: {
    count: 140000,
    speed: 1.15,
    curlScale: 3.3,
    trailDecay: 0.91,
    colorHue: 0.12, // Golden bio-yellow
    phosphorescence: 0.98,
  },
  simulation: {
    viscosity: 0.962,
    vorticity: 1.9,
    reactionFeed: 0.054,
    reactionKill: 0.063,
    slimeSensorAngle: 0.66,
    slimeSensorDist: 34.0,
    slimeStepSize: 2.5,
  },
  audio: {
    baseFrequency: 146.83, // D3 fungal pulse
    scale: 'microtonal',
    droneIntensity: 0.52,
    filterCutoff: 3400,
    reverbDecay: 3.8,
  },
};

export const PRESET_TURING_CHRYSALIS: PresetConfig = {
  name: 'Turing Chrysalis',
  subtitle: 'Morphogenetic Reaction-Diffusion Labyrinth',
  description: 'Living Gray-Scott chemical substrate evolving labyrinths, spots, and coral ribs bathed in lime, emerald, and glowing amber.',
  raymarch: {
    morphShape: 2, // Reaction-diffusion cellular membrane
    blendFactor: 0.74,
    fractalIterations: 6,
    subsurfaceGlow: 0.8,
    colorA: new THREE.Color(0x00ff88), // Spring bio-emerald
    colorB: new THREE.Color(0xaaff00), // Electric morphogen lime
    colorInterior: new THREE.Color(0x022413), // Deep chloroplast matrix
    refractionIndex: 1.39,
    surfaceTension: 0.54,
  },
  particles: {
    count: 110000,
    speed: 0.38,
    curlScale: 1.45,
    trailDecay: 0.97,
    colorHue: 0.35, // Emerald / Lime green
    phosphorescence: 0.84,
  },
  simulation: {
    viscosity: 0.978,
    vorticity: 1.3,
    reactionFeed: 0.034,
    reactionKill: 0.065,
    slimeSensorAngle: 0.39,
    slimeSensorDist: 15.0,
    slimeStepSize: 0.95,
  },
  audio: {
    baseFrequency: 130.81, // C3 crystalline chime
    scale: 'pentatonic',
    droneIntensity: 0.58,
    filterCutoff: 1900,
    reverbDecay: 4.2,
  },
};

export const PRESET_SINGULARITY_FLUX: PresetConfig = {
  name: 'Singularity Flux',
  subtitle: 'Relativistic Gravitational Vortex',
  description: 'Fierce cosmic vortex bending particle trajectories, warping optical manifolds with severe chromatic dispersion and pitch-collapsing bass.',
  raymarch: {
    morphShape: 3, // Mandelbulb / Non-Euclidean singularity
    blendFactor: 0.28,
    fractalIterations: 10,
    subsurfaceGlow: 1.0,
    colorA: new THREE.Color(0x7c00ff), // High-energy ultraviolet
    colorB: new THREE.Color(0xff1268), // Relativistic hot magenta
    colorInterior: new THREE.Color(0x000002), // Event horizon black
    refractionIndex: 2.45,
    surfaceTension: 0.92,
  },
  particles: {
    count: 150000,
    speed: 1.85,
    curlScale: 4.8,
    trailDecay: 0.87,
    colorHue: 0.84, // Ultraviolet / Relativistic spectrum
    phosphorescence: 1.0,
  },
  simulation: {
    viscosity: 0.996,
    vorticity: 5.2,
    reactionFeed: 0.018,
    reactionKill: 0.051,
    slimeSensorAngle: 0.78,
    slimeSensorDist: 42.0,
    slimeStepSize: 3.2,
  },
  audio: {
    baseFrequency: 43.65, // F1 sub-bass singularity
    scale: 'harmonicMinor',
    droneIntensity: 0.96,
    filterCutoff: 850,
    reverbDecay: 8.5,
  },
};

/** All presets in ordered sequence */
export const PRESETS: PresetConfig[] = [
  PRESET_ABYSSAL_BLOOM,
  PRESET_NEBULAR_GYROID,
  PRESET_MYCELIAL_NEXUS,
  PRESET_TURING_CHRYSALIS,
  PRESET_SINGULARITY_FLUX,
];

/** Fast lookup record by preset name */
export const PRESET_MAP: Record<string, PresetConfig> = {
  [PRESET_ABYSSAL_BLOOM.name]: PRESET_ABYSSAL_BLOOM,
  [PRESET_NEBULAR_GYROID.name]: PRESET_NEBULAR_GYROID,
  [PRESET_MYCELIAL_NEXUS.name]: PRESET_MYCELIAL_NEXUS,
  [PRESET_TURING_CHRYSALIS.name]: PRESET_TURING_CHRYSALIS,
  [PRESET_SINGULARITY_FLUX.name]: PRESET_SINGULARITY_FLUX,
};

/**
 * Returns default starting preset (deep cloned)
 */
export function getDefaultPreset(): PresetConfig {
  return clonePreset(PRESET_ABYSSAL_BLOOM);
}

/**
 * Finds preset by exact or case-insensitive name match
 */
export function getPresetByName(name: string): PresetConfig | undefined {
  if (PRESET_MAP[name]) {
    return PRESET_MAP[name];
  }
  const lower = name.toLowerCase();
  return PRESETS.find((p) => p.name.toLowerCase() === lower);
}

/**
 * Deep clones a PresetConfig to avoid mutating shared references
 */
export function clonePreset(preset: PresetConfig): PresetConfig {
  return {
    name: preset.name,
    subtitle: preset.subtitle,
    description: preset.description,
    raymarch: {
      morphShape: preset.raymarch.morphShape,
      blendFactor: preset.raymarch.blendFactor,
      fractalIterations: preset.raymarch.fractalIterations,
      subsurfaceGlow: preset.raymarch.subsurfaceGlow,
      colorA: preset.raymarch.colorA.clone(),
      colorB: preset.raymarch.colorB.clone(),
      colorInterior: preset.raymarch.colorInterior.clone(),
      refractionIndex: preset.raymarch.refractionIndex,
      surfaceTension: preset.raymarch.surfaceTension,
    },
    particles: {
      count: preset.particles.count,
      speed: preset.particles.speed,
      curlScale: preset.particles.curlScale,
      trailDecay: preset.particles.trailDecay,
      colorHue: preset.particles.colorHue,
      phosphorescence: preset.particles.phosphorescence,
    },
    simulation: {
      viscosity: preset.simulation.viscosity,
      vorticity: preset.simulation.vorticity,
      reactionFeed: preset.simulation.reactionFeed,
      reactionKill: preset.simulation.reactionKill,
      slimeSensorAngle: preset.simulation.slimeSensorAngle,
      slimeSensorDist: preset.simulation.slimeSensorDist,
      slimeStepSize: preset.simulation.slimeStepSize,
    },
    audio: {
      baseFrequency: preset.audio.baseFrequency,
      scale: preset.audio.scale,
      droneIntensity: preset.audio.droneIntensity,
      filterCutoff: preset.audio.filterCutoff,
      reverbDecay: preset.audio.reverbDecay,
    },
  };
}

/**
 * Smoothly blends between two PresetConfig objects into an output target.
 * Useful for seamless morphing during preset changes.
 */
export function blendPresets(
  source: PresetConfig,
  target: PresetConfig,
  alpha: number,
  out?: PresetConfig
): PresetConfig {
  const t = Math.max(0, Math.min(1, alpha));
  const dest = out || clonePreset(source);

  dest.name = t < 0.5 ? source.name : target.name;
  dest.subtitle = t < 0.5 ? source.subtitle : target.subtitle;
  dest.description = t < 0.5 ? source.description : target.description;

  // Raymarch
  dest.raymarch.morphShape = t < 0.5 ? source.raymarch.morphShape : target.raymarch.morphShape;
  dest.raymarch.blendFactor = THREE.MathUtils.lerp(source.raymarch.blendFactor, target.raymarch.blendFactor, t);
  dest.raymarch.fractalIterations = Math.round(THREE.MathUtils.lerp(source.raymarch.fractalIterations, target.raymarch.fractalIterations, t));
  dest.raymarch.subsurfaceGlow = THREE.MathUtils.lerp(source.raymarch.subsurfaceGlow, target.raymarch.subsurfaceGlow, t);
  dest.raymarch.colorA.copy(source.raymarch.colorA).lerp(target.raymarch.colorA, t);
  dest.raymarch.colorB.copy(source.raymarch.colorB).lerp(target.raymarch.colorB, t);
  dest.raymarch.colorInterior.copy(source.raymarch.colorInterior).lerp(target.raymarch.colorInterior, t);
  dest.raymarch.refractionIndex = THREE.MathUtils.lerp(source.raymarch.refractionIndex, target.raymarch.refractionIndex, t);
  dest.raymarch.surfaceTension = THREE.MathUtils.lerp(source.raymarch.surfaceTension, target.raymarch.surfaceTension, t);

  // Particles
  dest.particles.count = Math.round(THREE.MathUtils.lerp(source.particles.count, target.particles.count, t));
  dest.particles.speed = THREE.MathUtils.lerp(source.particles.speed, target.particles.speed, t);
  dest.particles.curlScale = THREE.MathUtils.lerp(source.particles.curlScale, target.particles.curlScale, t);
  dest.particles.trailDecay = THREE.MathUtils.lerp(source.particles.trailDecay, target.particles.trailDecay, t);
  dest.particles.colorHue = THREE.MathUtils.lerp(source.particles.colorHue, target.particles.colorHue, t);
  dest.particles.phosphorescence = THREE.MathUtils.lerp(source.particles.phosphorescence, target.particles.phosphorescence, t);

  // Simulation
  dest.simulation.viscosity = THREE.MathUtils.lerp(source.simulation.viscosity, target.simulation.viscosity, t);
  dest.simulation.vorticity = THREE.MathUtils.lerp(source.simulation.vorticity, target.simulation.vorticity, t);
  dest.simulation.reactionFeed = THREE.MathUtils.lerp(source.simulation.reactionFeed, target.simulation.reactionFeed, t);
  dest.simulation.reactionKill = THREE.MathUtils.lerp(source.simulation.reactionKill, target.simulation.reactionKill, t);
  dest.simulation.slimeSensorAngle = THREE.MathUtils.lerp(source.simulation.slimeSensorAngle, target.simulation.slimeSensorAngle, t);
  dest.simulation.slimeSensorDist = THREE.MathUtils.lerp(source.simulation.slimeSensorDist, target.simulation.slimeSensorDist, t);
  dest.simulation.slimeStepSize = THREE.MathUtils.lerp(source.simulation.slimeStepSize, target.simulation.slimeStepSize, t);

  // Audio
  dest.audio.baseFrequency = THREE.MathUtils.lerp(source.audio.baseFrequency, target.audio.baseFrequency, t);
  dest.audio.scale = t < 0.5 ? source.audio.scale : target.audio.scale;
  dest.audio.droneIntensity = THREE.MathUtils.lerp(source.audio.droneIntensity, target.audio.droneIntensity, t);
  dest.audio.filterCutoff = THREE.MathUtils.lerp(source.audio.filterCutoff, target.audio.filterCutoff, t);
  dest.audio.reverbDecay = THREE.MathUtils.lerp(source.audio.reverbDecay, target.audio.reverbDecay, t);

  return dest;
}
