import * as THREE from 'three';
import { GameStateManager } from './GameStateManager';

export interface ResonanceNodeData {
  id: number;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  hydration: number; // 0.0 to 1.0
  isBloomed: boolean;
  bloomTime: number;
  pulsePhase: number;
  hitRadius: number;

  // Visual sub-objects
  group: THREE.Group;
  budMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  ring1Mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  ring2Mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  petals: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  pointLight: THREE.PointLight;
}

interface BloomFlareParticle {
  active: boolean;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

const UP_VECTOR = new THREE.Vector3(0, 1, 0);

export class ResonanceNodes {
  private gameState: GameStateManager;
  private group: THREE.Group;
  private nodes: ResonanceNodeData[] = [];
  private nodeCount: number;

  // Shared reusable geometries and materials for zero GC
  private budGeometry: THREE.IcosahedronGeometry;
  private petalGeometry: THREE.ConeGeometry;
  private ringGeometry1: THREE.TorusGeometry;
  private ringGeometry2: THREE.TorusGeometry;

  // Bloom flare particles
  private flarePoints: THREE.Points;
  private flareGeometry: THREE.BufferGeometry;
  private flarePositions: Float32Array;
  private flareColors: Float32Array;
  private flareSizes: Float32Array;
  private flareParticles: BloomFlareParticle[] = [];
  private readonly maxFlareParticles = 256;

  // Reusable scratch objects
  private scratchVec = new THREE.Vector3();
  private scratchQuat = new THREE.Quaternion();
  private scratchColor = new THREE.Color();

  constructor(gameState: GameStateManager, nodeCount: number = 8) {
    this.gameState = gameState;
    this.nodeCount = Math.max(6, Math.min(12, nodeCount));
    this.group = new THREE.Group();

    // 1. Initialize shared geometries
    this.budGeometry = new THREE.IcosahedronGeometry(0.32, 1);
    this.petalGeometry = new THREE.ConeGeometry(0.12, 0.55, 5);
    this.ringGeometry1 = new THREE.TorusGeometry(0.55, 0.025, 8, 24);
    this.ringGeometry2 = new THREE.TorusGeometry(0.82, 0.018, 8, 32);

    // 2. Initialize Bloom Particle Flare System
    this.flareGeometry = new THREE.BufferGeometry();
    this.flarePositions = new Float32Array(this.maxFlareParticles * 3);
    this.flareColors = new Float32Array(this.maxFlareParticles * 3);
    this.flareSizes = new Float32Array(this.maxFlareParticles);

    for (let i = 0; i < this.maxFlareParticles; i++) {
      this.flareParticles.push({
        active: false,
        px: 0,
        py: 0,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1.0,
        size: 0,
        r: 1,
        g: 1,
        b: 1,
      });
    }

    this.flareGeometry.setAttribute('position', new THREE.BufferAttribute(this.flarePositions, 3));
    this.flareGeometry.setAttribute('color', new THREE.BufferAttribute(this.flareColors, 3));
    this.flareGeometry.setAttribute('size', new THREE.BufferAttribute(this.flareSizes, 1));

    const flareMaterial = new THREE.PointsMaterial({
      size: 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flarePoints = new THREE.Points(this.flareGeometry, flareMaterial);
    this.group.add(this.flarePoints);

    // 3. Build Node instances
    this.createNodes();

    // 4. Initial distribution on shape surface
    this.respawnNodes(0, 0);
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public getNodes(): readonly ResonanceNodeData[] {
    return this.nodes;
  }

  public getBloomedCount(): number {
    let count = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].isBloomed) count++;
    }
    return count;
  }

  public getTotalCount(): number {
    return this.nodes.length;
  }

  private createNodes(): void {
    for (let i = 0; i < this.nodeCount; i++) {
      const nodeGroup = new THREE.Group();

      // Central crystalline bud mesh
      const budMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
      });
      const budMesh = new THREE.Mesh(this.budGeometry, budMat);
      nodeGroup.add(budMesh);

      // Inner energy ring
      const ring1Mat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.6,
      });
      const ring1Mesh = new THREE.Mesh(this.ringGeometry1, ring1Mat);
      ring1Mesh.rotation.x = Math.PI / 2;
      nodeGroup.add(ring1Mesh);

      // Outer energy ring
      const ring2Mat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.5,
      });
      const ring2Mesh = new THREE.Mesh(this.ringGeometry2, ring2Mat);
      ring2Mesh.rotation.x = Math.PI / 2;
      nodeGroup.add(ring2Mesh);

      // Radial Petals (6 petals)
      const petals: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
      const petalMat = new THREE.MeshBasicMaterial({
        color: 0x2dd4bf,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      });

      for (let p = 0; p < 6; p++) {
        const petalMesh = new THREE.Mesh(this.petalGeometry, petalMat);
        const angle = (p / 6) * Math.PI * 2;
        petalMesh.position.set(Math.cos(angle) * 0.42, 0.05, Math.sin(angle) * 0.42);
        petalMesh.rotation.z = Math.PI / 2;
        petalMesh.rotation.y = -angle;
        nodeGroup.add(petalMesh);
        petals.push(petalMesh);
      }

      // Point Light
      const pointLight = new THREE.PointLight(0x06b6d4, 0.4, 5.0, 1.8);
      pointLight.position.set(0, 0.2, 0);
      nodeGroup.add(pointLight);

      this.group.add(nodeGroup);

      this.nodes.push({
        id: i,
        position: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 1, 0),
        hydration: 0.0,
        isBloomed: false,
        bloomTime: 0,
        pulsePhase: (i / this.nodeCount) * Math.PI * 2,
        hitRadius: 0.85,
        group: nodeGroup,
        budMesh,
        ring1Mesh,
        ring2Mesh,
        petals,
        pointLight,
      });
    }
  }

  /**
   * Distributes dormant lotus nodes across the surface of the active non-Euclidean SDF shape.
   */
  public respawnNodes(shapeType: number, time: number): void {
    const count = this.nodes.length;

    for (let i = 0; i < count; i++) {
      const node = this.nodes[i];
      node.hydration = 0.0;
      node.isBloomed = false;
      node.bloomTime = 0;

      // Fibonacci sphere spiral distribution for uniform surface coverage
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);

      const rayDirX = Math.sin(phi) * Math.cos(theta);
      const rayDirY = Math.sin(phi) * Math.sin(theta);
      const rayDirZ = Math.cos(phi);

      // March along ray towards center to find the SDF surface
      let t = 4.2;
      for (let step = 0; step < 26; step++) {
        const px = rayDirX * t;
        const py = rayDirY * t;
        const pz = rayDirZ * t;
        const dist = this.evalSDF(px, py, pz, time, shapeType);
        if (Math.abs(dist) < 0.04 || t <= 0.6) break;
        t -= Math.max(0.04, Math.min(0.35, dist * 0.75));
      }

      const surfaceX = rayDirX * t;
      const surfaceY = rayDirY * t;
      const surfaceZ = rayDirZ * t;
      node.position.set(surfaceX, surfaceY, surfaceZ);

      // Calculate surface normal at hit point
      const eps = 0.02;
      const nx = this.evalSDF(surfaceX + eps, surfaceY, surfaceZ, time, shapeType) -
                 this.evalSDF(surfaceX - eps, surfaceY, surfaceZ, time, shapeType);
      const ny = this.evalSDF(surfaceX, surfaceY + eps, surfaceZ, time, shapeType) -
                 this.evalSDF(surfaceX, surfaceY - eps, surfaceZ, time, shapeType);
      const nz = this.evalSDF(surfaceX, surfaceY, surfaceZ + eps, time, shapeType) -
                 this.evalSDF(surfaceX, surfaceY, surfaceZ - eps, time, shapeType);

      node.normal.set(nx, ny, nz).normalize();
      if (node.normal.lengthSq() < 0.001) {
        node.normal.set(rayDirX, rayDirY, rayDirZ).normalize();
      }

      // Position and orient the node group along surface normal
      node.group.position.copy(node.position);
      this.scratchQuat.setFromUnitVectors(UP_VECTOR, node.normal);
      node.group.quaternion.copy(this.scratchQuat);
    }

    this.gameState.setNodeCounts(0, count);
  }

  private evalSDF(x: number, y: number, z: number, time: number, shapeType: number): number {
    // 0: Gyroid
    if (shapeType === 0) {
      const scale = 2.2;
      const sx = x * scale;
      const sy = y * scale;
      const sz = z * scale;
      const g = (Math.abs(Math.sin(sx) * Math.cos(sy) + Math.sin(sy) * Math.cos(sz) + Math.sin(sz) * Math.cos(sx)) - 0.28) / scale;
      const bound = Math.sqrt(x * x + y * y + z * z) - 3.8;
      return Math.max(g * 0.7, bound);
    }

    // 1: Schwarz P
    if (shapeType === 1) {
      const scale = 2.0;
      const sx = x * scale;
      const sy = y * scale;
      const sz = z * scale;
      const sp = (Math.abs(Math.cos(sx) + Math.cos(sy) + Math.cos(sz)) - 0.35) / scale;
      const bound = Math.sqrt(x * x + y * y + z * z) - 3.6;
      return Math.max(sp * 0.65, bound);
    }

    // 3: Mandelbulb / Fractal approximation
    if (shapeType === 3) {
      return Math.sqrt(x * x + y * y + z * z) - 2.8;
    }

    // 2: Default Smooth Orbiting Metaballs
    const c0x = Math.sin(time * 0.7) * 1.2;
    const c0y = Math.cos(time * 0.9) * 0.8;
    const c0z = Math.sin(time * 0.5) * 1.1;

    const c1x = Math.cos(time * 0.8 + 2.0) * 1.4;
    const c1y = Math.sin(time * 0.6 + 1.0) * 1.2;
    const c1z = Math.cos(time * 0.7) * 0.9;

    const c2x = Math.sin(time * 0.5 + 4.0) * 1.0;
    const c2y = Math.cos(time * 0.7 + 3.0) * 1.3;
    const c2z = Math.sin(time * 1.1) * 1.0;

    const c3x = Math.cos(time * 1.1) * 0.9;
    const c3y = Math.sin(time * 0.4) * 1.0;
    const c3z = Math.cos(time * 0.9 + 2.5) * 1.4;

    const r0 = 0.9 + 0.15 * Math.sin(time * 2.0);
    const r1 = 0.8 + 0.12 * Math.cos(time * 1.7);
    const r2 = 0.75 + 0.10 * Math.sin(time * 2.3);
    const r3 = 0.85 + 0.14 * Math.cos(time * 1.5);

    const d0 = Math.hypot(x - c0x, y - c0y, z - c0z) - r0;
    const d1 = Math.hypot(x - c1x, y - c1y, z - c1z) - r1;
    const d2 = Math.hypot(x - c2x, y - c2y, z - c2z) - r2;
    const d3 = Math.hypot(x - c3x, y - c3y, z - c3z) - r3;

    const k = 0.35;
    const h0 = Math.max(0.0, Math.min(1.0, 0.5 + 0.5 * (d1 - d0) / k));
    const sm0 = (d1 * (1.0 - h0) + d0 * h0) - k * h0 * (1.0 - h0);

    const h1 = Math.max(0.0, Math.min(1.0, 0.5 + 0.5 * (d2 - sm0) / k));
    const sm1 = (d2 * (1.0 - h1) + sm0 * h1) - k * h1 * (1.0 - h1);

    const h2 = Math.max(0.0, Math.min(1.0, 0.5 + 0.5 * (d3 - sm1) / k));
    return (d3 * (1.0 - h2) + sm1 * h2) - k * h2 * (1.0 - h2);
  }

  /**
   * Collision detection: absorbs sprayed liquid droplets hitting near dormant lotus nodes.
   * dropletPositions: array of [x, y, z, x, y, z...] or Vector3-like structures.
   */
  public checkLiquidCollisions(
    dropletPositions: ArrayLike<number>,
    dropletCount: number,
    dropletRadius: number = 0.15
  ): number {
    let absorbedCount = 0;
    const nNodes = this.nodes.length;
    const len = Math.min(dropletCount * 3, dropletPositions.length);

    for (let j = 0; j < nNodes; j++) {
      const node = this.nodes[j];
      if (node.isBloomed) continue; // Already bloomed, no further hydration needed

      const nx = node.position.x;
      const ny = node.position.y;
      const nz = node.position.z;
      const thresholdSq = (node.hitRadius + dropletRadius) * (node.hitRadius + dropletRadius);

      for (let i = 0; i < len; i += 3) {
        const dx = dropletPositions[i] - nx;
        const dy = dropletPositions[i + 1] - ny;
        const dz = dropletPositions[i + 2] - nz;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < thresholdSq) {
          // Droplet absorbed by node
          absorbedCount++;
          node.hydration += 0.012; // ~80 droplets to fully bloom

          if (node.hydration >= 1.0) {
            node.hydration = 1.0;
            node.isBloomed = true;
            node.bloomTime = 0;
            this.emitBloomFlare(node.position);
            this.gameState.reportNodeHydrated();
            this.gameState.setNodeCounts(this.getBloomedCount(), nNodes);
            break;
          }
        }
      }
    }

    return absorbedCount;
  }

  private emitBloomFlare(pos: THREE.Vector3): void {
    let spawned = 0;
    const toSpawn = 32;

    for (let i = 0; i < this.maxFlareParticles; i++) {
      const p = this.flareParticles[i];
      if (!p.active) {
        p.active = true;
        p.px = pos.x;
        p.py = pos.y;
        p.pz = pos.z;

        // Spherical velocity burst
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 1.2 + Math.random() * 2.8;

        p.vx = Math.sin(phi) * Math.cos(theta) * speed;
        p.vy = Math.sin(phi) * Math.sin(theta) * speed;
        p.vz = Math.cos(phi) * speed;

        p.life = 0;
        p.maxLife = 0.8 + Math.random() * 0.7;
        p.size = 0.28 + Math.random() * 0.2;

        // Golden luminous lotus colors
        p.r = 0.95 + Math.random() * 0.05;
        p.g = 0.8 + Math.random() * 0.2;
        p.b = 0.2 + Math.random() * 0.3;

        spawned++;
        if (spawned >= toSpawn) break;
      }
    }
  }

  public update(dt: number, time: number): void {
    const clampedDt = Math.min(0.1, Math.max(0.0001, dt));

    // 1. Animate Resonance Nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const hyd = node.hydration;
      const phase = node.pulsePhase;

      if (node.isBloomed) {
        node.bloomTime += clampedDt;
      }

      // Rotate energy rings around normal axis
      node.ring1Mesh.rotation.z += (0.8 + hyd * 1.5) * clampedDt;
      node.ring2Mesh.rotation.z -= (0.5 + hyd * 1.2) * clampedDt;

      // Pulsing crystal bud breathing
      const breath = 1.0 + Math.sin(time * 3.5 + phase) * (0.05 + hyd * 0.15);
      node.budMesh.scale.set(breath, breath, breath);
      node.budMesh.rotation.y += (0.4 + hyd * 1.2) * clampedDt;

      // Unfold petals based on hydration & bloom
      const petalSpread = 0.38 + hyd * 0.45 + (node.isBloomed ? 0.2 : 0.0);
      const petalRot = (node.isBloomed ? Math.sin(time * 2.0 + phase) * 0.15 : 0.0);

      for (let p = 0; p < node.petals.length; p++) {
        const petal = node.petals[p];
        const angle = (p / 6) * Math.PI * 2;
        petal.position.x = Math.cos(angle) * petalSpread;
        petal.position.z = Math.sin(angle) * petalSpread;
        petal.scale.set(1.0 + hyd * 0.6, 1.0 + hyd * 0.8, 1.0 + hyd * 0.6);
        petal.rotation.z = Math.PI / 2 + hyd * 0.35 + petalRot;
      }

      // Color progression: Dormant Slate/Indigo -> Aqua/Cyan -> Radiant Emerald/Gold Bloom
      if (node.isBloomed) {
        this.scratchColor.set(0xfbbf24); // Golden Lotus
        node.budMesh.material.color.lerp(this.scratchColor, 0.1);
        node.ring1Mesh.material.color.set(0xec4899); // Radiant Magenta
        node.ring2Mesh.material.color.set(0xf59e0b); // Amber
        node.pointLight.color.set(0xfbbf24);
        node.pointLight.intensity = 2.8 + Math.sin(time * 5.0 + phase) * 0.6;
      } else {
        // Lerp color from cyan to bright turquoise/emerald
        const r = 0.1 + hyd * 0.2;
        const g = 0.6 + hyd * 0.38;
        const b = 0.85 - hyd * 0.4;
        node.budMesh.material.color.setRGB(r, g, b);
        node.ring1Mesh.material.color.setRGB(r * 0.8, g * 0.9, b);
        node.pointLight.color.setRGB(r, g, b);
        node.pointLight.intensity = 0.3 + hyd * 1.8 + Math.sin(time * 2.5 + phase) * 0.15;
      }
    }

    // 2. Animate Bloom Flare Particles (Zero GC update)
    let activeFlares = 0;
    const posArr = this.flarePositions;
    const colArr = this.flareColors;
    const szArr = this.flareSizes;

    for (let i = 0; i < this.maxFlareParticles; i++) {
      const p = this.flareParticles[i];
      if (!p.active) continue;

      p.life += clampedDt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }

      const progress = p.life / p.maxLife;
      p.px += p.vx * clampedDt;
      p.py += p.vy * clampedDt;
      p.pz += p.vz * clampedDt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vz *= 0.94;

      const alpha = 1.0 - progress;
      const idx3 = activeFlares * 3;
      posArr[idx3] = p.px;
      posArr[idx3 + 1] = p.py;
      posArr[idx3 + 2] = p.pz;

      colArr[idx3] = p.r * alpha;
      colArr[idx3 + 1] = p.g * alpha;
      colArr[idx3 + 2] = p.b * alpha;

      szArr[activeFlares] = p.size * (1.0 + progress * 1.5) * alpha;

      activeFlares++;
    }

    this.flareGeometry.setDrawRange(0, activeFlares);
    if (activeFlares > 0) {
      (this.flareGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.flareGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (this.flareGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public dispose(): void {
    this.budGeometry.dispose();
    this.petalGeometry.dispose();
    this.ringGeometry1.dispose();
    this.ringGeometry2.dispose();
    this.flareGeometry.dispose();

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      node.budMesh.material.dispose();
      node.ring1Mesh.material.dispose();
      node.ring2Mesh.material.dispose();
      for (let p = 0; p < node.petals.length; p++) {
        node.petals[p].material.dispose();
      }
    }
  }
}
