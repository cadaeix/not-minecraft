import * as THREE from 'three';

export interface FluidSimulatorOptions {
  width?: number;
  height?: number;
  viscosity?: number;
  vorticityStrength?: number;
  iterations?: number;
  diffusion?: number;
  decay?: number;
}

/**
 * High-performance 2D continuous Eulerian Navier-Stokes fluid velocity solver.
 * Uses semi-Lagrangian advection, Jacobi pressure projection, viscous diffusion,
 * and vorticity confinement to sustain turbulent vortices.
 * Zero per-frame GC allocations with pre-allocated Float32Array buffers and DataTextures.
 */
export class FluidSimulator {
  public readonly width: number;
  public readonly height: number;
  public readonly size: number;

  public viscosity: number;
  public vorticityStrength: number;
  public iterations: number;
  public diffusion: number;
  public decay: number;

  // Staggered / collocated velocity fields (u = x velocity, v = y velocity)
  public u: Float32Array;
  public v: Float32Array;
  public uPrev: Float32Array;
  public vPrev: Float32Array;

  // Density / dye field
  public density: Float32Array;
  public densityPrev: Float32Array;

  // Pressure and divergence fields for Poisson solver
  public pressure: Float32Array;
  public divergence: Float32Array;

  // Vorticity field
  public vorticity: Float32Array;

  // Three.js DataTextures for GPU sampling
  private densityTexture: THREE.DataTexture;
  private velocityTexture: THREE.DataTexture;
  private densityTextureData: Float32Array;
  private velocityTextureData: Float32Array;

  // Scratch vector for bilinear interpolation without object creation
  private scratchVelocity: [number, number] = [0, 0];

  constructor(options: FluidSimulatorOptions = {}) {
    this.width = options.width ?? 128;
    this.height = options.height ?? 128;
    this.size = this.width * this.height;

    this.viscosity = options.viscosity ?? 0.0001;
    this.vorticityStrength = options.vorticityStrength ?? 0.35;
    this.iterations = options.iterations ?? 20;
    this.diffusion = options.diffusion ?? 0.00005;
    this.decay = options.decay ?? 0.997;

    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
    this.uPrev = new Float32Array(this.size);
    this.vPrev = new Float32Array(this.size);

    this.density = new Float32Array(this.size);
    this.densityPrev = new Float32Array(this.size);

    this.pressure = new Float32Array(this.size);
    this.divergence = new Float32Array(this.size);
    this.vorticity = new Float32Array(this.size);

    // Initialize RGBA Float32 textures
    // Density texture: R = density, G = vorticity, B = kinetic energy, A = 1.0
    this.densityTextureData = new Float32Array(this.size * 4);
    this.densityTexture = new THREE.DataTexture(
      this.densityTextureData as unknown as BufferSource,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.densityTexture.minFilter = THREE.LinearFilter;
    this.densityTexture.magFilter = THREE.LinearFilter;
    this.densityTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.densityTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.densityTexture.generateMipmaps = false;

    // Velocity texture: R = u, G = v, B = speed, A = 1.0
    this.velocityTextureData = new Float32Array(this.size * 4);
    this.velocityTexture = new THREE.DataTexture(
      this.velocityTextureData as unknown as BufferSource,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.velocityTexture.minFilter = THREE.LinearFilter;
    this.velocityTexture.magFilter = THREE.LinearFilter;
    this.velocityTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.velocityTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.velocityTexture.generateMipmaps = false;
  }

  /**
   * Linear 2D index helper with boundary clamping.
   */
  public getIndex(x: number, y: number): number {
    const ix = Math.max(0, Math.min(this.width - 1, x | 0));
    const iy = Math.max(0, Math.min(this.height - 1, y | 0));
    return ix + iy * this.width;
  }

  /**
   * Add directional velocity impulse at grid or normalized coordinates.
   * If x or y are in [0, 1], they are mapped to grid dimensions.
   */
  public addVelocity(x: number, y: number, vx: number, vy: number, radius = 3.0): void {
    const gx = x <= 1.0 && x >= 0 ? x * (this.width - 1) : x;
    const gy = y <= 1.0 && y >= 0 ? y * (this.height - 1) : y;
    const r = Math.max(1, radius);
    const rSq = r * r;

    const minX = Math.max(1, Math.floor(gx - r));
    const maxX = Math.min(this.width - 2, Math.ceil(gx + r));
    const minY = Math.max(1, Math.floor(gy - r));
    const maxY = Math.min(this.height - 2, Math.ceil(gy + r));

    for (let j = minY; j <= maxY; j++) {
      const dy = j - gy;
      const dySq = dy * dy;
      for (let i = minX; i <= maxX; i++) {
        const dx = i - gx;
        const distSq = dx * dx + dySq;
        if (distSq <= rSq) {
          const factor = Math.exp(-distSq / (rSq * 0.5));
          const idx = i + j * this.width;
          this.u[idx] += vx * factor;
          this.v[idx] += vy * factor;
        }
      }
    }
  }

  /**
   * Add scalar density / dye impulse at grid or normalized coordinates.
   */
  public addDensity(x: number, y: number, amount: number, radius = 3.5): void {
    const gx = x <= 1.0 && x >= 0 ? x * (this.width - 1) : x;
    const gy = y <= 1.0 && y >= 0 ? y * (this.height - 1) : y;
    const r = Math.max(1, radius);
    const rSq = r * r;

    const minX = Math.max(0, Math.floor(gx - r));
    const maxX = Math.min(this.width - 1, Math.ceil(gx + r));
    const minY = Math.max(0, Math.floor(gy - r));
    const maxY = Math.min(this.height - 1, Math.ceil(gy + r));

    for (let j = minY; j <= maxY; j++) {
      const dy = j - gy;
      const dySq = dy * dy;
      for (let i = minX; i <= maxX; i++) {
        const dx = i - gx;
        const distSq = dx * dx + dySq;
        if (distSq <= rSq) {
          const factor = Math.exp(-distSq / (rSq * 0.5));
          const idx = i + j * this.width;
          this.density[idx] = Math.min(10.0, this.density[idx] + amount * factor);
        }
      }
    }
  }

  /**
   * Continuous bilinear interpolation of fluid velocity at arbitrary continuous (x, y).
   * Supports normalized [0, 1] or grid [0, width] coordinates.
   */
  public getVelocity(x: number, y: number): [number, number] {
    const gx = x <= 1.0 && x >= 0 ? x * (this.width - 1) : Math.max(0, Math.min(this.width - 1, x));
    const gy = y <= 1.0 && y >= 0 ? y * (this.height - 1) : Math.max(0, Math.min(this.height - 1, y));

    const x0 = Math.floor(gx);
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y0 = Math.floor(gy);
    const y1 = Math.min(this.height - 1, y0 + 1);

    const s1 = gx - x0;
    const s0 = 1.0 - s1;
    const t1 = gy - y0;
    const t0 = 1.0 - t1;

    const row0 = y0 * this.width;
    const row1 = y1 * this.width;

    const uVal =
      s0 * (t0 * this.u[x0 + row0] + t1 * this.u[x0 + row1]) +
      s1 * (t0 * this.u[x1 + row0] + t1 * this.u[x1 + row1]);

    const vVal =
      s0 * (t0 * this.v[x0 + row0] + t1 * this.v[x0 + row1]) +
      s1 * (t0 * this.v[x1 + row0] + t1 * this.v[x1 + row1]);

    this.scratchVelocity[0] = uVal;
    this.scratchVelocity[1] = vVal;
    return this.scratchVelocity;
  }

  /**
   * Continuous bilinear interpolation of fluid vorticity curl(u, v).
   */
  public getVorticity(x: number, y: number): number {
    const gx = x <= 1.0 && x >= 0 ? x * (this.width - 1) : Math.max(0, Math.min(this.width - 1, x));
    const gy = y <= 1.0 && y >= 0 ? y * (this.height - 1) : Math.max(0, Math.min(this.height - 1, y));

    const x0 = Math.floor(gx);
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y0 = Math.floor(gy);
    const y1 = Math.min(this.height - 1, y0 + 1);

    const s1 = gx - x0;
    const s0 = 1.0 - s1;
    const t1 = gy - y0;
    const t0 = 1.0 - t1;

    const row0 = y0 * this.width;
    const row1 = y1 * this.width;

    return (
      s0 * (t0 * this.vorticity[x0 + row0] + t1 * this.vorticity[x0 + row1]) +
      s1 * (t0 * this.vorticity[x1 + row0] + t1 * this.vorticity[x1 + row1])
    );
  }

  /**
   * Continuous bilinear interpolation of density at arbitrary coordinates.
   */
  public getDensity(x: number, y: number): number {
    const gx = x <= 1.0 && x >= 0 ? x * (this.width - 1) : Math.max(0, Math.min(this.width - 1, x));
    const gy = y <= 1.0 && y >= 0 ? y * (this.height - 1) : Math.max(0, Math.min(this.height - 1, y));

    const x0 = Math.floor(gx);
    const x1 = Math.min(this.width - 1, x0 + 1);
    const y0 = Math.floor(gy);
    const y1 = Math.min(this.height - 1, y0 + 1);

    const s1 = gx - x0;
    const s0 = 1.0 - s1;
    const t1 = gy - y0;
    const t0 = 1.0 - t1;

    const row0 = y0 * this.width;
    const row1 = y1 * this.width;

    return (
      s0 * (t0 * this.density[x0 + row0] + t1 * this.density[x0 + row1]) +
      s1 * (t0 * this.density[x1 + row0] + t1 * this.density[x1 + row1])
    );
  }

  /**
   * Compute total kinetic energy: 0.5 * sum(u^2 + v^2) across the continuum.
   */
  public getKineticEnergy(): number {
    let sum = 0.0;
    const len = this.size;
    const uArr = this.u;
    const vArr = this.v;
    for (let i = 0; i < len; i++) {
      sum += uArr[i] * uArr[i] + vArr[i] * vArr[i];
    }
    return 0.5 * sum;
  }

  /**
   * Compute fluid field entropy / gradient complexity.
   */
  public getEntropy(): number {
    let energySum = 0.0;
    const len = this.size;
    const uArr = this.u;
    const vArr = this.v;
    for (let i = 0; i < len; i++) {
      energySum += Math.sqrt(uArr[i] * uArr[i] + vArr[i] * vArr[i]);
    }
    if (energySum <= 1e-6) return 0.0;

    let entropy = 0.0;
    for (let i = 0; i < len; i += 4) {
      const mag = Math.sqrt(uArr[i] * uArr[i] + vArr[i] * vArr[i]);
      if (mag > 1e-6) {
        const p = mag / energySum;
        entropy -= p * (Math.log(p) * 1.4426950408889634);
      }
    }
    return entropy;
  }

  /**
   * Execute one full Navier-Stokes time integration step:
   * 1. Vorticity computation & confinement
   * 2. Viscous diffusion (velocity & density)
   * 3. Pressure Poisson projection (divergence-free velocity)
   * 4. Semi-Lagrangian advection (velocity & density)
   * 5. Pressure Poisson projection (final incompressibility)
   * 6. Density decay & boundary enforcement
   */
  public step(dt: number): void {
    const clampedDt = Math.max(0.001, Math.min(0.05, dt));

    // 1. Compute vorticity and apply vorticity confinement force
    this.computeVorticity();
    if (this.vorticityStrength > 0) {
      this.applyVorticityConfinement(clampedDt);
    }

    // 2. Viscous velocity diffusion
    if (this.viscosity > 0) {
      this.uPrev.set(this.u);
      this.vPrev.set(this.v);
      this.diffuse(1, this.u, this.uPrev, this.viscosity, clampedDt);
      this.diffuse(2, this.v, this.vPrev, this.viscosity, clampedDt);
    }

    // 3. Pressure projection to enforce incompressibility before advection
    this.project(this.u, this.v, this.pressure, this.divergence);

    // 4. Semi-Lagrangian advection of velocity
    this.uPrev.set(this.u);
    this.vPrev.set(this.v);
    this.advect(1, this.u, this.uPrev, this.uPrev, this.vPrev, clampedDt);
    this.advect(2, this.v, this.vPrev, this.uPrev, this.vPrev, clampedDt);

    // 5. Final pressure projection to preserve zero divergence
    this.project(this.u, this.v, this.pressure, this.divergence);

    // 6. Density diffusion and advection
    if (this.diffusion > 0) {
      this.densityPrev.set(this.density);
      this.diffuse(0, this.density, this.densityPrev, this.diffusion, clampedDt);
    }

    this.densityPrev.set(this.density);
    this.advect(0, this.density, this.densityPrev, this.u, this.v, clampedDt);

    // 7. Density dissipation
    const decayFactor = Math.pow(this.decay, clampedDt * 60.0);
    const len = this.size;
    const dens = this.density;
    for (let i = 0; i < len; i++) {
      dens[i] *= decayFactor;
    }

    // Recompute vorticity for export / sampling
    this.computeVorticity();
  }

  /**
   * Semi-Lagrangian advection: traces particle trajectory back in time and interpolates.
   * b: boundary condition mode (0: scalar density, 1: horizontal velocity, 2: vertical velocity)
   */
  private advect(
    b: number,
    d: Float32Array,
    d0: Float32Array,
    uArr: Float32Array,
    vArr: Float32Array,
    dt: number
  ): void {
    const w = this.width;
    const h = this.height;
    const dt0 = dt * (w - 2);

    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      for (let i = 1; i < w - 1; i++) {
        const idx = i + row;
        let x = i - dt0 * uArr[idx];
        let y = j - dt0 * vArr[idx];

        if (x < 0.5) x = 0.5;
        if (x > w - 1.5) x = w - 1.5;
        const i0 = Math.floor(x);
        const i1 = i0 + 1;

        if (y < 0.5) y = 0.5;
        if (y > h - 1.5) y = h - 1.5;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1.0 - s1;
        const t1 = y - j0;
        const t0 = 1.0 - t1;

        const row0 = j0 * w;
        const row1 = j1 * w;

        d[idx] =
          s0 * (t0 * d0[i0 + row0] + t1 * d0[i0 + row1]) +
          s1 * (t0 * d0[i1 + row0] + t1 * d0[i1 + row1]);
      }
    }
    this.setBoundary(b, d);
  }

  /**
   * Implicit Gauss-Seidel / Jacobi relaxation for diffusion.
   */
  private diffuse(
    b: number,
    x: Float32Array,
    x0: Float32Array,
    diff: number,
    dt: number
  ): void {
    const w = this.width;
    const h = this.height;
    const a = dt * diff * (w - 2) * (h - 2);
    const c = 1.0 + 4.0 * a;
    const invC = 1.0 / c;
    const iters = this.iterations;

    for (let k = 0; k < iters; k++) {
      for (let j = 1; j < h - 1; j++) {
        const row = j * w;
        for (let i = 1; i < w - 1; i++) {
          const idx = i + row;
          x[idx] = (x0[idx] + a * (x[idx - 1] + x[idx + 1] + x[idx - w] + x[idx + w])) * invC;
        }
      }
      this.setBoundary(b, x);
    }
  }

  /**
   * Helmholtz-Hodge projection to resolve incompressibility (divergence = 0).
   * Solves Poisson equation: laplacian(p) = divergence(u)
   */
  private project(
    uArr: Float32Array,
    vArr: Float32Array,
    pArr: Float32Array,
    divArr: Float32Array
  ): void {
    const w = this.width;
    const h = this.height;
    const invW = 1.0 / (w - 2);
    const invH = 1.0 / (h - 2);
    const iters = this.iterations;

    // Calculate divergence
    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      for (let i = 1; i < w - 1; i++) {
        const idx = i + row;
        divArr[idx] =
          -0.5 *
          (invW * (uArr[idx + 1] - uArr[idx - 1]) +
           invH * (vArr[idx + w] - vArr[idx - w]));
        pArr[idx] = 0;
      }
    }
    this.setBoundary(0, divArr);
    this.setBoundary(0, pArr);

    // Jacobi / Gauss-Seidel solver for pressure field
    for (let k = 0; k < iters; k++) {
      for (let j = 1; j < h - 1; j++) {
        const row = j * w;
        for (let i = 1; i < w - 1; i++) {
          const idx = i + row;
          pArr[idx] = (divArr[idx] + pArr[idx - 1] + pArr[idx + 1] + pArr[idx - w] + pArr[idx + w]) * 0.25;
        }
      }
      this.setBoundary(0, pArr);
    }

    // Subtract pressure gradient from velocity to make field solenoidal
    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      for (let i = 1; i < w - 1; i++) {
        const idx = i + row;
        uArr[idx] -= 0.5 * (pArr[idx + 1] - pArr[idx - 1]) * (w - 2);
        vArr[idx] -= 0.5 * (pArr[idx + w] - pArr[idx - w]) * (h - 2);
      }
    }
    this.setBoundary(1, uArr);
    this.setBoundary(2, vArr);
  }

  /**
   * Compute 2D vorticity: curl(u, v) = dv/dx - du/dy
   */
  private computeVorticity(): void {
    const w = this.width;
    const h = this.height;
    const uArr = this.u;
    const vArr = this.v;
    const vort = this.vorticity;

    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      for (let i = 1; i < w - 1; i++) {
        const idx = i + row;
        const dv_dx = (vArr[idx + 1] - vArr[idx - 1]) * 0.5;
        const du_dy = (uArr[idx + w] - uArr[idx - w]) * 0.5;
        vort[idx] = dv_dx - du_dy;
      }
    }
    this.setBoundary(0, vort);
  }

  /**
   * Vorticity confinement: adds artificial energy back into vortices to counteract numerical dissipation.
   * F_conf = epsilon * (N x omega) where N = grad(|omega|) / |grad(|omega|)|
   */
  private applyVorticityConfinement(dt: number): void {
    const w = this.width;
    const h = this.height;
    const vort = this.vorticity;
    const uArr = this.u;
    const vArr = this.v;
    const eps = this.vorticityStrength;

    for (let j = 2; j < h - 2; j++) {
      const row = j * w;
      for (let i = 2; i < w - 2; i++) {
        const idx = i + row;

        // Gradient of vorticity magnitude
        const dw_dx = (Math.abs(vort[idx + 1]) - Math.abs(vort[idx - 1])) * 0.5;
        const dw_dy = (Math.abs(vort[idx + w]) - Math.abs(vort[idx - w])) * 0.5;

        const len = Math.sqrt(dw_dx * dw_dx + dw_dy * dw_dy) + 1e-6;
        const nx = dw_dx / len;
        const ny = dw_dy / len;

        // In 2D, (N x omega) force: Fx = ny * omega, Fy = -nx * omega
        const omega = vort[idx];
        const fx = ny * omega * eps;
        const fy = -nx * omega * eps;

        uArr[idx] += fx * dt;
        vArr[idx] += fy * dt;
      }
    }
  }

  /**
   * Boundary condition handling:
   * b = 0: scalar field (mirror/continuation)
   * b = 1: horizontal velocity (reflection / no-slip on vertical walls)
   * b = 2: vertical velocity (reflection / no-slip on horizontal walls)
   */
  private setBoundary(b: number, x: Float32Array): void {
    const w = this.width;
    const h = this.height;

    for (let i = 1; i < w - 1; i++) {
      x[i] = b === 2 ? -x[i + w] : x[i + w];
      x[i + (h - 1) * w] = b === 2 ? -x[i + (h - 2) * w] : x[i + (h - 2) * w];
    }
    for (let j = 1; j < h - 1; j++) {
      const row = j * w;
      x[row] = b === 1 ? -x[1 + row] : x[1 + row];
      x[w - 1 + row] = b === 1 ? -x[w - 2 + row] : x[w - 2 + row];
    }

    // Corners
    x[0] = 0.5 * (x[1] + x[w]);
    x[w - 1] = 0.5 * (x[w - 2] + x[2 * w - 1]);
    x[(h - 1) * w] = 0.5 * (x[(h - 2) * w] + x[(h - 1) * w + 1]);
    x[w * h - 1] = 0.5 * (x[w * h - 2] + x[(h - 1) * w - 1]);
  }

  /**
   * Updates and returns Three.js DataTexture of density & vorticity.
   * RGBA: [Density, Vorticity, Kinetic Energy, 1.0]
   */
  public getDensityTexture(): THREE.DataTexture {
    const texData = this.densityTextureData;
    const dens = this.density;
    const vort = this.vorticity;
    const uArr = this.u;
    const vArr = this.v;
    const len = this.size;

    let p = 0;
    for (let i = 0; i < len; i++) {
      texData[p] = dens[i];
      texData[p + 1] = vort[i];
      texData[p + 2] = 0.5 * (uArr[i] * uArr[i] + vArr[i] * vArr[i]);
      texData[p + 3] = 1.0;
      p += 4;
    }

    this.densityTexture.needsUpdate = true;
    return this.densityTexture;
  }

  /**
   * Updates and returns Three.js DataTexture of velocity vector field.
   * RGBA: [u, v, speed, 1.0]
   */
  public getVelocityTexture(): THREE.DataTexture {
    const texData = this.velocityTextureData;
    const uArr = this.u;
    const vArr = this.v;
    const len = this.size;

    let p = 0;
    for (let i = 0; i < len; i++) {
      const ux = uArr[i];
      const vy = vArr[i];
      texData[p] = ux;
      texData[p + 1] = vy;
      texData[p + 2] = Math.sqrt(ux * ux + vy * vy);
      texData[p + 3] = 1.0;
      p += 4;
    }

    this.velocityTexture.needsUpdate = true;
    return this.velocityTexture;
  }

  /**
   * Reset simulation fields to zero.
   */
  public reset(): void {
    this.u.fill(0);
    this.v.fill(0);
    this.uPrev.fill(0);
    this.vPrev.fill(0);
    this.density.fill(0);
    this.densityPrev.fill(0);
    this.pressure.fill(0);
    this.divergence.fill(0);
    this.vorticity.fill(0);
    this.densityTextureData.fill(0);
    this.velocityTextureData.fill(0);
    this.densityTexture.needsUpdate = true;
    this.velocityTexture.needsUpdate = true;
  }

  /**
   * Dispose allocated WebGL textures.
   */
  public dispose(): void {
    this.densityTexture.dispose();
    this.velocityTexture.dispose();
  }
}
