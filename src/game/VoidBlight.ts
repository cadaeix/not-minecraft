import * as THREE from 'three';
import { GravitationalAttractor } from '../types';
import { GameStateManager } from './GameStateManager';

export interface BlightRiftData {
  id: number;
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetPosition: THREE.Vector3;
  baseRadius: number;
  health: number; // 0.0 to 100.0
  maxHealth: number;
  hitRadius: number;
  seed: number;
  respawnTimer: number;

  // Visual sub-objects
  group: THREE.Group;
  coreMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  spikeMesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  outerSpikeMesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
  pointLight: THREE.PointLight;
  hitFlashTimer: number;
}

interface StarlightParticle {
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

export class VoidBlight {
  private gameState: GameStateManager;
  private group: THREE.Group;
  private rifts: BlightRiftData[] = [];
  private readonly maxRifts: number = 3;

  // Shared geometries
  private coreGeometry: THREE.SphereGeometry;
  private spikeGeometry: THREE.IcosahedronGeometry;
  private outerSpikeGeometry: THREE.IcosahedronGeometry;

  // Starlight explosion particle system (Zero GC)
  private starlightPoints: THREE.Points;
  private starlightGeometry: THREE.BufferGeometry;
  private starlightPositions: Float32Array;
  private starlightColors: Float32Array;
  private starlightSizes: Float32Array;
  private starlightParticles: StarlightParticle[] = [];
  private readonly maxStarlightParticles = 384;

  // Scratch vectors for Zero GC computation
  private scratchVec = new THREE.Vector3();
  private scratchAttractorDiff = new THREE.Vector3();

  constructor(gameState: GameStateManager, riftCount: number = 2) {
    this.gameState = gameState;
    this.group = new THREE.Group();

    // 1. Shared Geometries
    this.coreGeometry = new THREE.SphereGeometry(0.72, 20, 20);
    this.spikeGeometry = new THREE.IcosahedronGeometry(0.95, 1);
    this.outerSpikeGeometry = new THREE.IcosahedronGeometry(1.35, 1);

    // 2. Initialize Starlight Explosion Particles
    this.starlightGeometry = new THREE.BufferGeometry();
    this.starlightPositions = new Float32Array(this.maxStarlightParticles * 3);
    this.starlightColors = new Float32Array(this.maxStarlightParticles * 3);
    this.starlightSizes = new Float32Array(this.maxStarlightParticles);

    for (let i = 0; i < this.maxStarlightParticles; i++) {
      this.starlightParticles.push({
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

    this.starlightGeometry.setAttribute('position', new THREE.BufferAttribute(this.starlightPositions, 3));
    this.starlightGeometry.setAttribute('color', new THREE.BufferAttribute(this.starlightColors, 3));
    this.starlightGeometry.setAttribute('size', new THREE.BufferAttribute(this.starlightSizes, 1));

    const starlightMaterial = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.starlightPoints = new THREE.Points(this.starlightGeometry, starlightMaterial);
    this.group.add(this.starlightPoints);

    // 3. Create Blight Rift instances
    const count = Math.max(1, Math.min(this.maxRifts, riftCount));
    for (let i = 0; i < this.maxRifts; i++) {
      const riftGroup = new THREE.Group();

      // Dark inverted core
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x050005,
        side: THREE.BackSide,
      });
      const coreMesh = new THREE.Mesh(this.coreGeometry, coreMat);
      riftGroup.add(coreMesh);

      // Inner erratic wireframe spikes
      const spikeMat = new THREE.MeshBasicMaterial({
        color: 0xff1e40,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      });
      const spikeMesh = new THREE.Mesh(this.spikeGeometry, spikeMat);
      riftGroup.add(spikeMesh);

      // Outer crackling crimson spike cage
      const outerSpikeMat = new THREE.MeshBasicMaterial({
        color: 0x990022,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
      });
      const outerSpikeMesh = new THREE.Mesh(this.outerSpikeGeometry, outerSpikeMat);
      riftGroup.add(outerSpikeMesh);

      // Dissonant red point light
      const pointLight = new THREE.PointLight(0xff1133, 2.8, 7.0, 1.6);
      riftGroup.add(pointLight);

      this.group.add(riftGroup);

      const isActive = i < count;
      const rift: BlightRiftData = {
        id: i,
        active: isActive,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        baseRadius: 0.8,
        health: 100.0,
        maxHealth: 100.0,
        hitRadius: 1.35,
        seed: Math.random() * 100,
        respawnTimer: 0,
        group: riftGroup,
        coreMesh,
        spikeMesh,
        outerSpikeMesh,
        pointLight,
        hitFlashTimer: 0,
      };

      if (isActive) {
        this.spawnRiftAtRandomPosition(rift);
      } else {
        rift.group.visible = false;
        rift.respawnTimer = 8.0 + i * 6.0;
      }

      this.rifts.push(rift);
    }

    this.gameState.setActiveBlights(this.getActiveCount());
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public getRifts(): readonly BlightRiftData[] {
    return this.rifts;
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.rifts.length; i++) {
      if (this.rifts[i].active) count++;
    }
    return count;
  }

  private spawnRiftAtRandomPosition(rift: BlightRiftData): void {
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI * 0.7;
    const dist = 2.6 + Math.random() * 1.6;

    rift.position.set(
      Math.cos(angle) * Math.cos(elevation) * dist,
      Math.sin(elevation) * dist,
      Math.sin(angle) * Math.cos(elevation) * dist
    );

    rift.velocity.set(0, 0, 0);
    rift.targetPosition.copy(rift.position);
    rift.health = 100.0;
    rift.active = true;
    rift.group.visible = true;
    rift.group.position.copy(rift.position);
    rift.respawnTimer = 0;
  }

  /**
   * Damaged by sprayed liquid droplets.
   */
  public hitWithLiquid(x: number, y: number, z: number, damage: number = 1.6): boolean {
    let hitAny = false;
    for (let i = 0; i < this.rifts.length; i++) {
      const rift = this.rifts[i];
      if (!rift.active) continue;

      const dx = x - rift.position.x;
      const dy = y - rift.position.y;
      const dz = z - rift.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < rift.hitRadius * rift.hitRadius) {
        rift.health = Math.max(0, rift.health - damage);
        rift.hitFlashTimer = 0.12;
        hitAny = true;

        if (rift.health <= 0) {
          this.purifyRift(rift);
        }
        break;
      }
    }
    return hitAny;
  }
  public checkLiquidCollisions(
    dropletPositions: ArrayLike<number>,
    dropletCount: number,
    _dropletRadius: number = 0.15
  ): number {
    let hitCount = 0;
    const len = Math.min(dropletCount * 3, dropletPositions.length);
    for (let i = 0; i < len; i += 3) {
      if (this.hitWithLiquid(dropletPositions[i], dropletPositions[i + 1], dropletPositions[i + 2], 1.2)) {
        hitCount++;
      }
    }
    return hitCount;
  }


  /**
   * Damaged by cosmic harmonic shockwave pulse.
   */
  public hitWithShockwave(center: THREE.Vector3, radius: number, damage: number = 45.0): number {
    let countHit = 0;
    const radSq = radius * radius;

    for (let i = 0; i < this.rifts.length; i++) {
      const rift = this.rifts[i];
      if (!rift.active) continue;

      const distSq = rift.position.distanceToSquared(center);
      if (distSq <= radSq) {
        rift.health = Math.max(0, rift.health - damage);
        rift.hitFlashTimer = 0.25;
        countHit++;

        // Push away from shockwave center
        this.scratchVec.subVectors(rift.position, center).normalize().multiplyScalar(3.0);
        rift.velocity.add(this.scratchVec);

        if (rift.health <= 0) {
          this.purifyRift(rift);
        }
      }
    }
    return countHit;
  }

  private purifyRift(rift: BlightRiftData): void {
    rift.active = false;
    rift.group.visible = false;
    rift.respawnTimer = 10.0 + Math.random() * 8.0;

    // Explode into purified starlight particles
    this.explodeStarlight(rift.position);

    // Report purification to game state
    this.gameState.reportBlightPurified();
    this.gameState.setActiveBlights(this.getActiveCount());
  }

  private explodeStarlight(pos: THREE.Vector3): void {
    let spawned = 0;
    const toSpawn = 64;

    for (let i = 0; i < this.maxStarlightParticles; i++) {
      const p = this.starlightParticles[i];
      if (!p.active) {
        p.active = true;
        p.px = pos.x;
        p.py = pos.y;
        p.pz = pos.z;

        // Omnidirectional high-speed burst
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 2.0 + Math.random() * 4.5;

        p.vx = Math.sin(phi) * Math.cos(theta) * speed;
        p.vy = Math.sin(phi) * Math.sin(theta) * speed;
        p.vz = Math.cos(phi) * speed;

        p.life = 0;
        p.maxLife = 1.0 + Math.random() * 1.0;
        p.size = 0.35 + Math.random() * 0.25;

        // Radiant starlight iridescent palette: cyan, violet, pearl gold
        const choice = Math.random();
        if (choice < 0.33) {
          p.r = 0.2;
          p.g = 0.9;
          p.b = 1.0;
        } else if (choice < 0.66) {
          p.r = 0.9;
          p.g = 0.3;
          p.b = 1.0;
        } else {
          p.r = 1.0;
          p.g = 0.95;
          p.b = 0.7;
        }

        spawned++;
        if (spawned >= toSpawn) break;
      }
    }
  }

  public update(dt: number, time: number, attractors: GravitationalAttractor[] = []): void {
    const clampedDt = Math.min(0.1, Math.max(0.0001, dt));

    // 1. Process Blight Rifts
    for (let i = 0; i < this.rifts.length; i++) {
      const rift = this.rifts[i];

      if (!rift.active) {
        // Respawn countdown
        rift.respawnTimer -= clampedDt;
        if (rift.respawnTimer <= 0) {
          this.spawnRiftAtRandomPosition(rift);
          this.gameState.setActiveBlights(this.getActiveCount());
          this.gameState.addNotification('WARNING: Void Blight Rift Emerged!', 'purify', undefined, undefined, 3.5);
        }
        continue;
      }

      // 2. Slow erratic drifting motion
      const seed = rift.seed;
      rift.targetPosition.x = Math.sin(time * 0.4 + seed) * 2.8 + Math.cos(time * 0.25 + seed * 1.3) * 0.6;
      rift.targetPosition.y = Math.cos(time * 0.35 + seed * 2.0) * 1.8;
      rift.targetPosition.z = Math.sin(time * 0.45 + seed * 1.7) * 2.8;

      // Smooth acceleration toward target
      this.scratchVec.subVectors(rift.targetPosition, rift.position).multiplyScalar(0.8);
      rift.velocity.addScaledVector(this.scratchVec, clampedDt);
      rift.velocity.multiplyScalar(0.96); // Air drag
      rift.position.addScaledVector(rift.velocity, clampedDt);
      rift.group.position.copy(rift.position);

      // 3. Stabilization by nearby Gravitational Attractors
      for (let a = 0; a < attractors.length; a++) {
        const att = attractors[a];
        this.scratchAttractorDiff.subVectors(att.position, rift.position);
        const dist = this.scratchAttractorDiff.length();
        const influenceRadius = att.radius + 2.2;

        if (dist < influenceRadius && dist > 0.01) {
          // Attractor pulls rift in and stabilizes (damages) it!
          const force = (1.0 - dist / influenceRadius) * 2.0;
          this.scratchAttractorDiff.normalize().multiplyScalar(force);
          rift.velocity.addScaledVector(this.scratchAttractorDiff, clampedDt);

          // Continuous purification damage by gravity singularity
          rift.health = Math.max(0, rift.health - 28.0 * clampedDt);
          rift.hitFlashTimer = 0.08;

          if (rift.health <= 0) {
            this.purifyRift(rift);
            break;
          }
        }
      }

      if (!rift.active) continue;

      // 4. Erratic crackling spikes and dissonant light flicker
      const crackle = 1.0 + Math.sin(time * 16.0 + seed) * 0.12 + (Math.sin(time * 33.0 + seed * 3) * 0.06);
      rift.spikeMesh.scale.set(crackle, crackle, crackle);
      rift.spikeMesh.rotation.x += (1.4 + Math.sin(time * 5.0) * 0.5) * clampedDt;
      rift.spikeMesh.rotation.y += (1.9 + Math.cos(time * 4.0) * 0.5) * clampedDt;

      const outerCrackle = 1.0 + Math.cos(time * 20.0 + seed * 2) * 0.15;
      rift.outerSpikeMesh.scale.set(outerCrackle, outerCrackle, outerCrackle);
      rift.outerSpikeMesh.rotation.z -= (1.2 + Math.sin(time * 6.0) * 0.4) * clampedDt;

      // Hit flash visual feedback
      if (rift.hitFlashTimer > 0) {
        rift.hitFlashTimer -= clampedDt;
        rift.spikeMesh.material.color.set(0xffffff);
        rift.outerSpikeMesh.material.color.set(0x38bdf8); // Cyan stabilization flash
        rift.pointLight.intensity = 5.0;
      } else {
        // Red/Crimson dissonant pulse
        const healthFrac = rift.health / rift.maxHealth;
        const pulse = Math.sin(time * 12.0 + seed);
        rift.spikeMesh.material.color.setRGB(1.0, 0.1 * healthFrac, 0.25 * healthFrac);
        rift.outerSpikeMesh.material.color.setRGB(0.6 + pulse * 0.2, 0.0, 0.15);
        rift.pointLight.intensity = 2.0 + pulse * 0.9;
        rift.pointLight.color.setRGB(1.0, 0.05, 0.2);
      }
    }

    // 5. Animate Starlight Explosion Particles (Zero GC update)
    let activeParticles = 0;
    const posArr = this.starlightPositions;
    const colArr = this.starlightColors;
    const szArr = this.starlightSizes;

    for (let i = 0; i < this.maxStarlightParticles; i++) {
      const p = this.starlightParticles[i];
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
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.vz *= 0.93;

      const alpha = 1.0 - progress;
      const idx3 = activeParticles * 3;
      posArr[idx3] = p.px;
      posArr[idx3 + 1] = p.py;
      posArr[idx3 + 2] = p.pz;

      colArr[idx3] = p.r * alpha;
      colArr[idx3 + 1] = p.g * alpha;
      colArr[idx3 + 2] = p.b * alpha;

      szArr[activeParticles] = p.size * (1.0 + progress * 2.0) * alpha;

      activeParticles++;
    }

    this.starlightGeometry.setDrawRange(0, activeParticles);
    if (activeParticles > 0) {
      (this.starlightGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.starlightGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (this.starlightGeometry.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  public dispose(): void {
    this.coreGeometry.dispose();
    this.spikeGeometry.dispose();
    this.outerSpikeGeometry.dispose();
    this.starlightGeometry.dispose();

    for (let i = 0; i < this.rifts.length; i++) {
      const rift = this.rifts[i];
      rift.coreMesh.material.dispose();
      rift.spikeMesh.material.dispose();
      rift.outerSpikeMesh.material.dispose();
    }
  }
}
