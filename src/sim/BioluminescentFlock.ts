import * as THREE from 'three';
import { FluidSimulator } from './FluidSimulator';

export interface GravitonImpulse {
  position: THREE.Vector3;
  strength: number;
  radius: number;
  life: number;
  decay: number;
}

export interface FlockOptions {
  count?: number;
  trailLength?: number;
  containmentRadius?: number;
  maxSpeed?: number;
  maxForce?: number;
  separationDist?: number;
  neighborDist?: number;
}

/**
 * 3D Bioluminescent Soft-Body Symbiotic Flock.
 * Simulates 100-300+ graceful pelagic organisms swimming through continuous space.
 * Features:
 * - Craig Reynolds 3D Boids flocking (Separation, Alignment, Cohesion)
 * - Continuous Eulerian-Lagrangian Navier-Stokes fluid velocity advection coupling
 * - Non-linear Graviton attraction & cosmic shockwave repulsion
 * - Oscillating sine-wave bioluminescent respiration & collision/acceleration excitation
 * - Trailing soft-body tentacle / spine history buffers for continuous organic ribbon rendering
 * - 100% zero per-frame garbage collection allocations
 */
export class BioluminescentFlock {
  public readonly count: number;
  public readonly trailLength: number;
  public containmentRadius: number;
  public maxSpeed: number;
  public maxForce: number;
  public separationDist: number;
  public neighborDist: number;

  // Packed State Arrays (SoA for cache locality)
  public posX: Float32Array;
  public posY: Float32Array;
  public posZ: Float32Array;

  public velX: Float32Array;
  public velY: Float32Array;
  public velZ: Float32Array;

  public accX: Float32Array;
  public accY: Float32Array;
  public accZ: Float32Array;

  // Bioluminescence state
  public baseIntensity: Float32Array;
  public excitation: Float32Array;
  public breathingFrequency: Float32Array;
  public breathingPhase: Float32Array;
  public colorR: Float32Array;
  public colorG: Float32Array;
  public colorB: Float32Array;

  // Tentacle / Spine trail history: [count * trailLength * 3]
  public trailHistory: Float32Array;
  public trailIndices: Int32Array; // ring buffer write head per entity

  // Packed buffers for Three.js geometry / instancing
  public packedPositions: Float32Array;   // count * 3
  public packedVelocities: Float32Array;  // count * 3
  public packedIntensities: Float32Array; // count (scalar intensity)
  public packedColors: Float32Array;      // count * 3 (RGB)
  public ribbonPositions: Float32Array;   // count * trailLength * 3
  public ribbonColors: Float32Array;      // count * trailLength * 4 (RGBA)

  // Graviton list
  private activeGravitons: GravitonImpulse[] = [];

  // Scratch vectors for zero per-frame heap allocations
  private scratchVec = new THREE.Vector3();
  private scratchQuat = new THREE.Quaternion();
  private scratchMatrix = new THREE.Matrix4();

  // Internal time accumulator
  private time: number = 0;

  constructor(options: FlockOptions = {}) {
    this.count = options.count ?? 160;
    this.trailLength = options.trailLength ?? 14;
    this.containmentRadius = options.containmentRadius ?? 45.0;
    this.maxSpeed = options.maxSpeed ?? 9.5;
    this.maxForce = options.maxForce ?? 14.0;
    this.separationDist = options.separationDist ?? 4.2;
    this.neighborDist = options.neighborDist ?? 14.0;

    const n = this.count;
    this.posX = new Float32Array(n);
    this.posY = new Float32Array(n);
    this.posZ = new Float32Array(n);

    this.velX = new Float32Array(n);
    this.velY = new Float32Array(n);
    this.velZ = new Float32Array(n);

    this.accX = new Float32Array(n);
    this.accY = new Float32Array(n);
    this.accZ = new Float32Array(n);

    this.baseIntensity = new Float32Array(n);
    this.excitation = new Float32Array(n);
    this.breathingFrequency = new Float32Array(n);
    this.breathingPhase = new Float32Array(n);

    this.colorR = new Float32Array(n);
    this.colorG = new Float32Array(n);
    this.colorB = new Float32Array(n);

    this.trailHistory = new Float32Array(n * this.trailLength * 3);
    this.trailIndices = new Int32Array(n);

    this.packedPositions = new Float32Array(n * 3);
    this.packedVelocities = new Float32Array(n * 3);
    this.packedIntensities = new Float32Array(n);
    this.packedColors = new Float32Array(n * 3);

    const totalTrailVertices = n * this.trailLength;
    this.ribbonPositions = new Float32Array(totalTrailVertices * 3);
    this.ribbonColors = new Float32Array(totalTrailVertices * 4);

    this.initializeEntities();
  }

  /**
   * Initialize entities in organic helical spirals with bio-palette colors.
   */
  private initializeEntities(): void {
    const n = this.count;
    const tLen = this.trailLength;

    for (let i = 0; i < n; i++) {
      // Golden spiral distribution in sphere
      const phi = Math.acos(1.0 - (2.0 * (i + 0.5)) / n);
      const theta = Math.PI * (1.0 + Math.sqrt(5.0)) * i;
      const radius = 10.0 + Math.random() * (this.containmentRadius * 0.65);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      this.posX[i] = x;
      this.posY[i] = y;
      this.posZ[i] = z;

      // Initial tangential velocity for orbital swirling
      const speed = 2.0 + Math.random() * 3.0;
      this.velX[i] = -Math.sin(theta) * speed;
      this.velY[i] = Math.cos(theta) * speed;
      this.velZ[i] = (Math.random() - 0.5) * speed;

      // Bioluminescence properties
      this.baseIntensity[i] = 0.4 + Math.random() * 0.4;
      this.excitation[i] = 0.0;
      this.breathingFrequency[i] = 0.8 + Math.random() * 1.5;
      this.breathingPhase[i] = Math.random() * Math.PI * 2.0;

      // Synergistic organic oceanic palette (Turquoise, Bioluminescent Cyan, Coral Violet, Gold)
      const paletteChoice = Math.random();
      if (paletteChoice < 0.4) {
        // Bioluminescent Cyan / Teal
        this.colorR[i] = 0.05 + Math.random() * 0.15;
        this.colorG[i] = 0.85 + Math.random() * 0.15;
        this.colorB[i] = 0.90 + Math.random() * 0.1;
      } else if (paletteChoice < 0.75) {
        // Deep Abyssal Violet / Magenta
        this.colorR[i] = 0.75 + Math.random() * 0.2;
        this.colorG[i] = 0.15 + Math.random() * 0.25;
        this.colorB[i] = 0.95 + Math.random() * 0.05;
      } else {
        // Phosphor Aureolin Gold
        this.colorR[i] = 0.95 + Math.random() * 0.05;
        this.colorG[i] = 0.75 + Math.random() * 0.2;
        this.colorB[i] = 0.20 + Math.random() * 0.2;
      }

      // Initialize trail history at initial location
      const baseOffset = i * tLen * 3;
      for (let t = 0; t < tLen; t++) {
        const off = baseOffset + t * 3;
        this.trailHistory[off] = x;
        this.trailHistory[off + 1] = y;
        this.trailHistory[off + 2] = z;
      }
      this.trailIndices[i] = 0;
    }
  }

  /**
   * Inject a temporary gravitational attractor or repulsive cosmic shockwave.
   */
  public addGraviton(position: THREE.Vector3, strength: number, radius = 35.0): void {
    this.activeGravitons.push({
      position: position.clone(),
      strength,
      radius,
      life: 1.0,
      decay: 0.96
    });
  }

  public applyGravitonImpulse(position: THREE.Vector3, strength: number, radius = 35.0, _duration = 0.5): void {
    this.addGraviton(position, strength, radius);

    // Excitation shockwave to nearby entities
    const px = position.x;
    const py = position.y;
    const pz = position.z;
    const rSq = radius * radius;
    const n = this.count;

    for (let i = 0; i < n; i++) {
      const dx = this.posX[i] - px;
      const dy = this.posY[i] - py;
      const dz = this.posZ[i] - pz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < rSq) {
        const falloff = 1.0 - Math.sqrt(distSq) / radius;
        this.excitation[i] = Math.min(2.5, this.excitation[i] + falloff * 1.8);
      }
    }
  }

  /**
   * Advance flock physics, fluid advection, graviton forces, and tentacle history.
   */
  public step(dt: number, fluidSim?: FluidSimulator): void {
    const clampedDt = Math.max(0.001, Math.min(0.05, dt));
    this.time += clampedDt;

    // Decay gravitons
    for (let g = this.activeGravitons.length - 1; g >= 0; g--) {
      const grav = this.activeGravitons[g];
      grav.life *= grav.decay;
      if (grav.life < 0.02) {
        this.activeGravitons.splice(g, 1);
      }
    }

    const n = this.count;
    const px = this.posX;
    const py = this.posY;
    const pz = this.posZ;
    const vx = this.velX;
    const vy = this.velY;
    const vz = this.velZ;
    const ax = this.accX;
    const ay = this.accY;
    const az = this.accZ;

    const sepDist = this.separationDist;
    const sepDistSq = sepDist * sepDist;
    const neighDist = this.neighborDist;
    const neighDistSq = neighDist * neighDist;

    const maxSpd = this.maxSpeed;
    const maxFrc = this.maxForce;
    const boundRadius = this.containmentRadius;

    // 1. Compute Flocking forces
    for (let i = 0; i < n; i++) {
      let sepX = 0;
      let sepY = 0;
      let sepZ = 0;
      let sepCount = 0;

      let alignX = 0;
      let alignY = 0;
      let alignZ = 0;
      let alignCount = 0;

      let cohX = 0;
      let cohY = 0;
      let cohZ = 0;
      let cohCount = 0;

      const xi = px[i];
      const yi = py[i];
      const zi = pz[i];
      const vxi = vx[i];
      const vyi = vy[i];
      const vzi = vz[i];

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = xi - px[j];
        const dy = yi - py[j];
        const dz = zi - pz[j];
        const dSq = dx * dx + dy * dy + dz * dz;

        // Separation
        if (dSq < sepDistSq && dSq > 1e-4) {
          const invD = 1.0 / Math.sqrt(dSq);
          sepX += dx * invD;
          sepY += dy * invD;
          sepZ += dz * invD;
          sepCount++;
        }

        // Alignment & Cohesion
        if (dSq < neighDistSq && dSq > 1e-4) {
          alignX += vx[j];
          alignY += vy[j];
          alignZ += vz[j];
          alignCount++;

          cohX += px[j];
          cohY += py[j];
          cohZ += pz[j];
          cohCount++;
        }
      }

      let totalAx = 0;
      let totalAy = 0;
      let totalAz = 0;

      // Apply Separation
      if (sepCount > 0) {
        const invSep = 1.0 / sepCount;
        sepX *= invSep;
        sepY *= invSep;
        sepZ *= invSep;
        const len = Math.sqrt(sepX * sepX + sepY * sepY + sepZ * sepZ);
        if (len > 1e-4) {
          const scale = (maxSpd / len);
          totalAx += (sepX * scale - vxi) * 2.2;
          totalAy += (sepY * scale - vyi) * 2.2;
          totalAz += (sepZ * scale - vzi) * 2.2;
        }
      }

      // Apply Alignment
      if (alignCount > 0) {
        const invAlign = 1.0 / alignCount;
        alignX *= invAlign;
        alignY *= invAlign;
        alignZ *= invAlign;
        const len = Math.sqrt(alignX * alignX + alignY * alignY + alignZ * alignZ);
        if (len > 1e-4) {
          const scale = maxSpd / len;
          totalAx += (alignX * scale - vxi) * 1.2;
          totalAy += (alignY * scale - vyi) * 1.2;
          totalAz += (alignZ * scale - vzi) * 1.2;
        }
      }

      // Apply Cohesion
      if (cohCount > 0) {
        const invCoh = 1.0 / cohCount;
        cohX = cohX * invCoh - xi;
        cohY = cohY * invCoh - yi;
        cohZ = cohZ * invCoh - zi;
        const len = Math.sqrt(cohX * cohX + cohY * cohY + cohZ * cohZ);
        if (len > 1e-4) {
          const scale = maxSpd / len;
          totalAx += (cohX * scale - vxi) * 1.0;
          totalAy += (cohY * scale - vyi) * 1.0;
          totalAz += (cohZ * scale - vzi) * 1.0;
        }
      }

      // Smooth cosmic spherical boundary containment
      const distFromCenter = Math.sqrt(xi * xi + yi * yi + zi * zi);
      if (distFromCenter > boundRadius * 0.75) {
        const pushFactor = (distFromCenter - boundRadius * 0.75) / (boundRadius * 0.25);
        const invDist = 1.0 / distFromCenter;
        totalAx -= xi * invDist * pushFactor * 12.0;
        totalAy -= yi * invDist * pushFactor * 12.0;
        totalAz -= zi * invDist * pushFactor * 12.0;
      }

      // 2. Sample 2D fluid solver coupled to 3D orbital plane
      if (fluidSim) {
        // Map (x, z) space to [0, 1] normalized fluid coordinates
        const halfR = boundRadius;
        const normU = Math.max(0.0, Math.min(1.0, (xi + halfR) / (halfR * 2.0)));
        const normV = Math.max(0.0, Math.min(1.0, (zi + halfR) / (halfR * 2.0)));
        const [fU, fV] = fluidSim.getVelocity(normU, normV);

        // Fluid horizontal advection force
        totalAx += fU * 8.0;
        totalAz += fV * 8.0;

        // Fluid vorticity lift in vertical axis
        const vort = fluidSim.getVorticity(normU, normV);
        totalAy += vort * 4.0;
      }

      // 3. Graviton influence
      const numGrav = this.activeGravitons.length;
      for (let g = 0; g < numGrav; g++) {
        const grav = this.activeGravitons[g];
        const gPos = grav.position;
        const gdx = gPos.x - xi;
        const gdy = gPos.y - yi;
        const gdz = gPos.z - zi;
        const gdSq = gdx * gdx + gdy * gdy + gdz * gdz;
        const gRadSq = grav.radius * grav.radius;

        if (gdSq < gRadSq && gdSq > 1.0) {
          const dist = Math.sqrt(gdSq);
          const forceMag = (grav.strength * grav.life) / (dist * 0.1 + 1.0);
          totalAx += (gdx / dist) * forceMag;
          totalAy += (gdy / dist) * forceMag;
          totalAz += (gdz / dist) * forceMag;
        }
      }

      // 4. Subtle undulating marine current (sine wave drift)
      const currentAngle = this.time * 0.4 + zi * 0.05;
      totalAx += Math.sin(currentAngle) * 0.6;
      totalAy += Math.cos(this.time * 0.6 + xi * 0.05) * 0.4;
      totalAz += Math.cos(currentAngle) * 0.6;

      // Clamp steering acceleration
      const accMag = Math.sqrt(totalAx * totalAx + totalAy * totalAy + totalAz * totalAz);
      if (accMag > maxFrc) {
        const s = maxFrc / accMag;
        totalAx *= s;
        totalAy *= s;
        totalAz *= s;
      }

      ax[i] = totalAx;
      ay[i] = totalAy;
      az[i] = totalAz;
    }

    // 2. Integrate velocity & update positions
    const tLen = this.trailLength;
    const totalTrailVerts = n * tLen;

    for (let i = 0; i < n; i++) {
      let nvx = vx[i] + ax[i] * clampedDt;
      let nvy = vy[i] + ay[i] * clampedDt;
      let nvz = vz[i] + az[i] * clampedDt;

      // Speed clamp
      const spd = Math.sqrt(nvx * nvx + nvy * nvy + nvz * nvz);
      if (spd > maxSpd) {
        const s = maxSpd / spd;
        nvx *= s;
        nvy *= s;
        nvz *= s;
      } else if (spd < 1.0) {
        // Minimum swimming velocity
        const s = 1.0 / (spd + 1e-4);
        nvx *= s;
        nvy *= s;
        nvz *= s;
      }

      vx[i] = nvx;
      vy[i] = nvy;
      vz[i] = nvz;

      px[i] += nvx * clampedDt;
      py[i] += nvy * clampedDt;
      pz[i] += nvz * clampedDt;

      // Update tentacle trail ring-buffer
      let head = this.trailIndices[i];
      const baseOffset = i * tLen * 3;
      const off = baseOffset + head * 3;
      this.trailHistory[off] = px[i];
      this.trailHistory[off + 1] = py[i];
      this.trailHistory[off + 2] = pz[i];
      this.trailIndices[i] = (head + 1) % tLen;

      // Bioluminescent breathing oscillation
      const phase = this.breathingPhase[i] + this.time * this.breathingFrequency[i];
      const breath = 0.5 + 0.5 * Math.sin(phase);

      // Excitation decay + acceleration response
      const linearAcc = Math.sqrt(ax[i] * ax[i] + ay[i] * ay[i] + az[i] * az[i]);
      if (linearAcc > 4.0) {
        this.excitation[i] = Math.min(2.0, this.excitation[i] + linearAcc * 0.04);
      }
      this.excitation[i] *= 0.965; // exponential glow dissipation

      const totalIntensity = this.baseIntensity[i] * breath + this.excitation[i];

      // Update packed buffers for instanced or direct rendering
      const i3 = i * 3;
      this.packedPositions[i3] = px[i];
      this.packedPositions[i3 + 1] = py[i];
      this.packedPositions[i3 + 2] = pz[i];

      this.packedVelocities[i3] = nvx;
      this.packedVelocities[i3 + 1] = nvy;
      this.packedVelocities[i3 + 2] = nvz;

      this.packedIntensities[i] = totalIntensity;

      // Enhanced emission colors based on excitation
      const glowBoost = 1.0 + this.excitation[i] * 1.5;
      this.packedColors[i3] = Math.min(1.0, this.colorR[i] * glowBoost);
      this.packedColors[i3 + 1] = Math.min(1.0, this.colorG[i] * glowBoost);
      this.packedColors[i3 + 2] = Math.min(1.0, this.colorB[i] * glowBoost);
    }

    // 3. Update continuous ribbon vertex buffers
    this.updateRibbonGeometryBuffers();
  }

  /**
   * Reconstruct smooth sequential trail coordinates from ring buffers for ribbon rendering.
   */
  private updateRibbonGeometryBuffers(): void {
    const n = this.count;
    const tLen = this.trailLength;
    const hist = this.trailHistory;
    const heads = this.trailIndices;
    const rPos = this.ribbonPositions;
    const rCol = this.ribbonColors;

    let pOut = 0;
    let cOut = 0;

    for (let i = 0; i < n; i++) {
      const baseOffset = i * tLen * 3;
      const head = heads[i];
      const cr = this.colorR[i];
      const cg = this.colorG[i];
      const cb = this.colorB[i];
      const intensity = this.packedIntensities[i];

      for (let s = 0; s < tLen; s++) {
        // Read oldest to newest
        const ringIdx = (head + s) % tLen;
        const readOff = baseOffset + ringIdx * 3;

        rPos[pOut] = hist[readOff];
        rPos[pOut + 1] = hist[readOff + 1];
        rPos[pOut + 2] = hist[readOff + 2];
        pOut += 3;

        // Alpha / glow tapers toward tail tip
        const taper = (s + 1) / tLen;
        rCol[cOut] = cr;
        rCol[cOut + 1] = cg;
        rCol[cOut + 2] = cb;
        rCol[cOut + 3] = taper * intensity * 0.85;
        cOut += 4;
      }
    }
  }

  /**
   * Extract trailing path points for a specific entity in chronological order.
   */
  public getTrailPoints(entityIndex: number): Float32Array {
    const idx = Math.max(0, Math.min(this.count - 1, entityIndex));
    const tLen = this.trailLength;
    const baseOffset = idx * tLen * 3;
    const head = this.trailIndices[idx];
    const out = new Float32Array(tLen * 3);

    for (let s = 0; s < tLen; s++) {
      const ringIdx = (head + s) % tLen;
      const readOff = baseOffset + ringIdx * 3;
      const wOff = s * 3;
      out[wOff] = this.trailHistory[readOff];
      out[wOff + 1] = this.trailHistory[readOff + 1];
      out[wOff + 2] = this.trailHistory[readOff + 2];
    }
    return out;
  }

  /**
   * Access packed position buffer for Three.js InstancedBufferAttribute or Points.
   */
  public getPositions(): Float32Array {
    return this.packedPositions;
  }

  /**
   * Access packed velocity buffer.
   */
  public getVelocities(): Float32Array {
    return this.packedVelocities;
  }

  /**
   * Access packed bioluminescent intensity array.
   */
  public getIntensities(): Float32Array {
    return this.packedIntensities;
  }

  /**
   * Access packed RGB colors array.
   */
  public getColors(): Float32Array {
    return this.packedColors;
  }

  /**
   * Total number of active organisms.
   */
  public getActiveCount(): number {
    return this.count;
  }

  /**
   * Creates and initializes a Three.js LineSegments or Line ribbon geometry with attributes.
   */
  public createRibbonGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.ribbonPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.ribbonColors, 4));
    return geometry;
  }

  /**
   * Updates an existing Three.js BufferGeometry with latest ribbon positions and colors.
   */
  public updateRibbonGeometry(geometry: THREE.BufferGeometry): void {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.needsUpdate = true;
    }
    if (colAttr) {
      colAttr.needsUpdate = true;
    }
  }

  /**
   * Reset flock positions and velocities.
   */
  public reset(): void {
    this.activeGravitons.length = 0;
    this.initializeEntities();
  }
}
