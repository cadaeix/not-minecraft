export type GameMode = 'game' | 'sandbox';

export type MissionType =
  | 'hydrate_nodes'
  | 'spin_vortex'
  | 'drop_attractors'
  | 'purify_blight'
  | 'cosmic_pulse';

export interface GameObjective {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  current: number;
  target: number;
  rewardPoints: number;
  completed: boolean;
}

export interface GameNotification {
  id: string;
  message: string;
  text: string;
  type: 'info' | 'combo' | 'objective' | 'tier' | 'purify' | 'hydrate';
  points?: number;
  combo?: number;
  timestamp: number;
  duration: number; // in seconds
}

export interface TierDefinition {
  tier: number;
  name: string;
  threshold: number;
  description: string;
}

export const GENESIS_TIERS: readonly TierDefinition[] = [
  { tier: 1, name: 'Primordial Spark', threshold: 0, description: 'The cosmic canvas awakens from absolute void.' },
  { tier: 2, name: 'Resonant Bloom', threshold: 1200, description: 'Harmonic frequencies crystallize into sentient flora.' },
  { tier: 3, name: 'Mycelial Nexus', threshold: 3800, description: 'Living tendrils interconnect the manifold geometry.' },
  { tier: 4, name: 'Singularity Dawn', threshold: 9500, description: 'Gravitational mastery bends light and spacetime.' },
  { tier: 5, name: 'Omnipresent Harmony', threshold: 22000, description: 'Infinite resonance transcends Euclidean bounds.' },
];

export interface GameTelemetry {
  score: number;
  combo: number;
  comboTimer: number;
  maxComboTimer: number;
  tier: number;
  tierName: string;
  prevTierScore: number;
  nextTierScore: number;
  tierProgress: number;
  stability: number;
  mode: GameMode;
  objective: GameObjective;
  bloomedNodes: number;
  totalNodes: number;
  activeBlights: number;
}

export class GameStateManager {
  private score: number = 0;
  private combo: number = 1;
  private comboTimer: number = 0;
  private readonly maxComboTimer: number = 4.0;
  private comboStepCounter: number = 0;

  private tier: number = 1;
  private stability: number = 100.0; // 0 to 100%
  private mode: GameMode = 'game';

  // Mission state
  private missionCycleIndex: number = 0;
  private cycleCount: number = 1;
  private currentObjective!: GameObjective;

  // Tracked external entity counts
  private bloomedNodes: number = 0;
  private totalNodes: number = 0;
  private activeBlights: number = 0;

  // Notifications buffer (retained for UI)
  private notifications: GameNotification[] = [];
  private notificationCounter: number = 0;

  // Callbacks
  private notificationListeners: ((n: GameNotification) => void)[] = [];
  private telemetryListeners: ((t: GameTelemetry) => void)[] = [];

  // Cached telemetry object to prevent GC
  private cachedTelemetry!: GameTelemetry;

  constructor(mode: GameMode = 'game') {
    this.mode = mode;
    this.initNextObjective();
    this.buildCachedTelemetry();
  }

  public getMode(): GameMode {
    return this.mode;
  }

  public setMode(mode: GameMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.addNotification(
      mode === 'game' ? 'Cosmic Harmony: Game Mode Active' : 'Sandbox Continuum: Free Exploration',
      'info'
    );
  }

  public toggleMode(): GameMode {
    const next = this.mode === 'game' ? 'sandbox' : 'game';
    this.setMode(next);
    return next;
  }

  public getScore(): number {
    return this.score;
  }

  public getCombo(): number {
    return this.combo;
  }

  public getComboTimer(): number {
    return this.comboTimer;
  }

  public getMaxComboTimer(): number {
    return this.maxComboTimer;
  }

  public getTier(): number {
    return this.tier;
  }

  public getTierName(): string {
    const def = GENESIS_TIERS[this.tier - 1];
    return def ? def.name : 'Transcendent';
  }

  public getStability(): number {
    return this.stability;
  }

  public setStability(value: number): void {
    this.stability = Math.max(0, Math.min(100, value));
  }

  public adjustStability(delta: number): void {
    this.setStability(this.stability + delta);
  }

  public setNodeCounts(bloomed: number, total: number): void {
    this.bloomedNodes = bloomed;
    this.totalNodes = total;
  }

  public setActiveBlights(count: number): void {
    this.activeBlights = count;
  }

  public getCurrentObjective(): GameObjective {
    return this.currentObjective;
  }

  public onNotification(listener: (n: GameNotification) => void): () => void {
    this.notificationListeners.push(listener);
    return () => {
      const idx = this.notificationListeners.indexOf(listener);
      if (idx >= 0) this.notificationListeners.splice(idx, 1);
    };
  }

  public onTelemetry(listener: (t: GameTelemetry) => void): () => void {
    this.telemetryListeners.push(listener);
    return () => {
      const idx = this.telemetryListeners.indexOf(listener);
      if (idx >= 0) this.telemetryListeners.splice(idx, 1);
    };
  }

  public addNotification(
    text: string,
    type: GameNotification['type'] = 'info',
    points?: number,
    combo?: number,
    duration: number = 3.2
  ): void {
    this.notificationCounter++;
    const notif: GameNotification = {
      id: `notif_${Date.now()}_${this.notificationCounter}`,
      message: text,
      text,
      type,
      points,
      combo,
      timestamp: performance.now(),
      duration,
    };

    this.notifications.push(notif);
    // Limit retained notifications array
    if (this.notifications.length > 20) {
      this.notifications.shift();
    }

    for (let i = 0; i < this.notificationListeners.length; i++) {
      this.notificationListeners[i](notif);
    }
  }

  public getRecentNotifications(): readonly GameNotification[] {
    return this.notifications;
  }

  /**
   * Adds score scaled by the current combo multiplier.
   * Resets combo timer and steps up combo multiplier if sustained.
   */
  public addScore(basePoints: number, reason: string): void {
    if (basePoints <= 0) return;

    // Reset combo timer to 4.0 seconds on positive action
    this.comboTimer = this.maxComboTimer;

    // Increment combo steps: every 2 positive actions steps combo: 1x -> 2x -> 4x -> 8x -> 16x
    this.comboStepCounter++;
    if (this.combo < 2 && this.comboStepCounter >= 1) {
      this.advanceCombo(2);
    } else if (this.combo < 4 && this.comboStepCounter >= 3) {
      this.advanceCombo(4);
    } else if (this.combo < 8 && this.comboStepCounter >= 6) {
      this.advanceCombo(8);
    } else if (this.combo < 16 && this.comboStepCounter >= 10) {
      this.advanceCombo(16);
    }

    const earned = Math.round(basePoints * this.combo);
    this.score += earned;

    // Check for Genesis Tier ascent
    this.checkTierAscent();

    this.addNotification(
      `+${earned.toLocaleString()} pts: ${reason} (x${this.combo})`,
      'combo',
      earned,
      this.combo,
      2.5
    );
  }

  private advanceCombo(newCombo: number): void {
    if (newCombo > this.combo) {
      this.combo = newCombo;
      this.addNotification(`COMBO RESONANCE x${this.combo}!`, 'combo', undefined, this.combo, 2.5);
    }
  }

  private checkTierAscent(): void {
    while (this.tier < GENESIS_TIERS.length) {
      const nextTierDef = GENESIS_TIERS[this.tier];
      if (this.score >= nextTierDef.threshold) {
        this.tier = nextTierDef.tier;
        this.adjustStability(25);
        this.addNotification(
          `GENESIS TIER ASCENSION: ${nextTierDef.name.toUpperCase()}!`,
          'tier',
          5000 * this.tier,
          this.combo,
          5.0
        );
      } else {
        break;
      }
    }
  }

  // Action reporting methods

  public reportNodeHydrated(): void {
    this.addScore(300, 'Lotus Node Bloomed');
    this.adjustStability(12.0);

    if (this.currentObjective && this.currentObjective.type === 'hydrate_nodes') {
      this.currentObjective.current++;
      this.checkObjectiveCompletion();
    }
  }

  public reportFluidEnergy(ke: number): void {
    if (this.currentObjective && this.currentObjective.type === 'spin_vortex') {
      if (ke > this.currentObjective.current) {
        this.currentObjective.current = Math.min(this.currentObjective.target, Math.round(ke * 10) / 10);
      }
      if (ke >= this.currentObjective.target) {
        this.checkObjectiveCompletion();
      }
    }
  }

  public reportAttractorPlaced(): void {
    this.addScore(150, 'Singularity Placed');
    this.adjustStability(4.0);

    if (this.currentObjective && this.currentObjective.type === 'drop_attractors') {
      this.currentObjective.current++;
      this.checkObjectiveCompletion();
    }
  }

  public reportBlightPurified(): void {
    this.addScore(800, 'Void Blight Purified');
    this.adjustStability(25.0);

    if (this.currentObjective && this.currentObjective.type === 'purify_blight') {
      this.currentObjective.current++;
      this.checkObjectiveCompletion();
    }
  }

  public reportShockwave(): void {
    this.addScore(100, 'Cosmic Shockwave Pulse');

    if (this.currentObjective && this.currentObjective.type === 'cosmic_pulse') {
      this.currentObjective.current++;
      this.checkObjectiveCompletion();
    }
  }

  private checkObjectiveCompletion(): void {
    if (this.currentObjective && !this.currentObjective.completed) {
      if (this.currentObjective.current >= this.currentObjective.target) {
        this.currentObjective.completed = true;
        const reward = this.currentObjective.rewardPoints * this.cycleCount;
        this.score += reward;
        this.adjustStability(18.0);
        this.addNotification(
          `HARMONIC OBJECTIVE COMPLETE: ${this.currentObjective.title}! (+${reward.toLocaleString()} pts)`,
          'objective',
          reward,
          this.combo,
          4.5
        );
        this.checkTierAscent();

        // Advance to next dynamic emergent objective
        this.missionCycleIndex++;
        if (this.missionCycleIndex >= 5) {
          this.missionCycleIndex = 0;
          this.cycleCount++;
        }
        this.initNextObjective();
      }
    }
  }

  private initNextObjective(): void {
    const scale = this.cycleCount;
    switch (this.missionCycleIndex) {
      case 0: {
        const target = Math.min(10, 2 + scale);
        this.currentObjective = {
          id: `obj_${Date.now()}_0`,
          type: 'hydrate_nodes',
          title: 'Resonant Hydration',
          description: `Hydrate ${target} dormant lotus receptors on the shape with Liquid Spray`,
          current: 0,
          target,
          rewardPoints: 1000,
          completed: false,
        };
        break;
      }
      case 1: {
        const target = Math.round((2.5 + scale * 1.5) * 10) / 10;
        this.currentObjective = {
          id: `obj_${Date.now()}_1`,
          type: 'spin_vortex',
          title: 'Vorticity Ignition',
          description: `Swirl fluid kinetic energy past ${target} Joules using Vortex Weaver`,
          current: 0,
          target,
          rewardPoints: 1200,
          completed: false,
        };
        break;
      }
      case 2: {
        const target = Math.min(6, 1 + scale);
        this.currentObjective = {
          id: `obj_${Date.now()}_2`,
          type: 'drop_attractors',
          title: 'Gravitational Weave',
          description: `Place ${target} gravitational attractors to bend spacetime`,
          current: 0,
          target,
          rewardPoints: 1100,
          completed: false,
        };
        break;
      }
      case 3: {
        const target = Math.min(3, 1 + Math.floor((scale - 1) / 2));
        this.currentObjective = {
          id: `obj_${Date.now()}_3`,
          type: 'purify_blight',
          title: 'Void Purification',
          description: `Purify ${target} rogue Void Blight rift using liquid spray and shockwave`,
          current: 0,
          target,
          rewardPoints: 1800,
          completed: false,
        };
        break;
      }
      case 4:
      default: {
        const target = Math.min(4, 1 + scale);
        this.currentObjective = {
          id: `obj_${Date.now()}_4`,
          type: 'cosmic_pulse',
          title: 'Harmonic Detonation',
          description: `Detonate ${target} omnidirectional harmonic shockwaves`,
          current: 0,
          target,
          rewardPoints: 1400,
          completed: false,
        };
        break;
      }
    }

    this.addNotification(
      `New Harmonic Mission: ${this.currentObjective.title}`,
      'objective',
      undefined,
      undefined,
      3.0
    );
  }

  public update(dt: number): void {
    const clampedDt = Math.min(0.1, Math.max(0.0001, dt));

    // 1. Combo countdown timer
    if (this.comboTimer > 0) {
      this.comboTimer -= clampedDt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        if (this.combo > 1) {
          this.combo = 1;
          this.comboStepCounter = 0;
          this.addNotification('Combo Expired (x1)', 'info', undefined, 1, 1.8);
        }
      }
    }

    // 2. Stability dynamics in Game mode
    if (this.mode === 'game') {
      if (this.activeBlights > 0) {
        // Void blight drains continuum stability
        this.adjustStability(-this.activeBlights * 0.8 * clampedDt);
      } else {
        // Passive natural stabilization if no blights
        this.adjustStability(0.3 * clampedDt);
      }

      // Check critical stability warning
      if (this.stability < 20 && Math.random() < 0.01) {
        this.addNotification('WARNING: Continuum Stability Critical!', 'purify', undefined, undefined, 2.0);
      }
    } else {
      // In sandbox mode, stability stays at 100%
      this.stability = 100.0;
    }

    // 3. Update cached telemetry
    this.buildCachedTelemetry();

    // 4. Notify listeners (if any)
    for (let i = 0; i < this.telemetryListeners.length; i++) {
      this.telemetryListeners[i](this.cachedTelemetry);
    }
  }

  private buildCachedTelemetry(): void {
    const currentTierIndex = this.tier - 1;
    const currentTierDef = GENESIS_TIERS[currentTierIndex] || GENESIS_TIERS[0];
    const prevTierScore = currentTierDef.threshold;

    const nextTierDef = GENESIS_TIERS[this.tier] || null;
    const nextTierScore = nextTierDef ? nextTierDef.threshold : currentTierDef.threshold * 2;

    const tierRange = Math.max(1, nextTierScore - prevTierScore);
    const tierProgress = nextTierDef
      ? Math.max(0, Math.min(1.0, (this.score - prevTierScore) / tierRange))
      : 1.0;

    if (!this.cachedTelemetry) {
      this.cachedTelemetry = {
        score: this.score,
        combo: this.combo,
        comboTimer: this.comboTimer,
        maxComboTimer: this.maxComboTimer,
        tier: this.tier,
        tierName: currentTierDef.name,
        prevTierScore,
        nextTierScore,
        tierProgress,
        stability: this.stability,
        mode: this.mode,
        objective: this.currentObjective,
        bloomedNodes: this.bloomedNodes,
        totalNodes: this.totalNodes,
        activeBlights: this.activeBlights,
      };
    } else {
      this.cachedTelemetry.score = this.score;
      this.cachedTelemetry.combo = this.combo;
      this.cachedTelemetry.comboTimer = this.comboTimer;
      this.cachedTelemetry.maxComboTimer = this.maxComboTimer;
      this.cachedTelemetry.tier = this.tier;
      this.cachedTelemetry.tierName = currentTierDef.name;
      this.cachedTelemetry.prevTierScore = prevTierScore;
      this.cachedTelemetry.nextTierScore = nextTierScore;
      this.cachedTelemetry.tierProgress = tierProgress;
      this.cachedTelemetry.stability = this.stability;
      this.cachedTelemetry.mode = this.mode;
      this.cachedTelemetry.objective = this.currentObjective;
      this.cachedTelemetry.bloomedNodes = this.bloomedNodes;
      this.cachedTelemetry.totalNodes = this.totalNodes;
      this.cachedTelemetry.activeBlights = this.activeBlights;
    }
  }

  public getTelemetry(): GameTelemetry {
    if (!this.cachedTelemetry) {
      this.buildCachedTelemetry();
    }
    return this.cachedTelemetry;
  }
}
