import * as THREE from 'three';
import { GravitationalAttractor } from '../types';

export class AttractorManager {
  private attractors: GravitationalAttractor[] = [];
  private group: THREE.Group;
  private visualMeshes: Map<string, { core: THREE.Mesh; ring: THREE.Mesh; light: THREE.PointLight }> = new Map();

  // Reusable geometries and materials for zero GC
  private coreGeometry: THREE.SphereGeometry;
  private ringGeometry: THREE.RingGeometry;

  constructor() {
    this.group = new THREE.Group();
    this.coreGeometry = new THREE.SphereGeometry(0.65, 24, 24);
    this.ringGeometry = new THREE.RingGeometry(0.85, 2.2, 36);
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public getAttractors(): GravitationalAttractor[] {
    return this.attractors;
  }

  public getCount(): number {
    return this.attractors.length;
  }

  /**
   * Spawns a persistent gravitational singularity at the specified 3D world position.
   */
  public addAttractor(
    position: THREE.Vector3,
    mass: number = 2.5,
    color?: THREE.Color
  ): GravitationalAttractor {
    const id = `singularity_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const col = color || new THREE.Color(0xa855f7); // Royal cosmic violet default

    const attractor: GravitationalAttractor = {
      id,
      position: position.clone(),
      mass,
      radius: 0.65,
      color: col.clone(),
      pulsePhase: Math.random() * Math.PI * 2,
    };

    this.attractors.push(attractor);

    // 1. Singularity Event Horizon Core Mesh
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x050510,
    });
    const coreMesh = new THREE.Mesh(this.coreGeometry, coreMat);
    coreMesh.position.copy(position);

    // 2. Accretion Disk Ring Mesh
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(this.ringGeometry, ringMat);
    ringMesh.position.copy(position);
    ringMesh.rotation.x = Math.PI * 0.35;
    ringMesh.rotation.y = Math.PI * 0.2;

    // 3. Point Light illumination for nearby elements
    const light = new THREE.PointLight(col.getHex(), 2.0, 16.0);
    light.position.copy(position);

    this.group.add(coreMesh);
    this.group.add(ringMesh);
    this.group.add(light);

    this.visualMeshes.set(id, { core: coreMesh, ring: ringMesh, light });

    return attractor;
  }

  /**
   * Removes a specific attractor by id.
   */
  public removeAttractor(id: string): void {
    const idx = this.attractors.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.attractors.splice(idx, 1);
    }

    const visual = this.visualMeshes.get(id);
    if (visual) {
      this.group.remove(visual.core);
      this.group.remove(visual.ring);
      this.group.remove(visual.light);
      this.visualMeshes.delete(id);
    }
  }

  /**
   * Clears all placed gravitational singularities.
   */
  public clear(): void {
    this.attractors = [];
    this.visualMeshes.forEach(v => {
      this.group.remove(v.core);
      this.group.remove(v.ring);
      this.group.remove(v.light);
    });
    this.visualMeshes.clear();
  }

  /**
   * Updates accretion disk rotation and breathing gravitational pulse.
   */
  public update(dt: number, time: number): void {
    const num = this.attractors.length;
    for (let i = 0; i < num; i++) {
      const att = this.attractors[i];
      att.pulsePhase += dt * 3.0;

      const visual = this.visualMeshes.get(att.id);
      if (visual) {
        // Spin accretion ring
        visual.ring.rotation.z += dt * 1.8;
        visual.ring.rotation.x = Math.PI * 0.35 + Math.sin(time * 2.0 + att.pulsePhase) * 0.15;

        // Pulsate event horizon breathing
        const pulse = 1.0 + Math.sin(att.pulsePhase) * 0.12;
        visual.core.scale.set(pulse, pulse, pulse);
        visual.ring.scale.set(pulse * 1.1, pulse * 1.1, pulse * 1.1);

        // Modulate point light intensity
        visual.light.intensity = 1.8 + Math.sin(att.pulsePhase) * 0.8;
      }
    }
  }

  /**
   * Evaluates combined gravitational acceleration vector at position pos.
   */
  public computeForce(pos: THREE.Vector3, out: THREE.Vector3, softening: number = 0.5): THREE.Vector3 {
    out.set(0, 0, 0);
    const num = this.attractors.length;

    for (let i = 0; i < num; i++) {
      const att = this.attractors[i];
      const dx = att.position.x - pos.x;
      const dy = att.position.y - pos.y;
      const dz = att.position.z - pos.z;
      const distSq = dx * dx + dy * dy + dz * dz + softening;
      const dist = Math.sqrt(distSq);
      const forceMag = (att.mass * 40.0) / (distSq * dist);

      out.x += dx * forceMag;
      out.y += dy * forceMag;
      out.z += dz * forceMag;
    }

    return out;
  }

  public dispose(): void {
    this.clear();
    this.coreGeometry.dispose();
    this.ringGeometry.dispose();
  }
}
