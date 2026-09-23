import {
  GameStateManager,
  GameTelemetry,
  GameNotification,
  GameMode,
  GameObjective,
} from './GameStateManager';

export interface GameHudOptions {
  container?: HTMLElement;
  autoInjectStyles?: boolean;
}

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export class GameHud {
  private gameState: GameStateManager;
  private rootContainer: HTMLElement;
  private autoInjectStyles: boolean;

  // Injected DOM nodes
  public hudBarElement!: HTMLElement;
  public toastContainer!: HTMLElement;
  private styleElement: HTMLStyleElement | null = null;

  // Left Segment Elements
  private modeToggleBtn!: HTMLButtonElement;
  private modeTextEl!: HTMLElement;
  private missionChip!: HTMLElement;
  private missionTitleEl!: HTMLElement;
  private missionCounterEl!: HTMLElement;
  private missionProgressBar!: HTMLElement;
  private stabilityContainer!: HTMLElement;
  private stabilityValueEl!: HTMLElement;
  private stabilityBar!: HTMLElement;

  // Center Segment Elements
  private tierBadgeEl!: HTMLElement;
  private tierNameEl!: HTMLElement;
  private scoreCounterEl!: HTMLElement;
  private scoreDigitsEl!: HTMLElement;
  private scorePopupsContainer!: HTMLElement;

  // Right Segment Elements
  private comboBadge!: HTMLElement;
  private comboTextEl!: HTMLElement;
  private comboMeterBar!: HTMLElement;

  // High-performance Zero-GC dirty-checking state
  private displayedScore: number = 0;
  private targetScore: number = 0;
  private lastRenderedScore: number = -1;
  private lastRenderedCombo: number = -1;
  private lastRenderedComboTimerRatio: number = -1;
  private lastRenderedStability: number = -1;
  private lastRenderedMode: GameMode | '' = '';
  private lastObjectiveId: string = '';
  private lastObjectiveCurrent: number = -1;
  private lastObjectiveTarget: number = -1;
  private lastObjectiveCompleted: boolean = false;
  private lastTier: number = -1;

  // Event listener cleanup
  private unsubNotification: (() => void) | null = null;
  private isDisposed: boolean = false;

  constructor(gameState: GameStateManager, options: GameHudOptions = {}) {
    this.gameState = gameState;
    this.rootContainer = options.container || document.body;
    this.autoInjectStyles = options.autoInjectStyles !== false;

    if (this.autoInjectStyles) {
      this.injectStyles();
    }

    this.createDomElements();
    this.bindEvents();

    // Initialize with current telemetry state
    const initialTelemetry = this.gameState.getTelemetry();
    this.displayedScore = initialTelemetry.score;
    this.targetScore = initialTelemetry.score;
    this.renderTelemetry(initialTelemetry, 0.016);
  }

  /**
   * Injects self-contained styling for the Game HUD, Mission Chip, Stability Meter,
   * Combo Meter, Glowing Score Popups, and Floating Celebratory Toast Banners.
   */
  private injectStyles(): void {
    if (document.getElementById('cosmic-game-hud-styles')) {
      return;
    }

    const css = `
      /* ==========================================================================
         COSMIC HARMONY — Game HUD & Floating Notification System
         ========================================================================== */

      .cosmic-game-hud-bar {
        position: absolute;
        top: 84px;
        left: 16px;
        right: 16px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        background: rgba(8, 12, 24, 0.72);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(0, 240, 255, 0.22);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), inset 0 0 16px rgba(0, 240, 255, 0.08);
        z-index: 90;
        pointer-events: auto;
        gap: 16px;
        box-sizing: border-box;
      }

      /* Left Segment: Mode Toggle, Mission Chip & Stability */
      .hud-left-segment {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }

      .hud-mode-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(0, 240, 255, 0.35);
        color: #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.8px;
        padding: 6px 12px;
        height: 36px;
        white-space: nowrap;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }

      .hud-mode-btn:hover {
        background: rgba(0, 240, 255, 0.16);
        border-color: #00f0ff;
        color: #ffffff;
        box-shadow: 0 0 14px rgba(0, 240, 255, 0.35);
        transform: translateY(-1px);
      }

      .hud-mode-btn.mode-game {
        border-color: rgba(0, 240, 255, 0.5);
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, rgba(240, 37, 128, 0.12) 100%);
      }

      .hud-mode-btn.mode-sandbox {
        border-color: rgba(255, 170, 0, 0.5);
        background: linear-gradient(135deg, rgba(255, 170, 0, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%);
        color: #ffcc00;
      }

      /* Mission Chip */
      .hud-mission-chip {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 4px 12px;
        background: rgba(14, 20, 36, 0.8);
        border: 1px solid rgba(0, 255, 170, 0.3);
        border-radius: 8px;
        height: 36px;
        min-width: 220px;
        max-width: 320px;
        box-sizing: border-box;
        transition: all 0.3s ease;
      }

      .hud-mission-chip.completed {
        border-color: rgba(0, 255, 170, 0.8);
        box-shadow: 0 0 16px rgba(0, 255, 170, 0.35);
        background: rgba(0, 255, 170, 0.12);
      }

      .mission-header-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-sans, 'Plus Jakarta Sans', sans-serif);
        font-size: 11px;
        line-height: 14px;
        white-space: nowrap;
        overflow: hidden;
      }

      .mission-glyph {
        color: #00ffaa;
        font-size: 11px;
      }

      .mission-title {
        color: #e2e8f0;
        font-weight: 600;
        letter-spacing: 0.3px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .mission-counter {
        color: #00f0ff;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 10px;
        font-weight: 600;
        margin-left: auto;
        padding-left: 6px;
      }

      .mission-track {
        width: 100%;
        height: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        margin-top: 4px;
        overflow: hidden;
      }

      .mission-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #00f0ff, #00ffaa);
        border-radius: 2px;
        transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 0 6px #00ffaa;
      }

      /* Stability Health Meter */
      .hud-stability-box {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 4px 10px;
        background: rgba(14, 20, 36, 0.7);
        border: 1px solid rgba(90, 150, 255, 0.25);
        border-radius: 8px;
        height: 36px;
        width: 130px;
        box-sizing: border-box;
        transition: all 0.3s ease;
      }

      .hud-stability-box.critical {
        border-color: rgba(240, 37, 128, 0.8);
        box-shadow: 0 0 16px rgba(240, 37, 128, 0.5);
        animation: stabilityPulse 0.8s ease-in-out infinite alternate;
      }

      @keyframes stabilityPulse {
        from { background: rgba(240, 37, 128, 0.1); }
        to { background: rgba(240, 37, 128, 0.3); }
      }

      .stability-text-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 9px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        letter-spacing: 0.8px;
        margin-bottom: 3px;
      }

      .stability-tag {
        color: #718096;
        font-weight: 600;
      }

      .stability-val {
        color: #00ffaa;
        font-weight: 700;
      }

      .hud-stability-box.critical .stability-val {
        color: #f02580;
      }

      .stability-track {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .stability-fill {
        height: 100%;
        width: 100%;
        background: linear-gradient(90deg, #f02580 0%, #ffaa00 35%, #00ffaa 80%, #00f0ff 100%);
        border-radius: 2px;
        transition: width 0.25s ease;
      }

      /* Center Segment: Harmony Score & Genesis Tier */
      .hud-center-segment {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        flex-shrink: 0;
      }

      .hud-tier-row {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        letter-spacing: 1.2px;
        line-height: 12px;
        margin-bottom: 2px;
      }

      .tier-badge {
        color: #ffaa00;
        font-weight: 700;
        text-shadow: 0 0 8px rgba(255, 170, 0, 0.4);
      }

      .tier-sep {
        color: #718096;
        font-size: 8px;
      }

      .tier-name {
        color: #cbd5e1;
        font-weight: 500;
        text-transform: uppercase;
      }

      .hud-score-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .hud-score-row {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: default;
      }

      .score-glyph {
        color: #00f0ff;
        font-size: 16px;
        animation: scoreGlowPulse 2.5s ease-in-out infinite alternate;
      }

      @keyframes scoreGlowPulse {
        from { text-shadow: 0 0 6px #00f0ff; transform: scale(0.95); }
        to { text-shadow: 0 0 16px #00f0ff, 0 0 24px #00ffaa; transform: scale(1.1); }
      }

      .score-digits {
        font-family: var(--font-serif, 'Cinzel', serif);
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 2px;
        background: linear-gradient(135deg, #ffffff 0%, #00f0ff 70%, #00ffaa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.45));
      }

      .hud-score-popups {
        position: absolute;
        top: -6px;
        right: -42px;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .score-popup-item {
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 13px;
        font-weight: 700;
        color: #00ffaa;
        text-shadow: 0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 240, 255, 0.6);
        animation: scorePopupFloat 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        white-space: nowrap;
      }

      @keyframes scorePopupFloat {
        0% {
          opacity: 0;
          transform: translateY(6px) scale(0.75);
        }
        25% {
          opacity: 1;
          transform: translateY(0) scale(1.1);
        }
        70% {
          opacity: 1;
          transform: translateY(-16px) scale(1.0);
        }
        100% {
          opacity: 0;
          transform: translateY(-28px) scale(0.85);
        }
      }

      /* Right Segment: Combo Multiplier Badge & Countdown Meter */
      .hud-right-segment {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex: 1;
        min-width: 0;
      }

      .hud-combo-badge {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 4px 14px;
        background: rgba(14, 20, 36, 0.8);
        border: 1px solid rgba(0, 240, 255, 0.25);
        border-radius: 8px;
        height: 36px;
        min-width: 120px;
        box-sizing: border-box;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .hud-combo-badge.combo-x1 {
        opacity: 0.65;
        border-color: rgba(255, 255, 255, 0.15);
      }

      .hud-combo-badge.combo-x2 {
        opacity: 1.0;
        border-color: #00f0ff;
        box-shadow: 0 0 14px rgba(0, 240, 255, 0.35);
        background: rgba(0, 240, 255, 0.1);
      }

      .hud-combo-badge.combo-x4 {
        opacity: 1.0;
        border-color: #00ffaa;
        box-shadow: 0 0 18px rgba(0, 255, 170, 0.45);
        background: rgba(0, 255, 170, 0.12);
      }

      .hud-combo-badge.combo-x8 {
        opacity: 1.0;
        border-color: #ffaa00;
        box-shadow: 0 0 22px rgba(255, 170, 0, 0.55);
        background: rgba(255, 170, 0, 0.15);
        animation: comboPulse 1.2s ease-in-out infinite alternate;
      }

      .hud-combo-badge.combo-x16 {
        opacity: 1.0;
        border-color: #f02580;
        box-shadow: 0 0 28px rgba(240, 37, 128, 0.75), 0 0 12px rgba(0, 240, 255, 0.5);
        background: linear-gradient(135deg, rgba(240, 37, 128, 0.25) 0%, rgba(0, 240, 255, 0.25) 100%);
        animation: comboPulseHyper 0.6s ease-in-out infinite alternate;
      }

      @keyframes comboPulse {
        from { transform: scale(1.0); }
        to { transform: scale(1.03); }
      }

      @keyframes comboPulseHyper {
        from { transform: scale(1.0); filter: hue-rotate(0deg); }
        to { transform: scale(1.05); filter: hue-rotate(60deg); }
      }

      .combo-label-row {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        margin-bottom: 3px;
        line-height: 13px;
      }

      .combo-text {
        color: #e2e8f0;
      }

      .hud-combo-badge.combo-x2 .combo-text { color: #00f0ff; }
      .hud-combo-badge.combo-x4 .combo-text { color: #00ffaa; }
      .hud-combo-badge.combo-x8 .combo-text { color: #ffaa00; }
      .hud-combo-badge.combo-x16 .combo-text { color: #ffffff; text-shadow: 0 0 10px #f02580; }

      .combo-meter-track {
        width: 100%;
        height: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .combo-meter-fill {
        height: 100%;
        width: 100%;
        transform: scaleX(0);
        transform-origin: left center;
        border-radius: 2px;
        background: #00f0ff;
        box-shadow: 0 0 8px currentColor;
        transition: transform 0.05s linear;
      }

      .hud-combo-badge.combo-x4 .combo-meter-fill { background: #00ffaa; }
      .hud-combo-badge.combo-x8 .combo-meter-fill { background: #ffaa00; }
      .hud-combo-badge.combo-x16 .combo-meter-fill { background: #f02580; }

      /* ==========================================================================
         FLOATING CELEBRATORY TOAST BANNERS
         ========================================================================== */

      .cosmic-toast-container {
        position: fixed;
        top: 152px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        z-index: 9999;
        pointer-events: none;
        max-width: 600px;
        width: 90%;
      }

      .cosmic-toast {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 22px;
        border-radius: 12px;
        background: rgba(10, 14, 28, 0.88);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        font-family: var(--font-sans, 'Plus Jakarta Sans', sans-serif);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.8px;
        color: #ffffff;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.65);
        pointer-events: none;
        animation: toastCelebration 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes toastCelebration {
        0% {
          opacity: 0;
          transform: translateY(18px) scale(0.92);
        }
        12% {
          opacity: 1;
          transform: translateY(0) scale(1.02);
        }
        20% {
          transform: translateY(0) scale(1.0);
        }
        76% {
          opacity: 1;
          transform: translateY(0) scale(1.0);
        }
        100% {
          opacity: 0;
          transform: translateY(-26px) scale(0.95);
        }
      }

      .toast-bloom {
        border: 1px solid rgba(255, 105, 180, 0.7);
        box-shadow: 0 0 24px rgba(255, 105, 180, 0.45), inset 0 0 14px rgba(0, 255, 170, 0.25);
        background: linear-gradient(135deg, rgba(255, 105, 180, 0.2) 0%, rgba(10, 14, 28, 0.9) 100%);
      }

      .toast-vortex {
        border: 1px solid rgba(0, 240, 255, 0.7);
        box-shadow: 0 0 24px rgba(0, 240, 255, 0.45), inset 0 0 14px rgba(0, 150, 255, 0.25);
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(10, 14, 28, 0.9) 100%);
      }

      .toast-singularity {
        border: 1px solid rgba(168, 85, 247, 0.75);
        box-shadow: 0 0 24px rgba(168, 85, 247, 0.5), inset 0 0 14px rgba(240, 37, 128, 0.25);
        background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(10, 14, 28, 0.9) 100%);
      }

      .toast-purify {
        border: 1px solid rgba(255, 187, 0, 0.8);
        box-shadow: 0 0 28px rgba(255, 187, 0, 0.55), inset 0 0 16px rgba(0, 240, 255, 0.3);
        background: linear-gradient(135deg, rgba(255, 187, 0, 0.2) 0%, rgba(10, 14, 28, 0.9) 100%);
      }

      .toast-tier {
        border: 1px solid rgba(255, 215, 0, 0.85);
        box-shadow: 0 0 32px rgba(255, 215, 0, 0.6), inset 0 0 20px rgba(168, 85, 247, 0.35);
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.25) 0%, rgba(168, 85, 247, 0.25) 50%, rgba(10, 14, 28, 0.92) 100%);
        font-family: var(--font-serif, 'Cinzel', serif);
        letter-spacing: 1.5px;
      }

      .toast-default {
        border: 1px solid rgba(0, 240, 255, 0.35);
        box-shadow: 0 0 20px rgba(0, 240, 255, 0.25);
      }

      .toast-text {
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
      }

      .toast-points-badge {
        background: rgba(0, 255, 170, 0.2);
        border: 1px solid rgba(0, 255, 170, 0.5);
        color: #00ffaa;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 6px;
        margin-left: 6px;
      }

      /* Responsiveness */
      @media (max-width: 900px) {
        .cosmic-game-hud-bar {
          top: 80px;
          height: auto;
          flex-wrap: wrap;
          padding: 8px 12px;
          gap: 8px;
        }
        .hud-left-segment, .hud-right-segment {
          flex: none;
          width: 100%;
          justify-content: space-between;
        }
        .hud-center-segment {
          order: -1;
          width: 100%;
          margin-bottom: 4px;
        }
        .hud-mission-chip {
          min-width: 160px;
        }
      }
    `;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'cosmic-game-hud-styles';
    this.styleElement.textContent = css;
    document.head.appendChild(this.styleElement);
  }

  /**
   * Constructs the DOM hierarchy for the game HUD bar and floating notification layer.
   */
  private createDomElements(): void {
    // 1. Game HUD Bar
    this.hudBarElement = document.createElement('div');
    this.hudBarElement.id = 'cosmic-game-hud';
    this.hudBarElement.className = 'cosmic-game-hud-bar glass-panel';

    // 2. Left Segment
    const leftSegment = document.createElement('div');
    leftSegment.className = 'hud-left-segment';

    // Mode Toggle Button
    this.modeToggleBtn = document.createElement('button');
    this.modeToggleBtn.id = 'hud-mode-toggle';
    this.modeToggleBtn.className = 'hud-mode-btn mode-game';
    this.modeToggleBtn.title = 'Switch between Cosmic Harmony Game Mode and Sandbox Exploration';

    this.modeTextEl = document.createElement('span');
    this.modeTextEl.className = 'mode-text';
    this.modeTextEl.textContent = 'GAME MODE ✦';
    this.modeToggleBtn.appendChild(this.modeTextEl);
    leftSegment.appendChild(this.modeToggleBtn);

    // Mission Chip
    this.missionChip = document.createElement('div');
    this.missionChip.id = 'hud-mission-chip';
    this.missionChip.className = 'hud-mission-chip';

    const missionHeader = document.createElement('div');
    missionHeader.className = 'mission-header-row';

    const missionGlyph = document.createElement('span');
    missionGlyph.className = 'mission-glyph';
    missionGlyph.textContent = '✦';

    this.missionTitleEl = document.createElement('span');
    this.missionTitleEl.id = 'hud-mission-title';
    this.missionTitleEl.className = 'mission-title';
    this.missionTitleEl.textContent = 'Hydrate Lotus Nodes';

    this.missionCounterEl = document.createElement('span');
    this.missionCounterEl.id = 'hud-mission-counter';
    this.missionCounterEl.className = 'mission-counter';
    this.missionCounterEl.textContent = '[0 / 3]';

    missionHeader.appendChild(missionGlyph);
    missionHeader.appendChild(this.missionTitleEl);
    missionHeader.appendChild(this.missionCounterEl);

    const missionTrack = document.createElement('div');
    missionTrack.className = 'mission-track';

    this.missionProgressBar = document.createElement('div');
    this.missionProgressBar.id = 'hud-mission-fill';
    this.missionProgressBar.className = 'mission-fill';
    missionTrack.appendChild(this.missionProgressBar);

    this.missionChip.appendChild(missionHeader);
    this.missionChip.appendChild(missionTrack);
    leftSegment.appendChild(this.missionChip);

    // Continuum Stability Meter
    this.stabilityContainer = document.createElement('div');
    this.stabilityContainer.id = 'hud-stability-box';
    this.stabilityContainer.className = 'hud-stability-box';

    const stabilityTextRow = document.createElement('div');
    stabilityTextRow.className = 'stability-text-row';

    const stabilityTag = document.createElement('span');
    stabilityTag.className = 'stability-tag';
    stabilityTag.textContent = 'STABILITY';

    this.stabilityValueEl = document.createElement('span');
    this.stabilityValueEl.id = 'hud-stability-val';
    this.stabilityValueEl.className = 'stability-val';
    this.stabilityValueEl.textContent = '100%';

    stabilityTextRow.appendChild(stabilityTag);
    stabilityTextRow.appendChild(this.stabilityValueEl);

    const stabilityTrack = document.createElement('div');
    stabilityTrack.className = 'stability-track';

    this.stabilityBar = document.createElement('div');
    this.stabilityBar.id = 'hud-stability-fill';
    this.stabilityBar.className = 'stability-fill';
    this.stabilityBar.style.width = '100%';
    stabilityTrack.appendChild(this.stabilityBar);

    this.stabilityContainer.appendChild(stabilityTextRow);
    this.stabilityContainer.appendChild(stabilityTrack);
    leftSegment.appendChild(this.stabilityContainer);

    this.hudBarElement.appendChild(leftSegment);

    // 3. Center Segment
    const centerSegment = document.createElement('div');
    centerSegment.className = 'hud-center-segment';

    const tierRow = document.createElement('div');
    tierRow.className = 'hud-tier-row';

    this.tierBadgeEl = document.createElement('span');
    this.tierBadgeEl.id = 'hud-tier-badge';
    this.tierBadgeEl.className = 'tier-badge';
    this.tierBadgeEl.textContent = 'GENESIS TIER I';

    const tierSep = document.createElement('span');
    tierSep.className = 'tier-sep';
    tierSep.textContent = '•';

    this.tierNameEl = document.createElement('span');
    this.tierNameEl.id = 'hud-tier-name';
    this.tierNameEl.className = 'tier-name';
    this.tierNameEl.textContent = 'Primordial Spark';

    tierRow.appendChild(this.tierBadgeEl);
    tierRow.appendChild(tierSep);
    tierRow.appendChild(this.tierNameEl);

    const scoreWrapper = document.createElement('div');
    scoreWrapper.className = 'hud-score-wrapper';

    this.scoreCounterEl = document.createElement('div');
    this.scoreCounterEl.id = 'hud-score-counter';
    this.scoreCounterEl.className = 'hud-score-row';

    const scoreGlyph = document.createElement('span');
    scoreGlyph.className = 'score-glyph';
    scoreGlyph.textContent = '✦';

    this.scoreDigitsEl = document.createElement('span');
    this.scoreDigitsEl.id = 'hud-score-digits';
    this.scoreDigitsEl.className = 'score-digits';
    this.scoreDigitsEl.textContent = '0';

    this.scoreCounterEl.appendChild(scoreGlyph);
    this.scoreCounterEl.appendChild(this.scoreDigitsEl);

    this.scorePopupsContainer = document.createElement('div');
    this.scorePopupsContainer.id = 'hud-score-popups';
    this.scorePopupsContainer.className = 'hud-score-popups';

    scoreWrapper.appendChild(this.scoreCounterEl);
    scoreWrapper.appendChild(this.scorePopupsContainer);

    centerSegment.appendChild(tierRow);
    centerSegment.appendChild(scoreWrapper);
    this.hudBarElement.appendChild(centerSegment);

    // 4. Right Segment
    const rightSegment = document.createElement('div');
    rightSegment.className = 'hud-right-segment';

    this.comboBadge = document.createElement('div');
    this.comboBadge.id = 'hud-combo-badge';
    this.comboBadge.className = 'hud-combo-badge combo-x1';

    const comboLabelRow = document.createElement('div');
    comboLabelRow.className = 'combo-label-row';

    this.comboTextEl = document.createElement('span');
    this.comboTextEl.id = 'hud-combo-text';
    this.comboTextEl.className = 'combo-text';
    this.comboTextEl.textContent = '[x1]';
    comboLabelRow.appendChild(this.comboTextEl);

    const comboTrack = document.createElement('div');
    comboTrack.className = 'combo-meter-track';

    this.comboMeterBar = document.createElement('div');
    this.comboMeterBar.id = 'hud-combo-meter-fill';
    this.comboMeterBar.className = 'combo-meter-fill';
    comboTrack.appendChild(this.comboMeterBar);

    this.comboBadge.appendChild(comboLabelRow);
    this.comboBadge.appendChild(comboTrack);
    rightSegment.appendChild(this.comboBadge);

    this.hudBarElement.appendChild(rightSegment);

    // 5. Toast Notification Layer
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'cosmic-toast-container';
    this.toastContainer.className = 'cosmic-toast-container';

    // Mount to root container
    this.rootContainer.appendChild(this.hudBarElement);
    this.rootContainer.appendChild(this.toastContainer);
  }

  /**
   * Binds user events and listens for game notifications from GameStateManager.
   */
  private bindEvents(): void {
    // Mode toggle button click
    this.modeToggleBtn.addEventListener('click', () => {
      this.gameState.toggleMode();
    });

    // Subscribe to celebratory game notifications
    this.unsubNotification = this.gameState.onNotification((notif: GameNotification) => {
      this.showNotification(notif);
    });
  }

  /**
   * Spawns non-blocking floating celebratory toast banners for game events.
   * Auto-fades and slides upward gracefully after 2.5s.
   *
   * Formats events like:
   *  - "🌸 LOTUS BLOOM! +500"
   *  - "⚡ VORTEX SURGE! x2 COMBO"
   *  - "🪐 SINGULARITY ANCHORED! +800"
   *  - "✨ VOID PURIFIED! +2,500"
   *  - "🌌 GENESIS TIER II REACHED!"
   */
  public showNotification(
    notification: GameNotification | string,
    overrideType?: string,
    points?: number,
    combo?: number
  ): void {
    if (this.isDisposed || !this.toastContainer) return;

    let text: string;
    let type: string;
    let notifPoints: number | undefined;

    if (typeof notification === 'string') {
      text = notification;
      type = overrideType || 'info';
      notifPoints = points;
    } else {
      text = notification.message || notification.text || '';
      type = notification.type || 'info';
      notifPoints = notification.points;
    }

    // Determine visual celebratory theme
    let themeClass = 'toast-default';
    if (text.includes('🌸') || text.includes('LOTUS') || text.includes('BLOOM') || type === 'hydrate') {
      themeClass = 'toast-bloom';
    } else if (text.includes('⚡') || text.includes('VORTEX') || text.includes('SURGE') || type === 'combo') {
      themeClass = 'toast-vortex';
    } else if (text.includes('🪐') || text.includes('SINGULARITY') || text.includes('ANCHOR')) {
      themeClass = 'toast-singularity';
    } else if (text.includes('✨') || text.includes('VOID') || text.includes('PURIFIED') || type === 'purify') {
      themeClass = 'toast-purify';
    } else if (text.includes('🌌') || text.includes('GENESIS') || text.includes('TIER') || type === 'tier') {
      themeClass = 'toast-tier';
    }

    // Limit active toasts to avoid clutter
    while (this.toastContainer.children.length >= 5) {
      const oldest = this.toastContainer.firstElementChild;
      if (oldest) {
        this.toastContainer.removeChild(oldest);
      } else {
        break;
      }
    }

    const toast = document.createElement('div');
    toast.className = `cosmic-toast ${themeClass}`;

    const textSpan = document.createElement('span');
    textSpan.className = 'toast-text';
    textSpan.textContent = text;
    toast.appendChild(textSpan);

    if (notifPoints !== undefined && notifPoints > 0 && !text.includes(`+${notifPoints}`)) {
      const pointsBadge = document.createElement('span');
      pointsBadge.className = 'toast-points-badge';
      pointsBadge.textContent = `+${notifPoints.toLocaleString()}`;
      toast.appendChild(pointsBadge);
    }

    this.toastContainer.appendChild(toast);

    // Remove toast smoothly after 2.5s
    const timerId = window.setTimeout(() => {
      if (toast.parentNode === this.toastContainer) {
        this.toastContainer.removeChild(toast);
      }
    }, 2500);

    toast.addEventListener('animationend', () => {
      window.clearTimeout(timerId);
      if (toast.parentNode === this.toastContainer) {
        this.toastContainer.removeChild(toast);
      }
    });
  }

  /**
   * Spawns a floating glowing score increment popup near the score counter.
   */
  private spawnScorePopup(delta: number): void {
    if (delta <= 0 || !this.scorePopupsContainer) return;

    // Limit concurrent popups
    if (this.scorePopupsContainer.children.length >= 4) {
      this.scorePopupsContainer.firstElementChild?.remove();
    }

    const popup = document.createElement('div');
    popup.className = 'score-popup-item';
    popup.textContent = `+${delta.toLocaleString()}`;
    this.scorePopupsContainer.appendChild(popup);

    const timer = window.setTimeout(() => {
      if (popup.parentNode === this.scorePopupsContainer) {
        this.scorePopupsContainer.removeChild(popup);
      }
    }, 1250);

    popup.addEventListener('animationend', () => {
      window.clearTimeout(timer);
      if (popup.parentNode === this.scorePopupsContainer) {
        this.scorePopupsContainer.removeChild(popup);
      }
    });
  }

  /**
   * Per-frame update method called from main render loop.
   * Performs zero-GC dirty checking and smooth animations.
   */
  public update(dt: number = 0.016): void {
    if (this.isDisposed) return;
    const telemetry = this.gameState.getTelemetry();
    this.renderTelemetry(telemetry, dt);
  }

  /**
   * High performance render pipeline with dirty checking.
   */
  private renderTelemetry(telemetry: GameTelemetry, dt: number): void {
    // 1. Harmony Score & Smooth Number Roll-Up
    this.targetScore = telemetry.score;
    if (this.targetScore > this.displayedScore) {
      const scoreDelta = this.targetScore - (this.lastRenderedScore >= 0 ? this.lastRenderedScore : this.displayedScore);
      if (scoreDelta > 0 && this.lastRenderedScore >= 0) {
        this.spawnScorePopup(scoreDelta);
      }

      // Smooth lerp roll-up
      const diff = this.targetScore - this.displayedScore;
      if (Math.abs(diff) < 1) {
        this.displayedScore = this.targetScore;
      } else {
        this.displayedScore += diff * Math.min(1.0, dt * 10.0);
      }
    } else if (this.targetScore < this.displayedScore) {
      this.displayedScore = this.targetScore;
    }

    const roundedScore = Math.round(this.displayedScore);
    if (roundedScore !== this.lastRenderedScore) {
      this.lastRenderedScore = roundedScore;
      this.scoreDigitsEl.textContent = roundedScore.toLocaleString();
    }

    // 2. Genesis Tier
    if (telemetry.tier !== this.lastTier) {
      this.lastTier = telemetry.tier;
      const roman = ROMAN_NUMERALS[telemetry.tier] || `${telemetry.tier}`;
      this.tierBadgeEl.textContent = `GENESIS TIER ${roman}`;
      this.tierNameEl.textContent = telemetry.tierName;
    }

    // 3. Mode Toggle Button
    if (telemetry.mode !== this.lastRenderedMode) {
      this.lastRenderedMode = telemetry.mode;
      if (telemetry.mode === 'game') {
        this.modeToggleBtn.className = 'hud-mode-btn mode-game';
        this.modeTextEl.textContent = 'GAME MODE ✦';
      } else {
        this.modeToggleBtn.className = 'hud-mode-btn mode-sandbox';
        this.modeTextEl.textContent = 'SANDBOX ⟳';
      }
    }

    // 4. Mission Chip
    const obj = telemetry.objective;
    if (obj) {
      if (
        obj.id !== this.lastObjectiveId ||
        obj.current !== this.lastObjectiveCurrent ||
        obj.target !== this.lastObjectiveTarget ||
        obj.completed !== this.lastObjectiveCompleted
      ) {
        this.lastObjectiveId = obj.id;
        this.lastObjectiveCurrent = obj.current;
        this.lastObjectiveTarget = obj.target;
        this.lastObjectiveCompleted = obj.completed;

        this.missionTitleEl.textContent = obj.title;

        if (obj.completed) {
          this.missionCounterEl.textContent = '[COMPLETED ✓]';
          this.missionProgressBar.style.width = '100%';
          this.missionChip.classList.add('completed');
        } else {
          this.missionChip.classList.remove('completed');
          const isInt = Number.isInteger(obj.target);
          const curStr = isInt ? Math.floor(obj.current).toString() : obj.current.toFixed(1);
          const targetStr = isInt ? obj.target.toString() : obj.target.toFixed(1);
          this.missionCounterEl.textContent = `[${curStr} / ${targetStr}]`;

          const progressRatio = Math.max(0, Math.min(1.0, obj.current / Math.max(0.001, obj.target)));
          this.missionProgressBar.style.width = `${Math.round(progressRatio * 100)}%`;
        }
      }
    }

    // 5. Continuum Stability Health Meter
    const stabValue = telemetry.mode === 'sandbox' ? 100 : Math.max(0, Math.min(100, telemetry.stability));
    const roundedStability = Math.round(stabValue);
    if (roundedStability !== this.lastRenderedStability) {
      this.lastRenderedStability = roundedStability;
      this.stabilityBar.style.width = `${roundedStability}%`;
      this.stabilityValueEl.textContent = telemetry.mode === 'sandbox' ? '100%' : `${roundedStability}%`;

      if (roundedStability < 25 && telemetry.mode === 'game') {
        this.stabilityContainer.classList.add('critical');
      } else {
        this.stabilityContainer.classList.remove('critical');
      }
    }

    // 6. Combo Multiplier Badge & Animated Countdown Meter
    const combo = telemetry.combo;
    if (combo !== this.lastRenderedCombo) {
      this.lastRenderedCombo = combo;
      this.comboBadge.className = `hud-combo-badge combo-x${combo}`;
      this.comboTextEl.textContent = combo > 1 ? `[x${combo} COMBO]` : '[x1]';
    }

    // Countdown Meter Ratio (scaleX from 1.0 down to 0.0)
    let meterRatio = 0;
    if (combo > 1 && telemetry.maxComboTimer > 0) {
      meterRatio = Math.max(0, Math.min(1.0, telemetry.comboTimer / telemetry.maxComboTimer));
    }
    const quantizedRatio = Math.round(meterRatio * 250) / 250;
    if (quantizedRatio !== this.lastRenderedComboTimerRatio) {
      this.lastRenderedComboTimerRatio = quantizedRatio;
      this.comboMeterBar.style.transform = `scaleX(${quantizedRatio})`;
    }
  }
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.unsubNotification) {
      this.unsubNotification();
      this.unsubNotification = null;
    }

    this.hudBarElement?.remove();
    this.toastContainer?.remove();
    this.styleElement?.remove();
  }
}
