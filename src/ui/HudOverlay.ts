import { ToolType, SimulationTelemetry } from '../types';

export interface HudCallbacks {
  onToolSelect: (tool: ToolType) => void;
  onPresetSelect: (presetId: string) => void;
  onAudioToggle: () => Promise<boolean>;
  onCameraReset: () => void;
  onCameraModeToggle: () => string; // returns new mode name ('Orbit' | 'Free Glide')
  onImpulse: () => void;
  onClearAttractors: () => void;
}

export class HudOverlay {
  private callbacks: HudCallbacks;
  private currentTool: ToolType = 'vortex';
  private audioPlaying = false;
  private isGlideMode = false;

  // DOM Elements
  private fpsEl!: HTMLElement;
  private metricParticlesEl!: HTMLElement;
  private metricKineticEl!: HTMLElement;
  private metricEntropyEl!: HTMLElement;
  private metricBiomassEl!: HTMLElement;
  private metricHarmonicEl!: HTMLElement;

  private barParticlesEl!: HTMLElement;
  private barKineticEl!: HTMLElement;
  private barEntropyEl!: HTMLElement;
  private barBiomassEl!: HTMLElement;
  private barHarmonicEl!: HTMLElement;
  private metricLiquidEl!: HTMLElement;
  private barLiquidEl!: HTMLElement;
  private metricAttractorsEl!: HTMLElement;
  private barAttractorsEl!: HTMLElement;

  private audioBtn!: HTMLElement;
  private audioLabel!: HTMLElement;
  private camModeBtn!: HTMLElement;
  private camModeText!: HTMLElement;
  private camModeIcon!: HTMLElement;
  private infoModal!: HTMLElement;

  private toolButtons: Partial<Record<ToolType, HTMLElement>> = {};
  private presetButtons: Record<string, HTMLElement> = {};

  constructor(callbacks: HudCallbacks) {
    this.callbacks = callbacks;
    this.initElements();
    this.bindEvents();
  }

  private initElements() {
    this.fpsEl = document.getElementById('fps-counter')!;
    this.metricParticlesEl = document.getElementById('metric-particles')!;
    this.metricKineticEl = document.getElementById('metric-kinetic')!;
    this.metricEntropyEl = document.getElementById('metric-entropy')!;
    this.metricBiomassEl = document.getElementById('metric-biomass')!;
    this.metricHarmonicEl = document.getElementById('metric-harmonic')!;

    this.barParticlesEl = document.getElementById('bar-particles')!;
    this.barKineticEl = document.getElementById('bar-kinetic')!;
    this.barEntropyEl = document.getElementById('bar-entropy')!;
    this.barBiomassEl = document.getElementById('bar-biomass')!;
    this.barHarmonicEl = document.getElementById('bar-harmonic')!;
    this.metricLiquidEl = document.getElementById('metric-liquid')!;
    this.barLiquidEl = document.getElementById('bar-liquid')!;
    this.metricAttractorsEl = document.getElementById('metric-attractors')!;
    this.barAttractorsEl = document.getElementById('bar-attractors')!;

    this.audioBtn = document.getElementById('audio-toggle-btn')!;
    this.audioLabel = document.getElementById('audio-status-label')!;
    this.camModeBtn = document.getElementById('cam-mode-btn')!;
    this.camModeText = document.getElementById('cam-mode-text')!;
    this.camModeIcon = document.getElementById('cam-mode-icon')!;
    this.infoModal = document.getElementById('info-modal')!;

    // Tool buttons
    const toolBtns = document.querySelectorAll<HTMLElement>('.tool-btn');
    toolBtns.forEach(btn => {
      const tool = btn.dataset.tool as ToolType;
      if (tool) {
        this.toolButtons[tool] = btn;
      }
    });

    // Preset buttons
    const presetBtns = document.querySelectorAll<HTMLElement>('.preset-btn');
    presetBtns.forEach(btn => {
      const preset = btn.dataset.preset;
      if (preset) {
        this.presetButtons[preset] = btn;
      }
    });
  }

  private bindEvents() {
    // Tool buttons click
    for (const [tool, btn] of Object.entries(this.toolButtons) as [ToolType, HTMLElement][]) {
      btn.addEventListener('click', () => {
        this.selectTool(tool);
      });
    }

    // Preset buttons click
    for (const [presetId, btn] of Object.entries(this.presetButtons)) {
      btn.addEventListener('click', () => {
        this.selectPreset(presetId);
      });
    }
    // Audio toggle
    this.audioBtn.addEventListener('click', async () => {
      const active = await this.callbacks.onAudioToggle();
      this.setAudioState(active);
    });

    // Camera Mode toggle
    this.camModeBtn.addEventListener('click', () => {
      const newMode = this.callbacks.onCameraModeToggle();
      this.setCameraModeUI(newMode);
    });

    // Camera reset
    document.getElementById('cam-reset-btn')?.addEventListener('click', () => {
      this.callbacks.onCameraReset();
    });
    // Clear attractors button
    document.getElementById('clear-attractors-btn')?.addEventListener('click', () => {
      this.callbacks.onClearAttractors();
    });

    // Info modal toggle
    document.getElementById('info-toggle-btn')?.addEventListener('click', () => {
      this.infoModal.classList.remove('hidden');
    });

    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      this.infoModal.classList.add('hidden');
    });

    this.infoModal.addEventListener('click', (e) => {
      if (e.target === this.infoModal) {
        this.infoModal.classList.add('hidden');
      }
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '1': this.selectTool('vortex'); break;
        case '2': this.selectTool('graviton_pull'); break;
        case '3': this.selectTool('graviton_push'); break;
        case '4': this.selectTool('turing_seed'); break;
        case '5': this.selectTool('mycelium_spore'); break;
        case '6': this.selectTool('chromatic_pulse'); break;
        case '7': this.selectTool('phase_melt'); break;
        case '8': this.selectTool('liquid_spray'); break;
        case '9': this.selectTool('place_attractor'); break;
        case 'x':
        case 'X':
          this.callbacks.onClearAttractors();
          break;

        case 'c':
        case 'C': {
          const newMode = this.callbacks.onCameraModeToggle();
          this.setCameraModeUI(newMode);
          break;
        }
        case 'r':
        case 'R':
          this.callbacks.onCameraReset();
          break;

        case 'm':
        case 'M':
          this.audioBtn.click();
          break;

        case ' ':
          e.preventDefault();
          this.callbacks.onImpulse();
          break;

        case '?':
          this.infoModal.classList.toggle('hidden');
          break;

        case 'Escape':
          this.infoModal.classList.add('hidden');
          break;
      }
    });
  }

  public selectTool(tool: ToolType) {
    this.currentTool = tool;
    for (const [t, btn] of Object.entries(this.toolButtons) as [ToolType, HTMLElement][]) {
      if (t === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    this.callbacks.onToolSelect(tool);
  }

  public selectPreset(presetId: string) {
    for (const [id, btn] of Object.entries(this.presetButtons)) {
      if (id === presetId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
    this.callbacks.onPresetSelect(presetId);
  }

  public setAudioState(active: boolean) {
    this.audioPlaying = active;
    if (active) {
      this.audioBtn.classList.add('playing');
      this.audioLabel.textContent = 'AUDIO ON';
    } else {
      this.audioBtn.classList.remove('playing');
      this.audioLabel.textContent = 'AUDIO OFF';
    }
  }

  public setCameraModeUI(modeName: string) {
    this.isGlideMode = modeName.toLowerCase().includes('glide');
    if (this.isGlideMode) {
      this.camModeIcon.textContent = '🚀';
      this.camModeText.textContent = 'Free Glide';
    } else {
      this.camModeIcon.textContent = '🔄';
      this.camModeText.textContent = 'Orbit Mode';
    }
  }

  public updateTelemetry(t: SimulationTelemetry) {
    this.fpsEl.textContent = `${Math.round(t.fps)} FPS`;
    this.metricParticlesEl.textContent = t.particleCount.toLocaleString();
    this.metricKineticEl.textContent = `${t.fluidKineticEnergy.toFixed(2)} J`;
    this.metricEntropyEl.textContent = t.entropy.toFixed(3);
    this.metricBiomassEl.textContent = `${(t.biomass / 1000).toFixed(1)} k`;
    this.metricHarmonicEl.textContent = `${t.dominantHarmonicHz.toFixed(1)} Hz`;

    // Visual bars
    this.barParticlesEl.style.width = `${Math.min(100, (t.particleCount / 150000) * 100)}%`;
    this.barKineticEl.style.width = `${Math.min(100, t.fluidKineticEnergy * 10)}%`;
    this.barEntropyEl.style.width = `${Math.min(100, t.entropy * 100)}%`;
    this.barBiomassEl.style.width = `${Math.min(100, (t.biomass / 50000) * 100)}%`;
    this.barHarmonicEl.style.width = `${Math.min(100, (t.dominantHarmonicHz / 880) * 100)}%`;
    if (this.metricLiquidEl) {
      this.metricLiquidEl.textContent = (t.liquidDropletCount || 0).toLocaleString();
      this.barLiquidEl.style.width = `${Math.min(100, ((t.liquidDropletCount || 0) / 10000) * 100)}%`;
    }
    if (this.metricAttractorsEl) {
      this.metricAttractorsEl.textContent = `${t.activeAttractors || 0} ACTIVE`;
      this.barAttractorsEl.style.width = `${Math.min(100, (t.activeAttractors || 0) * 20)}%`;
    }
  }
}
