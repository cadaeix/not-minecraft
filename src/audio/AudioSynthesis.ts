import type { PresetConfig } from '../types';

export type ScaleName = 'lydian' | 'harmonicMinor' | 'microtonal' | 'pentatonic' | 'celestial';

export interface DroneVoiceConfig {
  osc: OscillatorNode;
  gain: GainNode;
  baseRatio: number;
  detuneCents: number;
  type: OscillatorType;
}

/**
 * Procedural impulse response generator for cosmic, lush, cavernous reverb.
 * Employs sparse early reflection delay taps combined with exponential
 * decay noise filtered via progressive low-pass frequency damping.
 */
function createCosmicReverbBuffer(
  ctx: AudioContext,
  durationSeconds: number = 4.0,
  decayRate: number = 2.8
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Early reflection tap delays (seconds) and stereo spatial distributions
  const earlyReflections = [
    { t: 0.017, gainL: 0.65, gainR: 0.35 },
    { t: 0.031, gainL: 0.38, gainR: 0.62 },
    { t: 0.053, gainL: 0.55, gainR: 0.45 },
    { t: 0.079, gainL: 0.28, gainR: 0.58 },
    { t: 0.113, gainL: 0.48, gainR: 0.32 },
    { t: 0.149, gainL: 0.35, gainR: 0.40 },
  ];

  for (let i = 0; i < earlyReflections.length; i++) {
    const tap = earlyReflections[i];
    const idx = Math.floor(tap.t * sampleRate);
    if (idx < length) {
      left[idx] += tap.gainL * 0.45;
      right[idx] += tap.gainR * 0.45;
    }
  }

  // Progressive high-frequency damping simulation for vast interstellar space
  let filterL = 0;
  let filterR = 0;
  const dampingAlpha = 0.085;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Multi-stage exponential decay envelope
    const envelope = Math.exp(-t * (3.2 / Math.max(0.1, decayRate)));

    // Uncorrelated stereo noise
    const whiteL = Math.random() * 2.0 - 1.0;
    const whiteR = Math.random() * 2.0 - 1.0;

    // One-pole lowpass smoothing
    filterL = filterL + (whiteL - filterL) * (1.0 - dampingAlpha);
    filterR = filterR + (whiteR - filterR) * (1.0 - dampingAlpha);

    // Subtle stereo flutter
    const flutterL = Math.sin(t * 1.5) * 0.08;
    const flutterR = Math.cos(t * 1.7) * 0.08;

    left[i] += (filterL * (1.0 + flutterL)) * envelope * 0.55;
    right[i] += (filterR * (1.0 + flutterR)) * envelope * 0.55;
  }

  // Peak normalization to prevent digital distortion
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const absL = Math.abs(left[i]);
    const absR = Math.abs(right[i]);
    if (absL > peak) peak = absL;
    if (absR > peak) peak = absR;
  }

  if (peak > 0.0001) {
    const invPeak = 0.85 / peak;
    for (let i = 0; i < length; i++) {
      left[i] *= invPeak;
      right[i] *= invPeak;
    }
  }

  return buffer;
}

/**
 * Pure Web Audio API Procedural Synthesizer Engine.
 * Zero external audio samples. Generates organic celestial drones,
 * algorithmic generative arpeggios, tactile modal chimes, and
 * deep sub-bass graviton sweeps.
 */
export class AudioSynthesis {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private started = false;
  private isDisposed = false;

  // Master Signal Chain Nodes
  private masterInputNode: GainNode | null = null;
  private masterVolumeNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private convolverNode: ConvolverNode | null = null;
  private dryGainNode: GainNode | null = null;
  private wetGainNode: GainNode | null = null;

  // Master filter for global timbre control
  private masterFilterNode: BiquadFilterNode | null = null;

  // Drone Engine Nodes
  private droneBusNode: GainNode | null = null;
  private droneFilterNode: BiquadFilterNode | null = null;
  private droneFilterLfoNode: OscillatorNode | null = null;
  private droneFilterLfoGainNode: GainNode | null = null;
  private droneVibratoLfoNode: OscillatorNode | null = null;
  private droneVibratoGainNode: GainNode | null = null;
  private droneVoices: DroneVoiceConfig[] = [];
  private droneHarmonicNodes: GainNode[] = [];

  // Arpeggiator / Generative Sequencer
  private arpBusNode: GainNode | null = null;
  private arpFilterNode: BiquadFilterNode | null = null;
  private arpTimerId: number | null = null;
  private nextNoteTime = 0;
  private arpCurrentIndex = 0;
  private arpDirection = 1;
  private arpBaseOctave = 0;
  private tempoBpm = 76;
  private arpRateMultiplier = 1.0;
  private arpOctaveSpread = 2;
  private currentScale: ScaleName = 'celestial';
  private baseFrequency = 130.8128; // C3
  private pitchBendCents = 0;

  // Physical Chimes Bus
  private chimeBusNode: GainNode | null = null;

  // Graviton Shockwave Sub-bass Bus
  private gravitonBusNode: GainNode | null = null;
  private gravitonFilterNode: BiquadFilterNode | null = null;

  // Internal parameter states
  private targetDroneIntensity = 0.6;
  private targetFilterCutoff = 800;
  private targetFilterQ = 2.0;
  private targetHarmonicRichness = 0.5;
  private targetDroneDetune = 6.0;
  private targetVibratoDepth = 3.0;
  private targetPanning = 0.0;
  private targetMasterVolume = 0.85;
  private reverbDecaySeconds = 3.8;
  private reverbWetAmount = 0.42;

  // Unlock listener reference
  private unlockHandler: (() => void) | null = null;

  // Scale interval tables (semitone ratios from root)
  private readonly scaleDefinitions: Record<ScaleName, number[]> = {
    lydian: [0, 2, 4, 6, 7, 9, 11], // 1, 2, 3, #4, 5, 6, 7 (Floating, mystical)
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11], // Exotic, ancient, mysterious
    pentatonic: [0, 2, 4, 7, 9], // Universal organic peace
    microtonal: [0, 1.5, 3.5, 5.0, 7.0, 8.5, 10.5], // 24-EDO neutral 3rd/7th micro-intervals
    celestial: [0, 4, 7, 11, 14, 18, 21] // Maj9, #11, 13 interstellar chords
  };

  constructor() {
    // AudioContext creation is deferred to init() or first user interaction
  }

  /**
   * Initializes the AudioContext, builds the master routing graph,
   * procedural reverb impulse response, drone engine, and modal chime bus.
   */
  public init(): void {
    if (this.initialized || this.isDisposed) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('AudioSynthesis: Web Audio API is not supported in this browser.');
        return;
      }
      this.ctx = new AudioCtxClass();
    } catch (err) {
      console.warn('AudioSynthesis: Failed to create AudioContext:', err);
      return;
    }

    this.setupUnlockListeners();
    this.buildMasterSignalChain();
    this.buildPolyphonicDroneEngine();
    this.buildArpeggiatorEngine();
    this.buildChimeEngine();
    this.buildGravitonEngine();

    this.initialized = true;
  }

  /**
   * Automatically unlocks suspended Web AudioContext on first user interaction gesture.
   */
  private setupUnlockListeners(): void {
    if (!this.ctx) return;

    this.unlockHandler = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch((err) => console.warn('AudioSynthesis resume error:', err));
      }
      this.removeUnlockListeners();
    };

    window.addEventListener('pointerdown', this.unlockHandler, { passive: true, once: true });
    window.addEventListener('keydown', this.unlockHandler, { passive: true, once: true });
    window.addEventListener('touchstart', this.unlockHandler, { passive: true, once: true });
  }

  private removeUnlockListeners(): void {
    if (this.unlockHandler) {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
      window.removeEventListener('touchstart', this.unlockHandler);
      this.unlockHandler = null;
    }
  }

  /**
   * Master signal chain:
   * Master Input -> DynamicsCompressorNode -> Stereo Panner -> Custom ConvolverNode (procedural algorithmic impulse response for lush cosmic reverb).
   * Parallel Dry / Reverb Wet blend into Master Volume -> Destination.
   */
  private buildMasterSignalChain(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Master input summation bus
    this.masterInputNode = ctx.createGain();
    this.masterInputNode.gain.setValueAtTime(1.0, ctx.currentTime);

    // Global resonant filter
    this.masterFilterNode = ctx.createBiquadFilter();
    this.masterFilterNode.type = 'lowpass';
    this.masterFilterNode.frequency.setValueAtTime(this.targetFilterCutoff, ctx.currentTime);
    this.masterFilterNode.Q.setValueAtTime(this.targetFilterQ, ctx.currentTime);

    // Dynamics Compressor to glue the cosmic soundscape and prevent digital clipping
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-22.0, ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(24.0, ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(6.0, ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.005, ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.24, ctx.currentTime);

    // Stereo Panner
    if (typeof ctx.createStereoPanner === 'function') {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(this.targetPanning, ctx.currentTime);
    }

    // Procedural Algorithmic Impulse Reverb
    this.convolverNode = ctx.createConvolver();
    this.convolverNode.buffer = createCosmicReverbBuffer(ctx, this.reverbDecaySeconds, 2.8);
    this.convolverNode.normalize = true;

    // Dry / Wet Reverb Splitters
    this.dryGainNode = ctx.createGain();
    this.dryGainNode.gain.setValueAtTime(1.0 - this.reverbWetAmount * 0.5, ctx.currentTime);

    this.wetGainNode = ctx.createGain();
    this.wetGainNode.gain.setValueAtTime(this.reverbWetAmount, ctx.currentTime);

    // Master Volume Output
    this.masterVolumeNode = ctx.createGain();
    this.masterVolumeNode.gain.setValueAtTime(this.targetMasterVolume, ctx.currentTime);

    // Connect:
    // masterInput -> masterFilter -> compressor -> [panner] -> (dryGain & convolver -> wetGain) -> masterVolume -> destination
    this.masterInputNode.connect(this.masterFilterNode);
    this.masterFilterNode.connect(this.compressorNode);

    if (this.pannerNode) {
      this.compressorNode.connect(this.pannerNode);
      this.pannerNode.connect(this.dryGainNode);
      this.pannerNode.connect(this.convolverNode);
    } else {
      this.compressorNode.connect(this.dryGainNode);
      this.compressorNode.connect(this.convolverNode);
    }

    this.convolverNode.connect(this.wetGainNode);

    this.dryGainNode.connect(this.masterVolumeNode);
    this.wetGainNode.connect(this.masterVolumeNode);

    this.masterVolumeNode.connect(ctx.destination);
  }

  /**
   * Polyphonic Drone Engine:
   * 6 detuned oscillators (Sine, Triangle, Sawtooth with lowpass filter)
   * creating rich celestial microtonal drone chords.
   * LFOs modulating filter cutoff and subtle vibrato.
   */
  private buildPolyphonicDroneEngine(): void {
    if (!this.ctx || !this.masterInputNode) return;
    const ctx = this.ctx;

    // Drone bus
    this.droneBusNode = ctx.createGain();
    this.droneBusNode.gain.setValueAtTime(this.targetDroneIntensity, ctx.currentTime);

    // Dedicated drone lowpass filter
    this.droneFilterNode = ctx.createBiquadFilter();
    this.droneFilterNode.type = 'lowpass';
    this.droneFilterNode.frequency.setValueAtTime(480, ctx.currentTime);
    this.droneFilterNode.Q.setValueAtTime(2.5, ctx.currentTime);

    // LFO 1: Modulates filter cutoff for slow cosmic respiration
    this.droneFilterLfoNode = ctx.createOscillator();
    this.droneFilterLfoNode.type = 'sine';
    this.droneFilterLfoNode.frequency.setValueAtTime(0.09, ctx.currentTime); // ~11 second period

    this.droneFilterLfoGainNode = ctx.createGain();
    this.droneFilterLfoGainNode.gain.setValueAtTime(180, ctx.currentTime); // +/- 180 Hz cutoff sweep
    this.droneFilterLfoNode.connect(this.droneFilterLfoGainNode);
    this.droneFilterLfoGainNode.connect(this.droneFilterNode.frequency);

    // LFO 2: Modulates subtle microtonal pitch vibrato
    this.droneVibratoLfoNode = ctx.createOscillator();
    this.droneVibratoLfoNode.type = 'sine';
    this.droneVibratoLfoNode.frequency.setValueAtTime(0.18, ctx.currentTime);

    this.droneVibratoGainNode = ctx.createGain();
    this.droneVibratoGainNode.gain.setValueAtTime(this.targetVibratoDepth, ctx.currentTime);
    this.droneVibratoLfoNode.connect(this.droneVibratoGainNode);

    // 6 Detuned Celestial Drone Voices:
    // 1: Sub-octave root (0.5x, Sine)
    // 2: Fundamental root (1.0x, Sine)
    // 3: Fundamental root detuned (1.0x, Triangle)
    // 4: Pure 5th (1.5x, Sine)
    // 5: Tenth / Compound 3rd (2.5x, Triangle)
    // 6: Interstellar 9th/Overtone (3.0x, Sawtooth through smoothing filter)
    const voiceSpecs: Array<{ ratio: number; detune: number; type: OscillatorType; gain: number; isHarmonic?: boolean }> = [
      { ratio: 0.5, detune: -2.0, type: 'sine', gain: 0.40 },
      { ratio: 1.0, detune: -4.5, type: 'sine', gain: 0.32 },
      { ratio: 1.0, detune: +5.5, type: 'triangle', gain: 0.28 },
      { ratio: 1.5, detune: +2.0, type: 'sine', gain: 0.24 },
      { ratio: 2.5, detune: -6.0, type: 'triangle', gain: 0.16, isHarmonic: true },
      { ratio: 3.0, detune: +7.0, type: 'sawtooth', gain: 0.10, isHarmonic: true }
    ];

    this.droneVoices = [];
    this.droneHarmonicNodes = [];

    for (let i = 0; i < voiceSpecs.length; i++) {
      const spec = voiceSpecs[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = spec.type;
      osc.frequency.setValueAtTime(this.baseFrequency * spec.ratio, ctx.currentTime);
      osc.detune.setValueAtTime(spec.detune, ctx.currentTime);

      gain.gain.setValueAtTime(spec.gain, ctx.currentTime);

      // Connect vibrato to oscillator detune
      this.droneVibratoGainNode.connect(osc.detune);

      // Dedicated lowpass for sawtooth voice to soften harsh edges
      if (spec.type === 'sawtooth') {
        const sawFilter = ctx.createBiquadFilter();
        sawFilter.type = 'lowpass';
        sawFilter.frequency.setValueAtTime(900, ctx.currentTime);
        osc.connect(sawFilter);
        sawFilter.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(this.droneFilterNode);

      this.droneVoices.push({
        osc,
        gain,
        baseRatio: spec.ratio,
        detuneCents: spec.detune,
        type: spec.type
      });

      if (spec.isHarmonic) {
        this.droneHarmonicNodes.push(gain);
      }
    }

    this.droneFilterNode.connect(this.droneBusNode);
    this.droneBusNode.connect(this.masterInputNode);
  }

  /**
   * Generative Arpeggiator / Melody Sequencer:
   * Employs FM synthesis bell pairs with exponential decay envelopes.
   * Lookahead timing scheduler avoids jitter.
   */
  private buildArpeggiatorEngine(): void {
    if (!this.ctx || !this.masterInputNode) return;
    const ctx = this.ctx;

    this.arpBusNode = ctx.createGain();
    this.arpBusNode.gain.setValueAtTime(0.48, ctx.currentTime);

    this.arpFilterNode = ctx.createBiquadFilter();
    this.arpFilterNode.type = 'lowpass';
    this.arpFilterNode.frequency.setValueAtTime(2600, ctx.currentTime);
    this.arpFilterNode.Q.setValueAtTime(1.5, ctx.currentTime);

    this.arpBusNode.connect(this.arpFilterNode);
    this.arpFilterNode.connect(this.masterInputNode);
  }

  /**
   * Modal Resonance Physical Chimes:
   * Produces crystalline non-harmonic bell overtones (1.0, 2.76, 5.4, 8.9)
   * with exponential decay envelopes on tactile interaction.
   */
  private buildChimeEngine(): void {
    if (!this.ctx || !this.masterInputNode) return;
    const ctx = this.ctx;

    this.chimeBusNode = ctx.createGain();
    this.chimeBusNode.gain.setValueAtTime(0.65, ctx.currentTime);
    this.chimeBusNode.connect(this.masterInputNode);
  }

  /**
   * Sub-bass Graviton Drop:
   * Resonant low-pass sweep for gravitational singularities.
   */
  private buildGravitonEngine(): void {
    if (!this.ctx || !this.masterInputNode) return;
    const ctx = this.ctx;

    this.gravitonBusNode = ctx.createGain();
    this.gravitonBusNode.gain.setValueAtTime(0.85, ctx.currentTime);

    this.gravitonFilterNode = ctx.createBiquadFilter();
    this.gravitonFilterNode.type = 'lowpass';
    this.gravitonFilterNode.frequency.setValueAtTime(180, ctx.currentTime);
    this.gravitonFilterNode.Q.setValueAtTime(6.0, ctx.currentTime);

    this.gravitonBusNode.connect(this.gravitonFilterNode);
    this.gravitonFilterNode.connect(this.masterInputNode);
  }

  /**
   * Resumes the AudioContext and starts the continuous drone oscillators
   * and generative arpeggio sequencer loop.
   */
  public start(): void {
    if (!this.initialized) {
      this.init();
    }
    if (!this.ctx || this.started || this.isDisposed) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => console.warn('AudioSynthesis start resume error:', err));
    }

    const now = this.ctx.currentTime;

    // Start drone oscillators and LFOs
    try {
      this.droneFilterLfoNode?.start(now);
      this.droneVibratoLfoNode?.start(now);

      for (let i = 0; i < this.droneVoices.length; i++) {
        this.droneVoices[i].osc.start(now);
      }
    } catch {
      // Ignore if already started
    }

    // Start Arpeggiator Clock
    this.nextNoteTime = now + 0.1;
    this.startArpScheduler();

    this.started = true;
  }

  /**
   * Resumes AudioContext if suspended.
   */
  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Lookahead Arpeggiator Scheduler (Chris Wilson Web Audio timer pattern)
   */
  private startArpScheduler(): void {
    if (this.arpTimerId !== null) return;

    const lookaheadMs = 25;
    const scheduleAheadSec = 0.12;

    const tick = () => {
      if (!this.ctx || !this.started || this.isDisposed) return;

      while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadSec) {
        this.scheduleNextArpNote(this.nextNoteTime);
        this.advanceArpStep();
      }
    };

    this.arpTimerId = window.setInterval(tick, lookaheadMs);
  }

  /**
   * Computes scale frequency given base note, interval semitones, and octave.
   */
  private computeNoteFrequency(scaleDegree: number, octaveOffset: number): number {
    const scale = this.scaleDefinitions[this.currentScale] || this.scaleDefinitions.celestial;
    const scaleLength = scale.length;

    const octave = octaveOffset + Math.floor(scaleDegree / scaleLength);
    const degreeIndex = ((scaleDegree % scaleLength) + scaleLength) % scaleLength;
    const semitones = scale[degreeIndex] + octave * 12;

    // Equal temperament frequency calculation relative to base frequency
    let freq = this.baseFrequency * Math.pow(2.0, semitones / 12.0);

    // Apply pitch bend if active
    if (this.pitchBendCents !== 0) {
      freq *= Math.pow(2.0, this.pitchBendCents / 1200.0);
    }

    return freq;
  }

  /**
   * Generates next arpeggiator step using organic bounded random walks and gentle leap probabilities.
   */
  private advanceArpStep(): void {
    const scale = this.scaleDefinitions[this.currentScale] || this.scaleDefinitions.celestial;
    const scaleLen = scale.length;

    // 75% step in current direction, 15% leap, 10% change direction
    const roll = Math.random();

    if (roll < 0.10) {
      this.arpDirection = -this.arpDirection;
    }

    if (roll < 0.25) {
      // Leap octave or interval
      this.arpBaseOctave = Math.floor(Math.random() * Math.max(1, this.arpOctaveSpread));
      this.arpCurrentIndex = (this.arpCurrentIndex + Math.floor(Math.random() * 3 + 2)) % scaleLen;
    } else {
      this.arpCurrentIndex += this.arpDirection;
      if (this.arpCurrentIndex >= scaleLen) {
        this.arpCurrentIndex = 0;
        this.arpBaseOctave = (this.arpBaseOctave + 1) % Math.max(1, this.arpOctaveSpread);
      } else if (this.arpCurrentIndex < 0) {
        this.arpCurrentIndex = scaleLen - 1;
        this.arpBaseOctave = (this.arpBaseOctave - 1 + this.arpOctaveSpread) % Math.max(1, this.arpOctaveSpread);
      }
    }

    // Advance clock time
    const secondsPerBeat = 60.0 / Math.max(20, this.tempoBpm);
    const stepDuration = (secondsPerBeat * 0.5) / Math.max(0.2, this.arpRateMultiplier);
    this.nextNoteTime += stepDuration;
  }

  /**
   * Schedules a single FM synthesis bell/chime note at precise audio time.
   */
  private scheduleNextArpNote(time: number): void {
    if (!this.ctx || !this.arpBusNode || this.isDisposed) return;
    const ctx = this.ctx;

    // Occasional rest (8% probability) for natural breath/space
    if (Math.random() < 0.08) return;

    const freq = this.computeNoteFrequency(this.arpCurrentIndex, this.arpBaseOctave);
    if (freq < 20 || freq > 14000) return;

    const noteDuration = (60.0 / Math.max(20, this.tempoBpm)) * (0.8 / Math.max(0.2, this.arpRateMultiplier));

    // FM Synthesis Note: Carrier (Sine) + Modulator (Sine)
    const carrierOsc = ctx.createOscillator();
    const carrierGain = ctx.createGain();

    const modOsc = ctx.createOscillator();
    const modGain = ctx.createGain();

    // Modulator frequency ratio: 2.0 or 3.0 gives shimmering glass/crystal harmonic spectrum
    const modRatio = (this.currentScale === 'microtonal' || this.currentScale === 'harmonicMinor') ? 2.76 : 2.0;
    modOsc.frequency.setValueAtTime(freq * modRatio, time);
    carrierOsc.frequency.setValueAtTime(freq, time);

    // Modulation Index envelope: high at attack, decays rapidly
    const modDepth = freq * 1.8;
    modGain.gain.setValueAtTime(modDepth, time);
    modGain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration * 0.7);

    modOsc.connect(modGain);
    modGain.connect(carrierOsc.frequency);

    // Carrier Amplitude envelope (crystalline attack, exponential decay)
    const attackTime = 0.008;
    carrierGain.gain.setValueAtTime(0.0001, time);
    carrierGain.gain.linearRampToValueAtTime(0.35, time + attackTime);
    carrierGain.gain.exponentialRampToValueAtTime(0.0001, time + noteDuration);

    // Per-note subtle stereo panning
    if (typeof ctx.createStereoPanner === 'function') {
      const notePanner = ctx.createStereoPanner();
      const panVal = (Math.random() * 1.2 - 0.6) + this.targetPanning * 0.4;
      notePanner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, panVal)), time);
      carrierOsc.connect(carrierGain);
      carrierGain.connect(notePanner);
      notePanner.connect(this.arpBusNode);
    } else {
      carrierOsc.connect(carrierGain);
      carrierGain.connect(this.arpBusNode);
    }

    carrierOsc.start(time);
    modOsc.start(time);

    const stopTime = time + noteDuration + 0.05;
    carrierOsc.stop(stopTime);
    modOsc.stop(stopTime);

    carrierOsc.onended = () => {
      carrierOsc.disconnect();
      carrierGain.disconnect();
      modOsc.disconnect();
      modGain.disconnect();
    };
  }

  /**
   * Modal Resonance Physical Chimes:
   * Triggered by user clicks/swirls: crystalline bell tones with non-harmonic overtones
   * (1.0, 2.76, 5.4, 8.9) and exponential decay.
   *
   * @param freq Fundamental frequency in Hz (defaults to scale note near 528 Hz - Solfeggio / DNA repair frequency)
   * @param brightness Tone brightness factor [0.0 - 1.0], controls overtone amplitudes and duration
   */
  public triggerChime(freq?: number, brightness: number = 0.7): void {
    if (!this.initialized) this.init();
    if (!this.ctx || !this.chimeBusNode || this.isDisposed) return;
    const ctx = this.ctx;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const baseF = freq && freq > 40 && freq < 6000
      ? freq
      : this.computeNoteFrequency(this.arpCurrentIndex + 4, 1);

    const clampedBrightness = Math.max(0.05, Math.min(1.0, brightness));
    const now = ctx.currentTime;

    // Physical modal resonance ratios for circular chiming plates/bars
    const modes = [
      { ratio: 1.00, gain: 0.55, decay: 2.8 * (0.6 + 0.4 * clampedBrightness) },
      { ratio: 2.76, gain: 0.32 * clampedBrightness, decay: 1.8 * (0.5 + 0.5 * clampedBrightness) },
      { ratio: 5.40, gain: 0.20 * Math.pow(clampedBrightness, 1.4), decay: 1.0 * (0.4 + 0.6 * clampedBrightness) },
      { ratio: 8.90, gain: 0.12 * Math.pow(clampedBrightness, 1.8), decay: 0.6 * (0.3 + 0.7 * clampedBrightness) }
    ];

    const panOffsets = [-0.25, 0.25, -0.12, 0.12];

    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i];
      const modeFreq = baseF * mode.ratio;
      if (modeFreq > 18000) continue;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(modeFreq, now);

      // Micro-attack (2ms) prevents transient digital click while preserving crisp strike
      const attackSec = 0.002;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(mode.gain, now + attackSec);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + mode.decay);

      // Subtle spatial distribution for each resonant mode
      if (typeof ctx.createStereoPanner === 'function') {
        const modePanner = ctx.createStereoPanner();
        const modePan = Math.max(-1.0, Math.min(1.0, this.targetPanning + panOffsets[i]));
        modePanner.pan.setValueAtTime(modePan, now);
        osc.connect(gain);
        gain.connect(modePanner);
        modePanner.connect(this.chimeBusNode);
      } else {
        osc.connect(gain);
        gain.connect(this.chimeBusNode);
      }

      osc.start(now);
      const stopTime = now + mode.decay + 0.02;
      osc.stop(stopTime);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  /**
   * Sub-bass Graviton Drop:
   * Deep 30-60Hz sine drop with resonant low-pass sweep for gravitational singularities.
   *
   * @param intensity Shockwave intensity [0.0 - 1.0]
   */
  public triggerGravitonShock(intensity: number = 0.8): void {
    if (!this.initialized) this.init();
    if (!this.ctx || !this.gravitonBusNode || this.isDisposed) return;
    const ctx = this.ctx;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const clampedIntensity = Math.max(0.1, Math.min(1.0, intensity));
    const now = ctx.currentTime;
    const duration = 1.8 + clampedIntensity * 0.8;

    // Sub-bass Sine drop: Sweeps from 65-80Hz down into deep 28-34Hz subsonic rumble
    const startFreq = 62.0 + clampedIntensity * 24.0;
    const endFreq = 28.0 + (1.0 - clampedIntensity) * 6.0;

    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(startFreq, now);
    subOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    // Harmonic layer (triangle wave) ensures chest-impact presence on smaller speakers/headphones
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(startFreq * 1.5, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(endFreq * 1.5, now + duration);

    // Dedicated filter sweep
    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    const startCutoff = 220.0 * (0.8 + 0.5 * clampedIntensity);
    sweepFilter.frequency.setValueAtTime(startCutoff, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(38.0, now + duration);
    sweepFilter.Q.setValueAtTime(7.0 * clampedIntensity + 2.0, now);

    // Sub-bass Gain envelope
    const subGain = ctx.createGain();
    const peakGain = 0.65 * clampedIntensity;
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(peakGain, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(peakGain * 0.35, now + 0.02);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.8);

    subOsc.connect(sweepFilter);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(sweepFilter);
    sweepFilter.connect(subGain);
    subGain.connect(this.gravitonBusNode);

    subOsc.start(now);
    bodyOsc.start(now);

    const stopTime = now + duration + 0.05;
    subOsc.stop(stopTime);
    bodyOsc.stop(stopTime);

    subOsc.onended = () => {
      subOsc.disconnect();
      bodyOsc.disconnect();
      sweepFilter.disconnect();
      subGain.disconnect();
      bodyGain.disconnect();
    };
  }

  /**
   * Sets overall polyphonic drone intensity smoothly using Web Audio setTargetAtTime.
   */
  public setDroneIntensity(val: number): void {
    this.targetDroneIntensity = Math.max(0.0, Math.min(1.0, val));
    if (this.ctx && this.droneBusNode) {
      this.droneBusNode.gain.setTargetAtTime(this.targetDroneIntensity, this.ctx.currentTime, 0.12);
    }
  }

  /**
   * Sets global lowpass filter cutoff frequency.
   */
  public setFilterCutoff(freq: number): void {
    this.targetFilterCutoff = Math.max(40, Math.min(18000, freq));
    if (this.ctx && this.masterFilterNode) {
      this.masterFilterNode.frequency.setTargetAtTime(this.targetFilterCutoff, this.ctx.currentTime, 0.08);
    }
  }

  /**
   * Sets global filter resonance (Q).
   */
  public setFilterResonance(q: number): void {
    this.targetFilterQ = Math.max(0.1, Math.min(18.0, q));
    if (this.ctx && this.masterFilterNode) {
      this.masterFilterNode.Q.setTargetAtTime(this.targetFilterQ, this.ctx.currentTime, 0.08);
    }
    if (this.ctx && this.droneFilterNode) {
      this.droneFilterNode.Q.setTargetAtTime(Math.min(8.0, this.targetFilterQ * 0.8), this.ctx.currentTime, 0.08);
    }
  }

  /**
   * Controls harmonic overtone richness in the drone engine (e.g. triangle and saw overtone levels).
   */
  public setDroneHarmonicRichness(richness: number): void {
    this.targetHarmonicRichness = Math.max(0.0, Math.min(1.0, richness));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < this.droneHarmonicNodes.length; i++) {
      const targetG = (0.05 + 0.35 * this.targetHarmonicRichness) * (1.0 / (i + 1));
      this.droneHarmonicNodes[i].gain.setTargetAtTime(targetG, now, 0.15);
    }
  }

  /**
   * Modulates subtle microtonal detuning among drone chord voices.
   */
  public setDroneDetune(cents: number): void {
    this.targetDroneDetune = Math.max(0.0, Math.min(45.0, cents));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < this.droneVoices.length; i++) {
      const voice = this.droneVoices[i];
      const sign = voice.detuneCents >= 0 ? 1 : -1;
      const targetCents = sign * (Math.abs(voice.detuneCents) + this.targetDroneDetune * 0.5);
      voice.osc.detune.setTargetAtTime(targetCents, now, 0.2);
    }
  }

  /**
   * Sets LFO vibrato depth for organic living shimmer.
   */
  public setVibratoDepth(depth: number): void {
    this.targetVibratoDepth = Math.max(0.0, Math.min(25.0, depth));
    if (this.ctx && this.droneVibratoGainNode) {
      this.droneVibratoGainNode.gain.setTargetAtTime(this.targetVibratoDepth, this.ctx.currentTime, 0.15);
    }
  }

  /**
   * Changes the musical scale for arpeggiator and melody generation.
   */
  public setScale(scaleName: PresetConfig['audio']['scale'] | string): void {
    const normalized = scaleName.toLowerCase();
    if (normalized.includes('lydian')) {
      this.currentScale = 'lydian';
    } else if (normalized.includes('harmonic') || normalized.includes('minor')) {
      this.currentScale = 'harmonicMinor';
    } else if (normalized.includes('penta')) {
      this.currentScale = 'pentatonic';
    } else if (normalized.includes('micro') || normalized.includes('pythagorean')) {
      this.currentScale = 'microtonal';
    } else {
      this.currentScale = 'celestial';
    }
  }

  /**
   * Sets arpeggiator tempo in BPM.
   */
  public setTempo(bpm: number): void {
    this.tempoBpm = Math.max(30, Math.min(240, bpm));
  }

  /**
   * Sets tempo multiplier for particle velocity mapping.
   */
  public setArpRateMultiplier(mult: number): void {
    this.arpRateMultiplier = Math.max(0.25, Math.min(4.0, mult));
  }

  /**
   * Sets number of octaves traversed by the arpeggiator (1 to 4).
   */
  public setArpOctaves(octaves: number): void {
    this.arpOctaveSpread = Math.max(1, Math.min(4, Math.floor(octaves)));
  }

  /**
   * Applies smooth pitch bend in cents (e.g. from active user dragging).
   */
  public setPitchBend(cents: number): void {
    this.pitchBendCents = Math.max(-600, Math.min(600, cents));
  }

  /**
   * Sets stereo panning position [-1.0 (full left) to +1.0 (full right)].
   */
  public setPanning(pan: number): void {
    this.targetPanning = Math.max(-1.0, Math.min(1.0, pan));
    if (this.ctx && this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(this.targetPanning, this.ctx.currentTime, 0.06);
    }
  }

  /**
   * Sets master output volume [0.0 - 1.0].
   */
  public setMasterVolume(vol: number): void {
    this.targetMasterVolume = Math.max(0.0, Math.min(1.5, vol));
    if (this.ctx && this.masterVolumeNode) {
      this.masterVolumeNode.gain.setTargetAtTime(this.targetMasterVolume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Updates base fundamental tuning frequency (e.g. C3 = 130.81 Hz).
   */
  public setBaseFrequency(freq: number): void {
    if (freq <= 20 || freq > 800) return;
    this.baseFrequency = freq;

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < this.droneVoices.length; i++) {
      const v = this.droneVoices[i];
      v.osc.frequency.setTargetAtTime(this.baseFrequency * v.baseRatio, now, 0.25);
    }
  }

  /**
   * Reconfigures procedural reverb decay length.
   */
  public setReverbDecay(decaySeconds: number): void {
    this.reverbDecaySeconds = Math.max(0.5, Math.min(12.0, decaySeconds));
    if (this.ctx && this.convolverNode) {
      this.convolverNode.buffer = createCosmicReverbBuffer(this.ctx, this.reverbDecaySeconds, 2.8);
    }
  }

  /**
   * Controls dry / reverb wet balance.
   */
  public setReverbWet(wet: number): void {
    this.reverbWetAmount = Math.max(0.0, Math.min(1.0, wet));
    if (this.ctx && this.dryGainNode && this.wetGainNode) {
      const now = this.ctx.currentTime;
      this.wetGainNode.gain.setTargetAtTime(this.reverbWetAmount, now, 0.08);
      this.dryGainNode.gain.setTargetAtTime(1.0 - this.reverbWetAmount * 0.45, now, 0.08);
    }
  }

  /**
   * Applies preset audio configuration.
   */
  public applyPreset(preset: PresetConfig['audio']): void {
    if (!preset) return;
    if (preset.baseFrequency) this.setBaseFrequency(preset.baseFrequency);
    if (preset.scale) this.setScale(preset.scale);
    if (preset.droneIntensity !== undefined) this.setDroneIntensity(preset.droneIntensity);
    if (preset.filterCutoff !== undefined) this.setFilterCutoff(preset.filterCutoff);
    if (preset.reverbDecay !== undefined) this.setReverbDecay(preset.reverbDecay);
  }

  /**
   * Pauses the audio synthesizer.
   */
  public stop(): void {
    if (this.arpTimerId !== null) {
      clearInterval(this.arpTimerId);
      this.arpTimerId = null;
    }
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
    this.started = false;
  }

  /**
   * Destroys all Web Audio nodes and closes the AudioContext.
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.stop();
    this.removeUnlockListeners();

    try {
      this.droneFilterLfoNode?.stop();
      this.droneVibratoLfoNode?.stop();
      for (let i = 0; i < this.droneVoices.length; i++) {
        this.droneVoices[i].osc.stop();
        this.droneVoices[i].osc.disconnect();
        this.droneVoices[i].gain.disconnect();
      }
      this.droneVoices = [];
      this.droneHarmonicNodes = [];

      this.masterInputNode?.disconnect();
      this.masterFilterNode?.disconnect();
      this.compressorNode?.disconnect();
      this.pannerNode?.disconnect();
      this.convolverNode?.disconnect();
      this.dryGainNode?.disconnect();
      this.wetGainNode?.disconnect();
      this.masterVolumeNode?.disconnect();
      this.droneBusNode?.disconnect();
      this.arpBusNode?.disconnect();
      this.chimeBusNode?.disconnect();
      this.gravitonBusNode?.disconnect();

      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
      }
    } catch {
      // Cleanup best effort
    }

    this.ctx = null;
    this.initialized = false;
  }

  // Getters
  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public isPlaying(): boolean {
    return this.started && this.ctx !== null && this.ctx.state === 'running';
  }

  public getScale(): ScaleName {
    return this.currentScale;
  }

  public getTempo(): number {
    return this.tempoBpm;
  }
}

export default AudioSynthesis;
