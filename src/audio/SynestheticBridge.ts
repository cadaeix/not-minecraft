import type { SimulationTelemetry, PresetConfig, ToolType } from '../types';
import { AudioSynthesis } from './AudioSynthesis';

export interface SynestheticPointerState {
  isDragging: boolean;
  pointerX: number; // Normalized -1.0 (left) to +1.0 (right)
  pointerY: number; // Normalized -1.0 (bottom) to +1.0 (top)
  deltaX?: number;
  deltaY?: number;
  activeTool?: ToolType;
  intensity?: number;
  particleVelocity?: number;
}

/**
 * SynestheticBridge
 *
 * Real-time bidirectional translation layer connecting physical/organic
 * simulation dynamics directly into Web Audio synthesis parameters.
 *
 * Core Synesthetic Mappings:
 * 1. Fluid Kinetic Energy    -> Drone harmonic richness & filter resonance.
 * 2. Particle Avg Velocity   -> Arpeggio rate multiplier & octave expansion.
 * 3. Physarum Biomass        -> Subtle microtonal drone detune & living vibrato depth.
 * 4. Active User Dragging    -> Continuous pitch bending & spatial stereo panning.
 *
 * Designed with zero per-frame garbage collection allocations:
 * all smoothing filters, interpolators, and rate limits operate on pre-allocated class fields.
 */
export class SynestheticBridge {
  private readonly audio: AudioSynthesis;

  // Smoothed telemetry filters (preventing parameter step jitter)
  private smoothedKineticEnergy = 0.0;
  private smoothedParticleVelocity = 0.0;
  private smoothedBiomass = 0.0;
  private smoothedEntropy = 0.0;

  // Smoothed user interaction parameters
  private smoothedPointerX = 0.0;
  private smoothedPointerY = 0.0;
  private smoothedPitchBend = 0.0;
  private isPointerDown = false;
  private lastDragSwirlTime = 0.0;
  private swirlAccumulator = 0.0;

  // Smoothing time factors (dt-independent alpha blending)
  private readonly kineticSmoothRate = 4.5;
  private readonly particleSmoothRate = 5.0;
  private readonly biomassSmoothRate = 2.0;
  private readonly pointerSmoothRate = 9.0;
  private readonly pitchBendSmoothRate = 12.0;

  // Dominant harmonic tracking
  private currentBaseFreq = 130.8128;
  private targetBaseFreq = 130.8128;

  constructor(audio: AudioSynthesis) {
    this.audio = audio;
  }

  /**
   * Primary per-frame update loop.
   * Feeds latest simulation telemetry and optional pointer/touch state into audio engine.
   * Zero per-frame object allocations.
   *
   * @param telemetry Snapshot of live physics/biology simulation metrics
   * @param pointer Optional user pointer / drag state
   * @param dt Elapsed frame time in seconds (clamped to prevent explosion on tab backgrounding)
   */
  public update(
    telemetry: SimulationTelemetry,
    pointer?: SynestheticPointerState,
    dt: number = 0.016
  ): void {
    const clampedDt = Math.min(0.1, Math.max(0.001, dt));

    // 1. FLUID KINETIC ENERGY MAPPING
    // Maps fluid turbulent energy into drone harmonic richness, cutoff frequency, and resonance Q.
    const rawKinetic = Math.max(0.0, telemetry.fluidKineticEnergy || 0.0);
    const normalizedKinetic = Math.min(1.0, rawKinetic / 5.5);
    const kineticAlpha = 1.0 - Math.exp(-this.kineticSmoothRate * clampedDt);
    this.smoothedKineticEnergy += (normalizedKinetic - this.smoothedKineticEnergy) * kineticAlpha;

    // Harmonic richness: more turbulence excites high overtones in celestial chord
    const harmonicRichness = 0.08 + 0.92 * Math.pow(this.smoothedKineticEnergy, 1.2);
    this.audio.setDroneHarmonicRichness(harmonicRichness);

    // Filter Cutoff: sweeps from warm deep ambient (260Hz) to open luminous space (3200Hz)
    const filterCutoffHz = 260.0 + 2940.0 * Math.pow(this.smoothedKineticEnergy, 1.4);
    this.audio.setFilterCutoff(filterCutoffHz);

    // Filter Resonance (Q): energetic fluid swirls create singing resonant whistle
    const filterResonanceQ = 1.4 + 5.6 * Math.pow(this.smoothedKineticEnergy, 1.5);
    this.audio.setFilterResonance(filterResonanceQ);

    // 2. PARTICLE AVERAGE VELOCITY MAPPING
    // Velocity accelerates generative arpeggio rate and expands its octave reach.
    let rawParticleSpeed = pointer?.particleVelocity;
    if (rawParticleSpeed === undefined || Number.isNaN(rawParticleSpeed)) {
      // If not directly supplied, estimate from entropy and kinetic energy
      rawParticleSpeed = (telemetry.entropy * 0.4 + rawKinetic * 0.6);
    }
    const normalizedParticleSpeed = Math.min(1.0, Math.max(0.0, rawParticleSpeed / 4.5));
    const particleAlpha = 1.0 - Math.exp(-this.particleSmoothRate * clampedDt);
    this.smoothedParticleVelocity += (normalizedParticleSpeed - this.smoothedParticleVelocity) * particleAlpha;

    // Arpeggio rate multiplier: 0.6x (tranquil, meditative) up to 2.8x (hyper-speed cosmic cascade)
    const arpRateMultiplier = 0.6 + 2.2 * this.smoothedParticleVelocity;
    this.audio.setArpRateMultiplier(arpRateMultiplier);

    // Arpeggio octave expansion: 1 octave at rest, expanding up to 4 octaves at full particle flow
    const octaves = 1 + Math.min(3, Math.floor(this.smoothedParticleVelocity * 3.6));
    this.audio.setArpOctaves(octaves);

    // 3. PHYSARUM BIOMASS MAPPING
    // Living slime mold growth introduces organic microtonal detuning and breathing vibrato.
    const rawBiomass = Math.max(0.0, telemetry.biomass || 0.0);
    const normalizedBiomass = Math.min(1.0, rawBiomass / 450.0);
    const biomassAlpha = 1.0 - Math.exp(-this.biomassSmoothRate * clampedDt);
    this.smoothedBiomass += (normalizedBiomass - this.smoothedBiomass) * biomassAlpha;

    // Subtle microtonal detune: 2 cents up to 22 cents variance among voices
    const detuneCents = 2.0 + 20.0 * this.smoothedBiomass;
    this.audio.setDroneDetune(detuneCents);

    // Living vibrato: biological pulsing shimmer depth
    const vibratoDepth = 0.8 + 8.5 * this.smoothedBiomass;
    this.audio.setVibratoDepth(vibratoDepth);

    // 4. ACTIVE USER DRAGGING & POINTER SPATIALIZATION
    if (pointer) {
      this.isPointerDown = pointer.isDragging;

      // Pointer X -> Stereo Panning [-1.0 left to +1.0 right]
      const clampedX = Math.max(-1.0, Math.min(1.0, pointer.pointerX));
      const pointerAlpha = 1.0 - Math.exp(-this.pointerSmoothRate * clampedDt);
      this.smoothedPointerX += (clampedX - this.smoothedPointerX) * pointerAlpha;
      this.audio.setPanning(this.smoothedPointerX);

      // Pointer Y -> Microtonal pitch bend when dragging
      let targetPitchBend = 0.0;
      if (pointer.isDragging) {
        // Dragging vertically bends pitch smoothly up/down by up to +/- 180 cents (microtonal glide)
        const clampedY = Math.max(-1.0, Math.min(1.0, pointer.pointerY));
        targetPitchBend = clampedY * 180.0;

        // Detect high-speed swirling gestures for tactile sparkle chimes
        const dX = pointer.deltaX || 0.0;
        const dY = pointer.deltaY || 0.0;
        const gestureMotion = Math.sqrt(dX * dX + dY * dY);

        if (gestureMotion > 0.04) {
          this.swirlAccumulator += gestureMotion;
          const nowMs = performance.now();
          if (this.swirlAccumulator > 0.35 && nowMs - this.lastDragSwirlTime > 380) {
            this.lastDragSwirlTime = nowMs;
            this.swirlAccumulator = 0.0;
            // Trigger soft crystalline chime at scale frequency
            const chimeFreq = 440.0 * Math.pow(2.0, (clampedY * 8.0) / 12.0);
            this.audio.triggerChime(chimeFreq, 0.45);
          }
        }
      } else {
        this.swirlAccumulator = 0.0;
      }

      const pitchAlpha = 1.0 - Math.exp(-this.pitchBendSmoothRate * clampedDt);
      this.smoothedPitchBend += (targetPitchBend - this.smoothedPitchBend) * pitchAlpha;
      this.audio.setPitchBend(this.smoothedPitchBend);
    } else {
      // Natural decay of pitch bend to center when no pointer interaction
      const pitchAlpha = 1.0 - Math.exp(-this.pitchBendSmoothRate * clampedDt);
      this.smoothedPitchBend += (0.0 - this.smoothedPitchBend) * pitchAlpha;
      this.audio.setPitchBend(this.smoothedPitchBend);
    }

    // 5. DOMINANT HARMONIC SYNCHRONIZATION
    // If the simulation reports an emergent physical dominant harmonic frequency,
    // gently anchor the celestial drone root to create deep acoustic cohesion.
    if (telemetry.dominantHarmonicHz && telemetry.dominantHarmonicHz > 40 && telemetry.dominantHarmonicHz < 440) {
      this.targetBaseFreq = telemetry.dominantHarmonicHz;
      const baseFreqAlpha = 1.0 - Math.exp(-0.8 * clampedDt);
      this.currentBaseFreq += (this.targetBaseFreq - this.currentBaseFreq) * baseFreqAlpha;
      this.audio.setBaseFrequency(this.currentBaseFreq);
    }
  }

  /**
   * Responds to discrete user interaction clicks and tactile tool triggers.
   *
   * @param tool Active organic sculpting tool
   * @param intensity Strength or pressure of the tool [0.0 - 1.0]
   * @param normalizedX Screen position X [-1.0 to +1.0]
   * @param normalizedY Screen position Y [-1.0 to +1.0]
   */
  public onToolTrigger(
    tool: ToolType,
    intensity: number = 0.8,
    normalizedX: number = 0.0,
    normalizedY: number = 0.0
  ): void {
    // Spatial positioning
    this.audio.setPanning(Math.max(-1.0, Math.min(1.0, normalizedX)));

    switch (tool) {
      case 'graviton_push':
      case 'graviton_pull': {
        // Gravitational singularities trigger heavy cosmic sub-bass drop
        this.audio.triggerGravitonShock(intensity);
        break;
      }

      case 'chromatic_pulse': {
        // Light wave pulse triggers bright crystalline modal physical chime
        const baseNoteFreq = 528.0 * (1.0 + normalizedY * 0.35); // 528Hz Solfeggio light octave
        this.audio.triggerChime(baseNoteFreq, 0.95);
        break;
      }

      case 'vortex': {
        // Fluid vortex triggers fluid swirling chime
        const vortexFreq = 396.0 * (1.0 + (normalizedX + normalizedY) * 0.2);
        this.audio.triggerChime(vortexFreq, 0.65);
        break;
      }

      case 'phase_melt': {
        // Topology mutation triggers dual bell resonance
        const meltFreq = 639.0;
        this.audio.triggerChime(meltFreq, 0.75);
        break;
      }

      case 'mycelium_spore':
      case 'turing_seed': {
        // Biological seeding triggers soft tactile droplet tone
        const sporeFreq = 741.0 * (1.0 + normalizedY * 0.25);
        this.audio.triggerChime(sporeFreq, 0.45);
        break;
      }

      default: {
        this.audio.triggerChime(undefined, 0.6);
        break;
      }
    }
  }

  /**
   * Pointer down event hook for direct UI integration.
   */
  public onPointerDown(normalizedX: number, normalizedY: number, tool?: ToolType): void {
    this.isPointerDown = true;
    if (tool) {
      this.onToolTrigger(tool, 0.8, normalizedX, normalizedY);
    } else {
      this.audio.triggerChime(undefined, 0.5);
    }
  }

  /**
   * Pointer move event hook.
   */
  public onPointerMove(normalizedX: number, normalizedY: number, isDragging: boolean): void {
    this.isPointerDown = isDragging;
    this.audio.setPanning(Math.max(-1.0, Math.min(1.0, normalizedX)));
  }

  /**
   * Pointer up event hook.
   */
  public onPointerUp(): void {
    this.isPointerDown = false;
  }

  /**
   * Synchronizes audio engine settings with a PresetConfig.
   */
  public syncPreset(preset: PresetConfig): void {
    if (!preset || !preset.audio) return;
    this.audio.applyPreset(preset.audio);
    if (preset.audio.baseFrequency) {
      this.currentBaseFreq = preset.audio.baseFrequency;
      this.targetBaseFreq = preset.audio.baseFrequency;
    }
  }

  /**
   * Cleans up bridge resources.
   */
  public dispose(): void {
    this.swirlAccumulator = 0.0;
    this.isPointerDown = false;
  }
}

export default SynestheticBridge;
