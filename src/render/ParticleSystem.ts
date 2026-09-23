import * as THREE from 'three';

export interface ParticleSystemOptions {
  count?: number;
  maxCount?: number;
  baseSize?: number;
  hue?: number;
}

const PARTICLE_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec3 aOrigin;
attribute vec4 aRandom; // x: id, y: seed, z: speed, w: phase
attribute vec2 aLife;   // x: current life, y: max life

uniform float uTime;
uniform float uDt;
uniform vec3 uAttractorPos;
uniform float uAttractorStrength;
uniform sampler2D uFluidVelocity;
uniform bool uHasFluidTexture;
uniform float uBaseSize;
uniform float uPixelRatio;

varying vec3 vVelocity;
varying float vSpeed;
varying float vLifeRatio;
varying float vRandomSeed;

// Simplex 3D noise functions (Ashima Arts / Stefan Gustavson)
vec4 permute(vec4 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// 3D Curl noise field computed via central differences of 3 noise octaves
vec3 curlNoise(vec3 p) {
  const float e = 0.08;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  // Field psi vector potential
  float p_x1 = snoise(p + dy + vec3(17.1, 4.3, 2.1));
  float p_x0 = snoise(p - dy + vec3(17.1, 4.3, 2.1));
  float p_y1 = snoise(p + dz + vec3(5.2, 13.7, 9.4));
  float p_y0 = snoise(p - dz + vec3(5.2, 13.7, 9.4));
  float p_z1 = snoise(p + dx + vec3(8.9, 1.5, 14.8));
  float p_z0 = snoise(p - dx + vec3(8.9, 1.5, 14.8));

  float x = (p_x1 - p_x0) / (2.0 * e);
  float y = (p_y1 - p_y0) / (2.0 * e);
  float z = (p_z1 - p_z0) / (2.0 * e);

  return vec3(y - z, z - x, x - y);
}

void main() {
  vRandomSeed = aRandom.y;

  // Compute normalized life cycle with randomized phase offsets
  float maxLife = max(aLife.y, 1.0);
  float cycleTime = uTime * (0.35 + aRandom.z * 0.4) + aRandom.w * maxLife;
  float age = mod(cycleTime, maxLife);
  float lifeRatio = age / maxLife;
  vLifeRatio = lifeRatio;

  // Base dynamic displacement over particle lifespan
  vec3 pos = aOrigin;

  // Add 3D simplex curl noise field
  float curlScale = 0.45;
  vec3 curl = curlNoise(pos * curlScale + vec3(uTime * 0.12 * aRandom.z));
  pos += curl * (age * 1.6);

  // Vortex rotation & gravitational attractor dynamics
  vec3 toAttractor = uAttractorPos - pos;
  float distToAttractor = length(toAttractor);
  float attractorRadius = 4.5;

  if (distToAttractor < attractorRadius) {
    float falloff = 1.0 - smoothstep(0.0, attractorRadius, distToAttractor);
    vec3 vortexAxis = vec3(0.0, 1.0, 0.0);
    vec3 tangentForce = cross(vortexAxis, normalize(toAttractor + vec3(0.0001)));
    
    // Orbiting vortex spin + radial attraction
    vec3 attractorForce = tangentForce * (uAttractorStrength * 2.8) + normalize(toAttractor) * (uAttractorStrength * 1.5);
    pos += attractorForce * (falloff * age * 0.8);
  }

  // Fluid velocity texture sampling
  if (uHasFluidTexture) {
    vec2 fluidUv = clamp(pos.xy * 0.12 + 0.5, 0.0, 1.0);
    vec4 fluidSample = texture2D(uFluidVelocity, fluidUv);
    vec2 fluidVel = (fluidSample.xy - 0.5) * 4.0;
    pos.xy += fluidVel * 0.75;
  }

  // Calculate velocity vector for trail & spectral shift
  vec3 vel = curl * 1.8;
  if (distToAttractor < attractorRadius) {
    vel += cross(vec3(0.0, 1.0, 0.0), normalize(toAttractor + vec3(0.0001))) * (uAttractorStrength * 2.0);
  }
  vVelocity = vel;
  vSpeed = length(vel);

  // View-space transformation
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Soft life fade in & fade out curve: smooth bell curve
  float lifeFade = sin(lifeRatio * 3.14159);
  float size = uBaseSize * (0.8 + 0.6 * sin(uTime * 3.0 + aRandom.w * 6.28)) * lifeFade;
  
  // Attenuation by depth - delicate pinpoint bioluminescent spores
  gl_PointSize = clamp(size * (24.0 / -mvPosition.z) * uPixelRatio, 1.0, 14.0);
}
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uHue;
uniform float uPhosphorescence;

varying vec3 vVelocity;
varying float vSpeed;
varying float vLifeRatio;
varying float vRandomSeed;

// Converts HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float distSq = dot(coord, coord);

  // Circle discard bound
  if (distSq > 0.25) {
    discard;
  }

  // Anti-aliased soft bioluminescent orb profile
  float dist = sqrt(distSq) * 2.0; // 0.0 at center, 1.0 at edge
  float core = smoothstep(1.0, 0.0, dist);
  float glow = exp(-dist * 2.8);
  float intensity = (core * 0.6 + glow * 0.75);

  // Velocity-dependent spectral shifting:
  // Low speed: Cyan (0.0, 0.9, 1.0)
  // Mid speed: Magenta (0.9, 0.1, 0.8)
  // High speed: Golden Amber (1.0, 0.75, 0.1)
  float speedNorm = clamp(vSpeed * 0.45, 0.0, 2.0);
  vec3 colLow = vec3(0.0, 0.95, 1.0);     // Cyan bioluminescence
  vec3 colMid = vec3(0.95, 0.1, 0.85);    // Magenta hyper-charged
  vec3 colHigh = vec3(1.0, 0.8, 0.12);    // Golden amber plasma

  vec3 spectralColor;
  if (speedNorm < 1.0) {
    spectralColor = mix(colLow, colMid, smoothstep(0.0, 1.0, speedNorm));
  } else {
    spectralColor = mix(colMid, colHigh, smoothstep(1.0, 2.0, speedNorm));
  }

  // Apply user hue shift
  vec3 baseHsv = vec3(uHue + vRandomSeed * 0.12, 0.85, 1.0);
  vec3 hueColor = hsv2rgb(baseHsv);
  vec3 particleColor = mix(spectralColor, hueColor, 0.35);

  // Chromatic aberration radial simulation inside the particle point
  float chromOff = 0.07 * dist;
  float rInt = exp(-length(coord + vec2(chromOff, 0.0)) * 5.6);
  float gInt = exp(-length(coord) * 5.6);
  float bInt = exp(-length(coord - vec2(chromOff, 0.0)) * 5.6);
  vec3 chromaticFactor = vec3(rInt, gInt, bInt);

  // Phosphorescent trail persistence & life fade
  float lifeFade = sin(vLifeRatio * 3.14159);
  vec3 finalRgb = (particleColor + chromaticFactor * 0.3) * intensity * (0.35 + uPhosphorescence * 0.45);
  float alpha = clamp(intensity * lifeFade * 0.6, 0.0, 1.0);

  gl_FragColor = vec4(finalRgb * alpha, alpha);
}
`;

export class ParticleSystem extends THREE.Points {
  private particleCount: number;
  private maxCapacity: number;
  declare material: THREE.ShaderMaterial;
  declare geometry: THREE.BufferGeometry;

  constructor(options: ParticleSystemOptions = {}) {
    const maxCapacity = options.maxCount ?? 150000;
    const initialCount = options.count ?? 100000;
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(maxCapacity * 3);
    const origins = new Float32Array(maxCapacity * 3);
    const randoms = new Float32Array(maxCapacity * 4);
    const lifes = new Float32Array(maxCapacity * 2);

    // Seed particle cloud with continuous non-Euclidean organic volume distribution
    for (let i = 0; i < maxCapacity; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const i2 = i * 2;

      // Distribute in spherical organic shell
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.pow(Math.random(), 0.65) * 16.0 + 0.8;

      const sinPhi = Math.sin(phi);
      const x = r * sinPhi * Math.cos(theta);
      const y = r * sinPhi * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      origins[i3] = x;
      origins[i3 + 1] = y;
      origins[i3 + 2] = z;

      randoms[i4] = i;
      randoms[i4 + 1] = Math.random();
      randoms[i4 + 2] = 0.5 + Math.random() * 1.2;
      randoms[i4 + 3] = Math.random();

      lifes[i2] = 0.0;
      lifes[i2 + 1] = 3.0 + Math.random() * 4.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOrigin', new THREE.BufferAttribute(origins, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 4));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(lifes, 2));

    const material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uDt: { value: 0.016 },
        uAttractorPos: { value: new THREE.Vector3(0, 0, 0) },
        uAttractorStrength: { value: 0.0 },
        uFluidVelocity: { value: null },
        uHasFluidTexture: { value: false },
        uBaseSize: { value: options.baseSize ?? 8.0 },
        uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
        uHue: { value: options.hue ?? 0.55 },
        uPhosphorescence: { value: 0.8 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    super(geometry, material);
    this.maxCapacity = maxCapacity;
    this.particleCount = Math.min(initialCount, maxCapacity);
    this.geometry.setDrawRange(0, this.particleCount);
    this.frustumCulled = false;
  }

  update(
    dt: number,
    time: number,
    attractorPos: THREE.Vector3,
    attractorStrength: number,
    fluidVelocityTexture?: THREE.Texture | null
  ): void {
    const uniforms = this.material.uniforms;
    uniforms.uTime.value = time;
    uniforms.uDt.value = dt;
    uniforms.uAttractorPos.value.copy(attractorPos);
    uniforms.uAttractorStrength.value = attractorStrength;

    if (fluidVelocityTexture) {
      uniforms.uFluidVelocity.value = fluidVelocityTexture;
      uniforms.uHasFluidTexture.value = true;
    } else {
      uniforms.uHasFluidTexture.value = false;
    }
  }

  setCount(count: number): void {
    this.particleCount = Math.max(0, Math.min(count, this.maxCapacity));
    this.geometry.setDrawRange(0, this.particleCount);
  }

  getCount(): number {
    return this.particleCount;
  }

  setHue(hue: number): void {
    this.material.uniforms.uHue.value = hue;
  }

  setPhosphorescence(val: number): void {
    this.material.uniforms.uPhosphorescence.value = val;
  }

  setBaseSize(size: number): void {
    this.material.uniforms.uBaseSize.value = size;
  }
}
