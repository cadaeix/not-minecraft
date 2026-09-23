import * as THREE from 'three';

export interface PhysarumOptions {
  width?: number;
  height?: number;
  agentCount?: number;
  sensorAngle?: number;       // In radians, e.g. 22.5 to 45 deg (0.39 - 0.78 rad)
  sensorDist?: number;        // Sensor distance in pixels (e.g. 9.0)
  rotationAngle?: number;     // Turn angle in radians (e.g. 0.35 - 0.7 rad)
  stepSize?: number;          // Distance moved per step (e.g. 1.2 - 2.0)
  depositAmount?: number;     // Trail deposit intensity per agent per step
  decayFactor?: number;       // Evaporation rate per frame (0.01 - 0.05)
  diffuseRate?: number;       // Blur/diffusion mixing rate (0.1 - 0.5)
}

/**
 * Physarum Polycephalum (True Slime Mold) transport network simulation.
 * Implements Jeff Jones' agent-based chemoattractant model with 20,000 - 100,000+ agents.
 * Agents sample the environment using 3 forward sensors (left, center, right), steer towards
 * chemoattractant gradients, deposit trails, and generate emergent venation networks.
 * Uses dual-buffered Float32Array grids and preallocated agent arrays for 0-GC 60fps operation.
 */
export class PhysarumNetwork {
  public readonly width: number;
  public readonly height: number;
  public readonly size: number;
  public readonly agentCount: number;

  // Agent State Arrays (AoS -> SoA for SIMD cache friendliness)
  public agentX: Float32Array;
  public agentY: Float32Array;
  public agentAngle: Float32Array;

  // Packed positions buffer for Three.js Points / InstancedMesh rendering [x, y, intensity]
  public agentPositions: Float32Array;

  // Dual-buffered Trail Grid (Chemoattractant map)
  public trailMap: Float32Array;
  public trailMapPrev: Float32Array;

  // Simulation Parameters
  public sensorAngle: number;
  public sensorDist: number;
  public rotationAngle: number;
  public stepSize: number;
  public depositAmount: number;
  public decayFactor: number;
  public diffuseRate: number;

  // Total active biomass (cached every step)
  private totalBiomass: number = 0;

  // Three.js DataTexture for GPU rendering
  private trailTexture: THREE.DataTexture;
  private trailTextureData: Float32Array;

  constructor(options: PhysarumOptions = {}) {
    this.width = options.width ?? 256;
    this.height = options.height ?? 256;
    this.size = this.width * this.height;
    this.agentCount = options.agentCount ?? 32768; // 32k agents default (> 20,000)

    this.sensorAngle = options.sensorAngle ?? 0.45;       // ~25.8 degrees
    this.sensorDist = options.sensorDist ?? 9.0;
    this.rotationAngle = options.rotationAngle ?? 0.40;   // ~22.9 degrees
    this.stepSize = options.stepSize ?? 1.4;
    this.depositAmount = options.depositAmount ?? 1.2;
    this.decayFactor = options.decayFactor ?? 0.035;
    this.diffuseRate = options.diffuseRate ?? 0.25;

    // Allocate agent arrays
    this.agentX = new Float32Array(this.agentCount);
    this.agentY = new Float32Array(this.agentCount);
    this.agentAngle = new Float32Array(this.agentCount);
    this.agentPositions = new Float32Array(this.agentCount * 3);

    // Allocate trail maps
    this.trailMap = new Float32Array(this.size);
    this.trailMapPrev = new Float32Array(this.size);

    // Three.js DataTexture: RGBA Float32
    // R: trail intensity, G: trail gradient magnitude, B: agent density, A: 1.0
    this.trailTextureData = new Float32Array(this.size * 4);
    this.trailTexture = new THREE.DataTexture(
      this.trailTextureData as unknown as BufferSource,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.trailTexture.minFilter = THREE.LinearFilter;
    this.trailTexture.magFilter = THREE.LinearFilter;
    this.trailTexture.wrapS = THREE.RepeatWrapping;
    this.trailTexture.wrapT = THREE.RepeatWrapping;
    this.trailTexture.generateMipmaps = false;

    this.spawnAgentsInDisk();
  }

  /**
   * Initialize agents in an organic radial disc with random orientations pointing outward.
   */
  public spawnAgentsInDisk(cx?: number, cy?: number, radius?: number): void {
    const centerX = cx ?? this.width * 0.5;
    const centerY = cy ?? this.height * 0.5;
    const rMax = radius ?? Math.min(this.width, this.height) * 0.35;

    const count = this.agentCount;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2.0;
      const r = Math.sqrt(Math.random()) * rMax;
      this.agentX[i] = centerX + Math.cos(angle) * r;
      this.agentY[i] = centerY + Math.sin(angle) * r;
      // Heading outward plus slight random perturbation
      this.agentAngle[i] = angle + (Math.random() - 0.5) * 0.5;
    }
  }

  /**
   * Sample trail intensity at continuous grid or normalized coordinates with bilinear filtering and wrapping.
   */
  public sampleTrail(x: number, y: number): number {
    const w = this.width;
    const h = this.height;

    // If normalized [0, 1]
    const gx = x <= 1.0 && x >= 0 ? x * w : x;
    const gy = y <= 1.0 && y >= 0 ? y * h : y;

    // Wrap coordinates toroidally
    const wrappedX = ((gx % w) + w) % w;
    const wrappedY = ((gy % h) + h) % h;

    const x0 = Math.floor(wrappedX);
    const y0 = Math.floor(wrappedY);
    const x1 = (x0 + 1) % w;
    const y1 = (y0 + 1) % h;

    const fx = wrappedX - x0;
    const fy = wrappedY - y0;

    const m = this.trailMap;
    const row0 = y0 * w;
    const row1 = y1 * w;

    const tl = m[x0 + row0];
    const tr = m[x1 + row0];
    const bl = m[x0 + row1];
    const br = m[x1 + row1];

    const top = tl + (tr - tl) * fx;
    const bottom = bl + (br - bl) * fx;

    return top + (bottom - top) * fy;
  }

  /**
   * Inject nutrient food source / chemoattractant cluster at given coordinates.
   */
  public injectFood(x: number, y: number, radius = 12.0, amount = 15.0): void {
    const w = this.width;
    const h = this.height;
    const gx = x <= 1.0 && x >= 0 ? x * w : x;
    const gy = y <= 1.0 && y >= 0 ? y * h : y;

    const r = Math.max(1, radius);
    const rSq = r * r;

    const minX = Math.floor(gx - r);
    const maxX = Math.ceil(gx + r);
    const minY = Math.floor(gy - r);
    const maxY = Math.ceil(gy + r);

    const map = this.trailMap;

    for (let j = minY; j <= maxY; j++) {
      const yWrapped = ((j % h) + h) % h;
      const dy = j - gy;
      const dySq = dy * dy;
      const row = yWrapped * w;

      for (let i = minX; i <= maxX; i++) {
        const xWrapped = ((i % w) + w) % w;
        const dx = i - gx;
        const distSq = dx * dx + dySq;

        if (distSq <= rSq) {
          const falloff = 1.0 - Math.sqrt(distSq) / r;
          const idx = xWrapped + row;
          map[idx] = Math.min(100.0, map[idx] + amount * falloff * falloff);
        }
      }
    }
  }

  /**
   * Inject new slime spores at given coordinates, displacing a subset of agents.
   */
  public injectSpores(x: number, y: number, count = 2000, radius = 8.0): void {
    const w = this.width;
    const h = this.height;
    const gx = x <= 1.0 && x >= 0 ? x * w : x;
    const gy = y <= 1.0 && y >= 0 ? y * h : y;

    const num = Math.min(count, this.agentCount);
    // Displace random agents to the new spore origin
    for (let k = 0; k < num; k++) {
      const idx = Math.floor(Math.random() * this.agentCount);
      const angle = Math.random() * Math.PI * 2.0;
      const r = Math.random() * radius;
      this.agentX[idx] = ((gx + Math.cos(angle) * r) % w + w) % w;
      this.agentY[idx] = ((gy + Math.sin(angle) * r) % h + h) % h;
      this.agentAngle[idx] = angle;
    }

    // Also inject some initial chemoattractant food
    this.injectFood(gx, gy, radius * 1.5, 8.0);
  }
  public depositFood(x: number, y: number, radius = 12.0, amount = 15.0): void {
    this.injectFood(x, y, radius, amount);
  }

  public spawnSporeBurst(x: number, y: number, count = 2000, radius = 8.0): void {
    this.injectSpores(x, y, count, radius);
  }

  /**
   * Step the Physarum simulation forward:
   * 1. Motor & sensory step: sample 3 sensors, orient, step forward
   * 2. Trail deposit: deposit chemoattractant
   * 3. Grid diffuse & decay: 3x3 diffusion and exponential evaporation
   */
  public step(dt = 1.0): void {
    this.motorAndSensoryStep();
    this.depositStep();
    this.diffuseAndDecayStep(dt);
  }

  /**
   * Sensory orientation + forward motor displacement (Jones 2010 algorithm).
   */
  private motorAndSensoryStep(): void {
    const count = this.agentCount;
    const w = this.width;
    const h = this.height;
    const map = this.trailMap;

    const sAngle = this.sensorAngle;
    const sDist = this.sensorDist;
    const rAngle = this.rotationAngle;
    const step = this.stepSize;

    const xs = this.agentX;
    const ys = this.agentY;
    const angles = this.agentAngle;
    const posOut = this.agentPositions;

    for (let i = 0; i < count; i++) {
      const x = xs[i];
      const y = ys[i];
      const a = angles[i];

      // 1. Calculate positions of 3 forward sensors
      // Center
      const cX = x + Math.cos(a) * sDist;
      const cY = y + Math.sin(a) * sDist;

      // Left
      const lAngle = a - sAngle;
      const lX = x + Math.cos(lAngle) * sDist;
      const lY = y + Math.sin(lAngle) * sDist;

      // Right
      const rAngleVal = a + sAngle;
      const rX = x + Math.cos(rAngleVal) * sDist;
      const rY = y + Math.sin(rAngleVal) * sDist;

      // 2. Sample chemoattractant trail at sensor positions (fast integer sample with wrapping)
      const cVal = this.fastSample(cX, cY, map, w, h);
      const lVal = this.fastSample(lX, lY, map, w, h);
      const rVal = this.fastSample(rX, rY, map, w, h);

      // 3. Sensory steering logic
      let newAngle = a;
      if (cVal > lVal && cVal > rVal) {
        // Forward has highest concentration: maintain heading with slight exploration jitter
        newAngle += (Math.random() - 0.5) * 0.05;
      } else if (cVal < lVal && cVal < rVal) {
        // Center is local minimum: choose left or right randomly
        newAngle += (Math.random() < 0.5 ? 1 : -1) * rAngle;
      } else if (lVal > rVal) {
        // Left has higher concentration: steer left
        newAngle -= rAngle;
      } else if (rVal > lVal) {
        // Right has higher concentration: steer right
        newAngle += rAngle;
      } else {
        // Equal values: small random jitter
        newAngle += (Math.random() - 0.5) * 0.1;
      }

      // 4. Motor step: move forward along new heading
      let nextX = x + Math.cos(newAngle) * step;
      let nextY = y + Math.sin(newAngle) * step;

      // Toroidal boundary wrapping
      if (nextX < 0) nextX += w;
      else if (nextX >= w) nextX -= w;
      if (nextY < 0) nextY += h;
      else if (nextY >= h) nextY -= h;

      xs[i] = nextX;
      ys[i] = nextY;
      angles[i] = newAngle;

      // Update packed buffer for Three.js rendering [x, y, trailValue]
      const pIdx = i * 3;
      posOut[pIdx] = nextX;
      posOut[pIdx + 1] = nextY;
      posOut[pIdx + 2] = cVal;
    }
  }

  /**
   * Fast integer sample with toroidal coordinate wrapping.
   */
  private fastSample(x: number, y: number, map: Float32Array, w: number, h: number): number {
    const ix = (Math.floor(x) % w + w) % w;
    const iy = (Math.floor(y) % h + h) % h;
    return map[ix + iy * w];
  }

  /**
   * Deposit chemoattractant slime onto the trail map at current agent locations.
   */
  private depositStep(): void {
    const count = this.agentCount;
    const w = this.width;
    const h = this.height;
    const map = this.trailMap;
    const xs = this.agentX;
    const ys = this.agentY;
    const dep = this.depositAmount;

    for (let i = 0; i < count; i++) {
      const ix = Math.floor(xs[i]);
      const iy = Math.floor(ys[i]);
      const idx = ix + iy * w;
      if (idx >= 0 && idx < this.size) {
        map[idx] += dep;
      }
    }
  }

  /**
   * 3x3 box blur diffusion and exponential decay of the trail map.
   */
  private diffuseAndDecayStep(dt: number): void {
    const w = this.width;
    const h = this.height;
    const src = this.trailMap;
    const dst = this.trailMapPrev;

    const diff = this.diffuseRate;
    const stay = 1.0 - diff;
    const decay = Math.max(0.0, 1.0 - this.decayFactor * dt);

    let biomassAcc = 0;

    for (let y = 0; y < h; y++) {
      const yPrev = (y - 1 + h) % h;
      const yNext = (y + 1) % h;
      const row = y * w;
      const rowPrev = yPrev * w;
      const rowNext = yNext * w;

      for (let x = 0; x < w; x++) {
        const xPrev = (x - 1 + w) % w;
        const xNext = (x + 1) % w;

        // 8-neighbor sum
        const sum =
          src[xPrev + rowPrev] + src[x + rowPrev] + src[xNext + rowPrev] +
          src[xPrev + row]     +                   src[xNext + row]     +
          src[xPrev + rowNext] + src[x + rowNext] + src[xNext + rowNext];

        const avg = sum * 0.125;
        const center = src[x + row];

        // Diffuse + decay
        const diffusedVal = (center * stay + avg * diff) * decay;
        dst[x + row] = diffusedVal;
        biomassAcc += diffusedVal;
      }
    }

    // Swap buffers: trailMap becomes diffused dst
    this.trailMap.set(dst);
    this.totalBiomass = biomassAcc;
  }

  /**
   * Total integrated biomass across the network.
   */
  public getBiomass(): number {
    return this.totalBiomass;
  }

  /**
   * Updates and returns Three.js DataTexture of the Physarum trail network.
   * RGBA: [Trail, Gradient Mag, Normalized Biomass, 1.0]
   */
  public getTexture(): THREE.DataTexture {
    const texData = this.trailTextureData;
    const map = this.trailMap;
    const w = this.width;
    const h = this.height;
    const len = this.size;

    let p = 0;
    for (let y = 0; y < h; y++) {
      const yPrev = (y - 1 + h) % h;
      const yNext = (y + 1) % h;
      const row = y * w;
      const rowPrev = yPrev * w;
      const rowNext = yNext * w;

      for (let x = 0; x < w; x++) {
        const xPrev = (x - 1 + w) % w;
        const xNext = (x + 1) % w;

        const val = map[x + row];
        const dx = (map[xNext + row] - map[xPrev + row]) * 0.5;
        const dy = (map[x + rowNext] - map[x + rowPrev]) * 0.5;
        const gradMag = Math.sqrt(dx * dx + dy * dy);

        // Normalize trail for display
        const displayVal = Math.min(1.0, val * 0.2);

        texData[p] = displayVal;
        texData[p + 1] = Math.min(1.0, gradMag * 0.3);
        texData[p + 2] = Math.min(1.0, val * 0.05);
        texData[p + 3] = 1.0;
        p += 4;
      }
    }

    this.trailTexture.needsUpdate = true;
    return this.trailTexture;
  }

  /**
   * Reset the trail map and reseed agents.
   */
  public reset(): void {
    this.trailMap.fill(0);
    this.trailMapPrev.fill(0);
    this.trailTextureData.fill(0);
    this.trailTexture.needsUpdate = true;
    this.spawnAgentsInDisk();
  }

  /**
   * Dispose allocated textures.
   */
  public dispose(): void {
    this.trailTexture.dispose();
  }
}
