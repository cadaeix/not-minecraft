import * as THREE from 'three';
import { GravitationalAttractor } from '../types';

export interface LiquidDroplet {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  a: number;
  size: number;
  life: number;
  maxLife: number;
  onSurface: boolean;
  surfaceTimer: number;
}

const LIQUID_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute float aSize;
attribute vec4 aColor;
attribute float aLife;

uniform float uPixelRatio;

varying vec4 vColor;
varying float vLife;

void main() {
  vColor = aColor;
  vLife = aLife;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Depth attenuation for physical liquid volume
  gl_PointSize = clamp(aSize * (220.0 / -mvPosition.z) * uPixelRatio, 2.0, 48.0);
}
`;

const LIQUID_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec4 vColor;
varying float vLife;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  // Spherical normal reconstruction for physical liquid bead
  float z = sqrt(max(0.0, 0.25 - dist * dist));
  vec3 normal = normalize(vec3(coord, z));

  // Light source for liquid droplet sheen
  vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
  float diff = max(dot(normal, lightDir), 0.0);
  
  // Sharp specular droplet highlight
  vec3 halfV = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(normal, halfV), 0.0), 32.0);

  // Fresnel rim glow
  float fresnel = pow(1.0 - normal.z, 2.2);

  // Liquid transmission & internal scatter
  vec3 liquidRgb = vColor.rgb * (0.6 + diff * 0.7) + vec3(1.0) * (spec * 0.9) + vColor.rgb * (fresnel * 0.6);
  float alpha = smoothstep(0.5, 0.35, dist) * vColor.a * min(1.0, vLife * 3.0);

  gl_FragColor = vec4(liquidRgb, alpha);
}
`;

export class LiquidSpraySimulator {
  public readonly maxDroplets: number;
  private count = 0;

  // Droplet State Arrays (SoA for high performance)
  public posX: Float32Array;
  public posY: Float32Array;
  public posZ: Float32Array;
  public velX: Float32Array;
  public velY: Float32Array;
  public velZ: Float32Array;
  public colorR: Float32Array;
  public colorG: Float32Array;
  public colorB: Float32Array;
  public colorA: Float32Array;
  public sizeArr: Float32Array;
  public lifeArr: Float32Array;
  public maxLifeArr: Float32Array;
  public onSurfaceArr: Uint8Array;
  public surfaceTimerArr: Float32Array;

  // Three.js Render Mesh
  public mesh: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private lifeAttr: THREE.BufferAttribute;

  // Simulation Parameters
  public gravity = new THREE.Vector3(0, -0.8, 0);
  public viscosity = 0.985;
  public surfaceFriction = 0.82;
  public restitution = 0.25;
  public adhesionForce = 1.8;
  public dropletRadius = 0.22;

  // SDF Shape settings matching active preset
  public morphShape = 2; // 0: Gyroid, 1: Schwarz P, 2: Metaballs, 3: Mandelbulb
  public blendFactor = 0.5;

  // Scratch vectors for zero GC
  private scratchNormal = new THREE.Vector3();
  private scratchForce = new THREE.Vector3();

  // Active liquid palette
  public currentLiquidColor = new THREE.Color(0x00f0ff); // Bioluminescent cyan default

  constructor(maxDroplets: number = 15000) {
    this.maxDroplets = maxDroplets;

    this.posX = new Float32Array(maxDroplets);
    this.posY = new Float32Array(maxDroplets);
    this.posZ = new Float32Array(maxDroplets);
    this.velX = new Float32Array(maxDroplets);
    this.velY = new Float32Array(maxDroplets);
    this.velZ = new Float32Array(maxDroplets);
    this.colorR = new Float32Array(maxDroplets);
    this.colorG = new Float32Array(maxDroplets);
    this.colorB = new Float32Array(maxDroplets);
    this.colorA = new Float32Array(maxDroplets);
    this.sizeArr = new Float32Array(maxDroplets);
    this.lifeArr = new Float32Array(maxDroplets);
    this.maxLifeArr = new Float32Array(maxDroplets);
    this.onSurfaceArr = new Uint8Array(maxDroplets);
    this.surfaceTimerArr = new Float32Array(maxDroplets);

    // Setup Render Geometry & Shader
    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(maxDroplets * 3), 3);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(maxDroplets * 4), 4);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(maxDroplets), 1);
    this.lifeAttr = new THREE.BufferAttribute(new Float32Array(maxDroplets), 1);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aColor', this.colAttr);
    this.geometry.setAttribute('aSize', this.sizeAttr);
    this.geometry.setAttribute('aLife', this.lifeAttr);
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: LIQUID_VERTEX_SHADER,
      fragmentShader: LIQUID_FRAGMENT_SHADER,
      uniforms: {
        uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /**
   * Evaluates the Signed Distance Field of the active non-Euclidean shape.
   */
  public evalSDF(x: number, y: number, z: number, time: number): number {
    const s = this.morphShape;
    const k = Math.max(0.15, this.blendFactor);

    // 0: Gyroid
    if (s === 0) {
      const scale = 2.2;
      const sx = x * scale;
      const sy = y * scale;
      const sz = z * scale;
      const g = (Math.abs(Math.sin(sx) * Math.cos(sy) + Math.sin(sy) * Math.cos(sz) + Math.sin(sz) * Math.cos(sx)) - 0.28) / scale;
      const bound = Math.sqrt(x * x + y * y + z * z) - 3.8;
      return Math.max(g * 0.7, bound);
    }

    // 1: Schwarz P
    if (s === 1) {
      const scale = 2.0;
      const sx = x * scale;
      const sy = y * scale;
      const sz = z * scale;
      const sp = (Math.abs(Math.cos(sx) + Math.cos(sy) + Math.cos(sz)) - 0.35) / scale;
      const bound = Math.sqrt(x * x + y * y + z * z) - 3.6;
      return Math.max(sp * 0.65, bound);
    }

    // 3: Mandelbulb
    if (s === 3) {
      const bound = Math.sqrt(x * x + y * y + z * z) - 2.8;
      return bound;
    }

    // 2: Default Metaballs (5 dynamic smooth orbiting spheres)
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

    let d = this.smin(d0, d1, k);
    d = this.smin(d, d2, k);
    d = this.smin(d, d3, k);
    return d;
  }

  private smin(a: number, b: number, k: number): number {
    const h = Math.max(0.0, Math.min(1.0, 0.5 + 0.5 * (b - a) / k));
    return (b * (1.0 - h) + a * h) - k * h * (1.0 - h);
  }

  /**
   * Finite difference gradient normal estimation of the SDF surface.
   */
  public evalNormal(x: number, y: number, z: number, time: number, out: THREE.Vector3): THREE.Vector3 {
    const eps = 0.01;
    const dx = this.evalSDF(x + eps, y, z, time) - this.evalSDF(x - eps, y, z, time);
    const dy = this.evalSDF(x, y + eps, z, time) - this.evalSDF(x, y - eps, z, time);
    const dz = this.evalSDF(x, y, z + eps, time) - this.evalSDF(x, y, z - eps, time);
    out.set(dx, dy, dz);
    const len = out.length();
    if (len > 1e-6) {
      out.multiplyScalar(1.0 / len);
    } else {
      out.set(0, 1, 0);
    }
    return out;
  }

  /**
   * Emits a continuous jet of liquid spray droplets from origin along direction.
   */
  public emitSpray(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    dropletRate: number = 32,
    speed: number = 24.0,
    spread: number = 0.08,
    color?: THREE.Color
  ): void {
    const col = color || this.currentLiquidColor;
    const numToEmit = Math.min(dropletRate, this.maxDroplets - this.count);

    const dirNorm = direction.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dirNorm, up).normalize();
    const orthoUp = new THREE.Vector3().crossVectors(right, dirNorm).normalize();

    for (let i = 0; i < numToEmit; i++) {
      const idx = this.count;
      if (idx >= this.maxDroplets) break;

      // Random cone angle
      const theta = Math.random() * Math.PI * 2.0;
      const rSpread = Math.sqrt(Math.random()) * spread;
      const rx = Math.cos(theta) * rSpread;
      const ry = Math.sin(theta) * rSpread;

      const sprayDir = dirNorm.clone()
        .addScaledVector(right, rx)
        .addScaledVector(orthoUp, ry)
        .normalize();

      const dropletSpeed = speed * (0.85 + Math.random() * 0.3);

      this.posX[idx] = origin.x + rx * 0.2;
      this.posY[idx] = origin.y + ry * 0.2;
      this.posZ[idx] = origin.z;

      this.velX[idx] = sprayDir.x * dropletSpeed;
      this.velY[idx] = sprayDir.y * dropletSpeed;
      this.velZ[idx] = sprayDir.z * dropletSpeed;

      // Color variation per droplet for luminous liquid iridescence
      const hueShift = (Math.random() - 0.5) * 0.08;
      this.colorR[idx] = Math.min(1.0, Math.max(0.0, col.r + hueShift));
      this.colorG[idx] = Math.min(1.0, Math.max(0.0, col.g + hueShift));
      this.colorB[idx] = Math.min(1.0, Math.max(0.0, col.b + hueShift));
      this.colorA[idx] = 0.85 + Math.random() * 0.15;

      this.sizeArr[idx] = 1.4 + Math.random() * 1.8;
      this.lifeArr[idx] = 1.0;
      this.maxLifeArr[idx] = 3.5 + Math.random() * 2.0;
      this.onSurfaceArr[idx] = 0;
      this.surfaceTimerArr[idx] = 0;

      this.count++;
    }
  }

  /**
   * Advance liquid physics: advection, SDF collision & surface clinging, gravity, attractors.
   */
  public update(
    dt: number,
    time: number,
    attractors: GravitationalAttractor[] = []
  ): void {
    const clampedDt = Math.min(0.05, Math.max(0.001, dt));
    const rDrop = this.dropletRadius;
    const numAttractors = attractors.length;

    let writeIdx = 0;

    for (let i = 0; i < this.count; i++) {
      // 1. Life decay
      this.lifeArr[i] -= clampedDt / this.maxLifeArr[i];
      if (this.lifeArr[i] <= 0) {
        continue; // Drop dead particle
      }

      let px = this.posX[i];
      let py = this.posY[i];
      let pz = this.posZ[i];
      let vx = this.velX[i];
      let vy = this.velY[i];
      let vz = this.velZ[i];
      let onSurf = this.onSurfaceArr[i] === 1;

      // 2. Gravitational Attractors pull on liquid
      for (let a = 0; a < numAttractors; a++) {
        const att = attractors[a];
        const dx = att.position.x - px;
        const dy = att.position.y - py;
        const dz = att.position.z - pz;
        const distSq = dx * dx + dy * dy + dz * dz + 0.5; // epsilon softening
        const dist = Math.sqrt(distSq);
        const forceMag = (att.mass * 45.0) / (distSq * dist);

        vx += dx * forceMag * clampedDt;
        vy += dy * forceMag * clampedDt;
        vz += dz * forceMag * clampedDt;
      }

      // 3. Gravity & Viscous Drag
      vy += this.gravity.y * clampedDt * (onSurf ? 0.35 : 1.0);
      vx *= Math.pow(this.viscosity, clampedDt * 60.0);
      vy *= Math.pow(this.viscosity, clampedDt * 60.0);
      vz *= Math.pow(this.viscosity, clampedDt * 60.0);

      // 4. Advect position
      px += vx * clampedDt;
      py += vy * clampedDt;
      pz += vz * clampedDt;

      // 5. 3D SDF Surface Collision & Flow
      const distToSurface = this.evalSDF(px, py, pz, time);

      if (distToSurface < rDrop) {
        // Compute surface normal
        this.evalNormal(px, py, pz, time, this.scratchNormal);
        const nx = this.scratchNormal.x;
        const ny = this.scratchNormal.y;
        const nz = this.scratchNormal.z;

        // Push droplet out to surface boundary
        const penetration = rDrop - distToSurface;
        px += nx * penetration;
        py += ny * penetration;
        pz += nz * penetration;

        // Decompose velocity into normal and tangential components
        const vDotN = vx * nx + vy * ny + vz * nz;

        if (vDotN < 0) {
          const vNormX = nx * vDotN;
          const vNormY = ny * vDotN;
          const vNormZ = nz * vDotN;

          const vTangX = vx - vNormX;
          const vTangY = vy - vNormY;
          const vTangZ = vz - vNormZ;

          // Liquid splatter response: damp normal bounce, slide along tangent with friction
          vx = vTangX * this.surfaceFriction - vNormX * this.restitution;
          vy = vTangY * this.surfaceFriction - vNormY * this.restitution;
          vz = vTangZ * this.surfaceFriction - vNormZ * this.restitution;

          // Surface adhesion: keep droplet hugging the surface contours
          vx -= nx * this.adhesionForce * clampedDt;
          vy -= ny * this.adhesionForce * clampedDt;
          vz -= nz * this.adhesionForce * clampedDt;

          onSurf = true;
          this.surfaceTimerArr[i] += clampedDt;
        }
      } else {
        onSurf = false;
      }

      // Preserve surviving particle in packed array
      this.posX[writeIdx] = px;
      this.posY[writeIdx] = py;
      this.posZ[writeIdx] = pz;
      this.velX[writeIdx] = vx;
      this.velY[writeIdx] = vy;
      this.velZ[writeIdx] = vz;
      this.colorR[writeIdx] = this.colorR[i];
      this.colorG[writeIdx] = this.colorG[i];
      this.colorB[writeIdx] = this.colorB[i];
      this.colorA[writeIdx] = this.colorA[i];
      this.sizeArr[writeIdx] = this.sizeArr[i];
      this.lifeArr[writeIdx] = this.lifeArr[i];
      this.maxLifeArr[writeIdx] = this.maxLifeArr[i];
      this.onSurfaceArr[writeIdx] = onSurf ? 1 : 0;
      this.surfaceTimerArr[writeIdx] = this.surfaceTimerArr[i];

      writeIdx++;
    }

    this.count = writeIdx;

    // 6. Update Render Buffers
    this.updateRenderBuffers();
  }

  private updateRenderBuffers(): void {
    const n = this.count;
    const posArr = this.posAttr.array as Float32Array;
    const colArr = this.colAttr.array as Float32Array;
    const szArr = this.sizeAttr.array as Float32Array;
    const lfArr = this.lifeAttr.array as Float32Array;

    let pOut = 0;
    let cOut = 0;

    for (let i = 0; i < n; i++) {
      posArr[pOut] = this.posX[i];
      posArr[pOut + 1] = this.posY[i];
      posArr[pOut + 2] = this.posZ[i];
      pOut += 3;

      colArr[cOut] = this.colorR[i];
      colArr[cOut + 1] = this.colorG[i];
      colArr[cOut + 2] = this.colorB[i];
      colArr[cOut + 3] = this.colorA[i];
      cOut += 4;

      szArr[i] = this.sizeArr[i];
      lfArr[i] = this.lifeArr[i];
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.lifeAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, n);
  }

  public getDropletCount(): number {
    return this.count;
  }
  public getPackedPositions(): Float32Array {
    return this.posAttr.array as Float32Array;
  }


  public clear(): void {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
