import * as THREE from 'three';

export interface ReactionDiffusionPreset {
  name: string;
  F: number;
  K: number;
  description: string;
}

export const REACTION_DIFFUSION_PRESETS: Record<string, ReactionDiffusionPreset> = {
  solitons: {
    name: 'Solitons',
    F: 0.030,
    K: 0.062,
    description: 'Autonomous localized traveling solitary waves and elastic collisions'
  },
  spots: {
    name: 'Spots',
    F: 0.034,
    K: 0.065,
    description: 'Mitotic self-replicating spots and organelle clusters'
  },
  labyrinth: {
    name: 'Labyrinth',
    F: 0.029,
    K: 0.057,
    description: 'Convoluted meanders, finger patterns, and brain coral folds'
  },
  coral: {
    name: 'Coral',
    F: 0.0545,
    K: 0.062,
    description: 'Branching coral tree dendrites and crystal morphogenesis'
  },
  chaos: {
    name: 'Chaos',
    F: 0.026,
    K: 0.055,
    description: 'Turbulent spatio-temporal chaos and dissolving morphogens'
  },
  spirals: {
    name: 'Spirals',
    F: 0.018,
    K: 0.051,
    description: 'Self-propagating rotating spiral chemical waves'
  },
  worms: {
    name: 'Worms',
    F: 0.058,
    K: 0.065,
    description: 'Pulsating vermicular tubules and bio-filament networks'
  }
};

export interface ReactionDiffusionOptions {
  width?: number;
  height?: number;
  feed?: number;
  kill?: number;
  du?: number;
  dv?: number;
  substeps?: number;
}

/**
 * Continuous Gray-Scott Reaction-Diffusion morphogen simulation.
 * Solves:
 *   dU/dt = Du * laplacian(U) - U * V^2 + F * (1 - U)
 *   dV/dt = Dv * laplacian(V) + U * V^2 - (F + K) * V
 *
 * Uses dual-buffered Float32Array ping-pong grids with a 9-point isotropic Laplacian.
 * Runs multiple numerical sub-steps per frame for rapid, stable pattern crystallization.
 * Zero-GC execution with pre-allocated Three.js DataTexture.
 */
export class ReactionDiffusion {
  public readonly width: number;
  public readonly height: number;
  public readonly size: number;

  // Reaction rates
  public F: number;
  public K: number;
  public Du: number;
  public Dv: number;
  public substeps: number;

  // Dual-buffered chemical concentration grids
  public gridU: Float32Array;
  public gridV: Float32Array;
  public nextU: Float32Array;
  public nextV: Float32Array;

  // Three.js DataTexture for GPU shader sampling
  private texture: THREE.DataTexture;
  private textureData: Float32Array;

  // Scratch return object for zero-allocation point sampling
  private scratchSample = { u: 0, v: 0 };

  constructor(options: ReactionDiffusionOptions = {}) {
    this.width = options.width ?? 256;
    this.height = options.height ?? 256;
    this.size = this.width * this.height;

    this.F = options.feed ?? 0.034;
    this.K = options.kill ?? 0.065;
    this.Du = options.du ?? 0.2097;
    this.Dv = options.dv ?? 0.105;
    this.substeps = options.substeps ?? 8;

    this.gridU = new Float32Array(this.size);
    this.gridV = new Float32Array(this.size);
    this.nextU = new Float32Array(this.size);
    this.nextV = new Float32Array(this.size);

    // Initial chemical state: U saturated (1.0), V zero (0.0)
    this.gridU.fill(1.0);
    this.gridV.fill(0.0);
    this.nextU.fill(1.0);
    this.nextV.fill(0.0);

    // RGBA Float32 Texture:
    // R: U concentration, G: V concentration, B: V - U difference, A: 1.0
    this.textureData = new Float32Array(this.size * 4);
    this.texture = new THREE.DataTexture(
      this.textureData as unknown as BufferSource,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.generateMipmaps = false;

    // Seed initial morphogen disturbances
    this.seedInitialMorphogens();
  }

  /**
   * Seed multiple asymmetric morphogen clusters to jump-start morphogenesis.
   */
  public seedInitialMorphogens(): void {
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const r = Math.min(this.width, this.height) * 0.12;

    this.inject(cx, cy, r, 0.9);
    this.inject(cx + r * 1.2, cy - r * 0.8, r * 0.5, 0.8);
    this.inject(cx - r * 1.1, cy + r * 0.9, r * 0.6, 0.85);
    this.inject(cx + r * 0.4, cy + r * 1.5, r * 0.4, 0.75);
  }

  /**
   * Inject chemical V (inhibitor / morphogen) at grid or normalized coordinates.
   */
  public inject(x: number, y: number, radius = 10.0, amount = 0.9): void {
    const w = this.width;
    const h = this.height;

    const gx = x <= 1.0 && x >= 0 ? x * w : x;
    const gy = y <= 1.0 && y >= 0 ? y * h : y;

    const r = Math.max(1.0, radius);
    const rSq = r * r;

    const minX = Math.floor(gx - r);
    const maxX = Math.ceil(gx + r);
    const minY = Math.floor(gy - r);
    const maxY = Math.ceil(gy + r);

    const gu = this.gridU;
    const gv = this.gridV;

    for (let j = minY; j <= maxY; j++) {
      const wrappedY = ((j % h) + h) % h;
      const dy = j - gy;
      const dySq = dy * dy;
      const row = wrappedY * w;

      for (let i = minX; i <= maxX; i++) {
        const wrappedX = ((i % w) + w) % w;
        const dx = i - gx;
        const distSq = dx * dx + dySq;

        if (distSq <= rSq) {
          const factor = Math.exp(-distSq / (rSq * 0.4)) * amount;
          const idx = wrappedX + row;
          gv[idx] = Math.min(1.0, gv[idx] + factor);
          gu[idx] = Math.max(0.0, gu[idx] - factor * 0.6);
        }
      }
    }
  }

  /**
   * Continuous bilinear interpolation of chemical concentrations U and V.
   */
  public sample(x: number, y: number): { u: number; v: number } {
    const w = this.width;
    const h = this.height;

    const gx = x <= 1.0 && x >= 0 ? x * w : x;
    const gy = y <= 1.0 && y >= 0 ? y * h : y;

    const wrappedX = ((gx % w) + w) % w;
    const wrappedY = ((gy % h) + h) % h;

    const x0 = Math.floor(wrappedX);
    const y0 = Math.floor(wrappedY);
    const x1 = (x0 + 1) % w;
    const y1 = (y0 + 1) % h;

    const fx = wrappedX - x0;
    const fy = wrappedY - y0;

    const gu = this.gridU;
    const gv = this.gridV;
    const row0 = y0 * w;
    const row1 = y1 * w;

    const uTL = gu[x0 + row0];
    const uTR = gu[x1 + row0];
    const uBL = gu[x0 + row1];
    const uBR = gu[x1 + row1];
    const uVal = (uTL + (uTR - uTL) * fx) * (1.0 - fy) + (uBL + (uBR - uBL) * fx) * fy;

    const vTL = gv[x0 + row0];
    const vTR = gv[x1 + row0];
    const vBL = gv[x0 + row1];
    const vBR = gv[x1 + row1];
    const vVal = (vTL + (vTR - vTL) * fx) * (1.0 - fy) + (vBL + (vBR - vBL) * fx) * fy;

    this.scratchSample.u = uVal;
    this.scratchSample.v = vVal;
    return this.scratchSample;
  }

  /**
   * Set active preset by key name.
   */
  public setPreset(name: string): void {
    const preset = REACTION_DIFFUSION_PRESETS[name];
    if (preset) {
      this.F = preset.F;
      this.K = preset.K;
    }
  }
  public setParameters(feed: number, kill: number): void {
    this.F = feed;
    this.K = kill;
  }

  /**
   * Step the Reaction-Diffusion simulation forward in time.
   * Executes multiple numerical sub-steps per frame using a 9-point isotropic Laplacian.
   */
  public step(dt = 1.0): void {
    const steps = this.substeps;
    const dtSub = (dt / steps) * 1.0;

    for (let s = 0; s < steps; s++) {
      this.computeStep(dtSub);
    }
  }

  /**
   * Single integration sub-step with ping-pong buffer swap.
   */
  private computeStep(dt: number): void {
    const w = this.width;
    const h = this.height;
    const gu = this.gridU;
    const gv = this.gridV;
    const nu = this.nextU;
    const nv = this.nextV;

    const f = this.F;
    const k = this.K;
    const du = this.Du;
    const dv = this.Dv;

    // 9-point isotropic discrete Laplacian kernel:
    // Direct neighbors: 0.2
    // Diagonal neighbors: 0.05
    // Center: -1.0
    for (let y = 0; y < h; y++) {
      const yPrev = (y - 1 + h) % h;
      const yNext = (y + 1) % h;

      const row = y * w;
      const rowPrev = yPrev * w;
      const rowNext = yNext * w;

      for (let x = 0; x < w; x++) {
        const xPrev = (x - 1 + w) % w;
        const xNext = (x + 1) % w;

        const idx = x + row;
        const u = gu[idx];
        const v = gv[idx];

        // Laplacian of U
        const lapU =
          0.2 * (gu[xPrev + row] + gu[xNext + row] + gu[x + rowPrev] + gu[x + rowNext]) +
          0.05 * (gu[xPrev + rowPrev] + gu[xNext + rowPrev] + gu[xPrev + rowNext] + gu[xNext + rowNext]) -
          u;

        // Laplacian of V
        const lapV =
          0.2 * (gv[xPrev + row] + gv[xNext + row] + gv[x + rowPrev] + gv[x + rowNext]) +
          0.05 * (gv[xPrev + rowPrev] + gv[xNext + rowPrev] + gv[xPrev + rowNext] + gv[xNext + rowNext]) -
          v;

        // Reaction term: UV^2
        const uv2 = u * v * v;

        // Gray-Scott governing PDEs:
        // dU/dt = Du * lapU - uv2 + F * (1 - u)
        // dV/dt = Dv * lapV + uv2 - (F + K) * v
        const du_dt = du * lapU - uv2 + f * (1.0 - u);
        const dv_dt = dv * lapV + uv2 - (f + k) * v;

        // Integrate with clamping to preserve stability
        const nextUVal = u + du_dt * dt;
        const nextVVal = v + dv_dt * dt;

        nu[idx] = Math.max(0.0, Math.min(1.0, nextUVal));
        nv[idx] = Math.max(0.0, Math.min(1.0, nextVVal));
      }
    }

    // Ping-pong copy
    gu.set(nu);
    gv.set(nv);
  }

  /**
   * Updates and returns Three.js DataTexture of chemical concentrations.
   * RGBA: [U, V, V - U (morphogen contrast), 1.0]
   */
  public getTexture(): THREE.DataTexture {
    const texData = this.textureData;
    const gu = this.gridU;
    const gv = this.gridV;
    const len = this.size;

    let p = 0;
    for (let i = 0; i < len; i++) {
      const u = gu[i];
      const v = gv[i];
      texData[p] = u;
      texData[p + 1] = v;
      // Morphological contrast channel for organic shader rendering
      texData[p + 2] = Math.max(0.0, v * 1.5 - u * 0.5);
      texData[p + 3] = 1.0;
      p += 4;
    }

    this.texture.needsUpdate = true;
    return this.texture;
  }

  /**
   * Compute total organic entropy of the morphogen pattern.
   */
  public getMorphogenEntropy(): number {
    let entropy = 0.0;
    const gv = this.gridV;
    const len = this.size;

    let sum = 0.0;
    for (let i = 0; i < len; i += 8) {
      sum += gv[i];
    }
    if (sum <= 1e-6) return 0.0;

    for (let i = 0; i < len; i += 8) {
      const val = gv[i];
      if (val > 1e-6) {
        const p = val / sum;
        entropy -= p * (Math.log(p) * 1.4426950408889634);
      }
    }
    return entropy;
  }

  /**
   * Reset the simulation to chemical baseline and seed new morphogen clusters.
   */
  public reset(): void {
    this.gridU.fill(1.0);
    this.gridV.fill(0.0);
    this.nextU.fill(1.0);
    this.nextV.fill(0.0);
    this.seedInitialMorphogens();
  }

  /**
   * Dispose allocated textures.
   */
  public dispose(): void {
    this.texture.dispose();
  }
}
