import * as THREE from 'three';

export interface RaymarchUniforms {
  uTime: { value: number };
  uResolution: { value: THREE.Vector2 };
  uCameraPos: { value: THREE.Vector3 };
  uCameraDir: { value: THREE.Vector3 };
  uCameraUp: { value: THREE.Vector3 };
  uFov: { value: number };
  uMorphShape: { value: number }; // 0: Gyroid, 1: Schwarz P, 2: Metaballs, 3: Mandelbulb
  uBlendFactor: { value: number };
  uFractalIterations: { value: number };
  uSubsurfaceGlow: { value: number };
  uColorA: { value: THREE.Color };
  uColorB: { value: THREE.Color };
  uColorInterior: { value: THREE.Color };
  uMouse3D: { value: THREE.Vector3 };
  uPulse: { value: number };
  uSurfaceTension: { value: number };
}

export const RAYMARCH_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const RAYMARCH_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCameraPos;
uniform vec3 uCameraDir;
uniform vec3 uCameraUp;
uniform float uFov;
uniform float uMorphShape;
uniform float uBlendFactor;
uniform float uFractalIterations;
uniform float uSubsurfaceGlow;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorInterior;
uniform vec3 uMouse3D;
uniform float uPulse;
uniform float uSurfaceTension;

varying vec2 vUv;

#define MAX_STEPS 160
#define SURF_DIST 0.0015
#define MAX_DIST 50.0

// Polynomial smooth minimum (k controls blend radius)
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Rotation matrix around an arbitrary axis
mat3 rotateAxis(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

// SDF 0: Gyroid minimal surface
float sdGyroid(vec3 p, float scale, float thickness, float bias) {
  vec3 sp = p * scale;
  float g = abs(dot(sin(sp), cos(sp.zxy))) - thickness;
  // Bounded inside a spherical boundary to avoid infinite step artifacts
  float bound = length(p) - 3.8;
  return max(g / scale * 0.7 + bias, bound);
}

// SDF 1: Schwarz P minimal surface
float sdSchwarzP(vec3 p, float scale, float thickness) {
  vec3 sp = p * scale;
  float spVal = cos(sp.x) + cos(sp.y) + cos(sp.z);
  float d = (abs(spVal) - thickness) / scale;
  float bound = length(p) - 3.6;
  return max(d * 0.65, bound);
}

// SDF 2: Morphing Smooth Metaballs
float sdMetaballs(vec3 p, float time) {
  float d = 1e5;
  float k = mix(0.4, 1.2, clamp(uBlendFactor, 0.0, 1.0));
  
  // 5 dynamic orbiting organic metaball centers
  vec3 c0 = vec3(sin(time * 0.7) * 1.2, cos(time * 0.9) * 0.8, sin(time * 0.5) * 1.1);
  vec3 c1 = vec3(cos(time * 0.8 + 2.0) * 1.4, sin(time * 0.6 + 1.0) * 1.2, cos(time * 0.7) * 0.9);
  vec3 c2 = vec3(sin(time * 0.5 + 4.0) * 1.0, cos(time * 0.7 + 3.0) * 1.3, sin(time * 1.1) * 1.0);
  vec3 c3 = vec3(cos(time * 1.1) * 0.9, sin(time * 0.4) * 1.0, cos(time * 0.9 + 2.5) * 1.4);
  vec3 c4 = uMouse3D * 0.8;

  float r0 = 0.9 + 0.15 * sin(time * 2.0 + uPulse * 3.1415);
  float r1 = 0.8 + 0.12 * cos(time * 1.7);
  float r2 = 0.75 + 0.10 * sin(time * 2.3);
  float r3 = 0.85 + 0.14 * cos(time * 1.5);
  float r4 = 0.65;

  float d0 = length(p - c0) - r0;
  float d1 = length(p - c1) - r1;
  float d2 = length(p - c2) - r2;
  float d3 = length(p - c3) - r3;
  float d4 = length(p - c4) - r4;

  d = smin(d0, d1, k);
  d = smin(d, d2, k);
  d = smin(d, d3, k);
  d = smin(d, d4, k);

  // Surface tension creates skin resistance ripple
  float ripple = sin(length(p) * 6.0 - time * 3.0) * (0.04 * uSurfaceTension);
  return d + ripple;
}

// SDF 3: 3D Mandelbulb Fractal with Julia dynamic folding
float sdMandelbulb(vec3 p, float iterations) {
  vec3 w = p;
  float m = dot(w, w);
  float dz = 1.0;
  float r = 0.0;
  float power = 8.0 + sin(uTime * 0.2) * 0.5;

  // Bound check
  if (m > 8.0) {
    return 0.5 * (sqrt(m) - 1.2);
  }

  int maxIt = int(clamp(iterations, 3.0, 10.0));
  for (int i = 0; i < 10; i++) {
    if (i >= maxIt) break;
    
    // Polar coordinates
    r = length(w);
    if (r > 3.0) break;
    
    // Running derivative
    dz = power * pow(r, power - 1.0) * dz + 1.0;
    
    float theta = acos(clamp(w.z / r, -1.0, 1.0));
    float phi = atan(w.y, w.x);
    
    theta = theta * power + uTime * 0.1;
    phi = phi * power + uTime * 0.08;
    
    // Spherical to Cartesian
    float zr = pow(r, power);
    w = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
    
    // Add dynamic fold / seed
    w += p + (uMouse3D * 0.1);
  }
  
  return 0.5 * log(r) * r / dz;
}

// Map scene: evaluates combined non-Euclidean organic SDF
float mapScene(vec3 p) {
  // Global domain deformation and pulse wave
  float pulseMod = sin(uTime * 1.5 + length(p) * 1.2) * (uPulse * 0.12);
  vec3 pDeformed = p + vec3(pulseMod * 0.3, pulseMod * 0.2, pulseMod * 0.3);

  // Interactive mouse displacement ripple
  vec3 mouseDist = p - uMouse3D;
  float mouseInfluence = exp(-dot(mouseDist, mouseDist) * 1.5) * 0.35;
  pDeformed -= normalize(mouseDist + vec3(0.001)) * mouseInfluence;

  // Base SDFs
  float dGyroid = sdGyroid(pDeformed, 2.2, 0.28, 0.0);
  float dSchwarz = sdSchwarzP(pDeformed, 2.0, 0.35);
  float dMeta = sdMetaballs(pDeformed, uTime);
  float dFractal = sdMandelbulb(pDeformed * 0.85, uFractalIterations) / 0.85;

  // Smooth blending across shapes based on uMorphShape (0 -> 1 -> 2 -> 3)
  float s = clamp(uMorphShape, 0.0, 3.0);
  float k = mix(0.15, 0.8, clamp(uBlendFactor, 0.0, 1.0));

  float d = dGyroid;
  if (s < 1.0) {
    d = mix(dGyroid, dSchwarz, smoothstep(0.0, 1.0, s));
  } else if (s < 2.0) {
    d = mix(dSchwarz, dMeta, smoothstep(1.0, 2.0, s));
  } else {
    d = mix(dMeta, dFractal, smoothstep(2.0, 3.0, s));
  }

  return d;
}

// Normal estimation via tetrahedron technique (4 SDF taps instead of 6)
vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * mapScene(p + k.xyy * h) +
    k.yyx * mapScene(p + k.yyx * h) +
    k.yxy * mapScene(p + k.yxy * h) +
    k.xxx * mapScene(p + k.xxx * h)
  );
}

// Volumetric Ambient Occlusion estimation (stepwise sphere tracing)
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.02 + 0.12 * float(i) / 4.0;
    float d = mapScene(p + h * n);
    occ += (h - d) * sca;
    sca *= 0.85;
  }
  return clamp(1.0 - 1.8 * occ, 0.0, 1.0);
}

// Subsurface Scattering (SSS) estimation along inverted normal
float calcSSS(vec3 p, vec3 rd, vec3 n) {
  float sss = 0.0;
  float stepSize = 0.08;
  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    vec3 samplePos = p - n * (fi * stepSize);
    float d = mapScene(samplePos);
    sss += max(0.0, -d) / (fi * fi);
  }
  return clamp(sss * uSubsurfaceGlow * 3.5, 0.0, 1.0);
}

// Chromatic absorption: Beer-Lambert exponential falloff per channel
vec3 chromaticAbsorption(float dist, vec3 tint) {
  vec3 extinction = vec3(0.7, 0.4, 0.9) * (1.0 - tint);
  return exp(-extinction * dist);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);

  // Setup pinhole ray camera from uniforms
  vec3 ro = uCameraPos;
  vec3 forward = normalize(uCameraDir);
  vec3 right = normalize(cross(forward, uCameraUp));
  vec3 up = cross(right, forward);

  float tanFov = tan(radians(uFov) * 0.5);
  vec3 rd = normalize(uv.x * right * tanFov + uv.y * up * tanFov + forward);

  // Volumetric accumulation variables
  float t = 0.0;
  float hitDist = -1.0;
  vec3 hitPos = vec3(0.0);
  vec3 hitNorm = vec3(0.0);
  float minDistance = 1e5;
  float glowAcc = 0.0;
  vec3 plasmaEmission = vec3(0.0);

  // Sphere-tracing raymarch loop
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = mapScene(p);
    
    // Accumulate glowing interior plasma core emission
    float coreDist = length(p);
    float coreDensity = exp(-coreDist * 1.5) * (0.0012 + 0.004 * uPulse);
    glowAcc += coreDensity / (1.0 + d * d * 120.0);
    plasmaEmission += uColorInterior * coreDensity * 0.4;

    minDistance = min(minDistance, d);

    if (d < SURF_DIST) {
      hitDist = t;
      hitPos = p;
      hitNorm = calcNormal(p);
      break;
    }

    if (t > MAX_DIST) break;
    t += max(d * 0.75, 0.003);
  }

  // Deep space background gradient
  vec3 bgGradient = mix(
    vec3(0.008, 0.012, 0.025),
    vec3(0.025, 0.015, 0.045),
    uv.y * 0.5 + 0.5
  );

  vec3 finalColor = bgGradient + plasmaEmission * 0.6;

  // If ray hit the organic surface
  if (hitDist > 0.0) {
    // Light directions
    vec3 lightDir1 = normalize(vec3(2.5, 4.0, 3.0));
    vec3 lightDir2 = normalize(vec3(-3.0, -2.0, -2.5));
    vec3 viewDir = -rd;

    // Diffuse lighting (Lambertian)
    float diff1 = max(dot(hitNorm, lightDir1), 0.0);
    float diff2 = max(dot(hitNorm, lightDir2), 0.0) * 0.4;

    // Blinn-Phong specular reflections
    vec3 half1 = normalize(lightDir1 + viewDir);
    float spec1 = pow(max(dot(hitNorm, half1), 0.0), 32.0);
    vec3 half2 = normalize(lightDir2 + viewDir);
    float spec2 = pow(max(dot(hitNorm, half2), 0.0), 16.0);

    // Fresnel effect
    float fresnel = pow(clamp(1.0 - dot(viewDir, hitNorm), 0.0, 1.0), 3.0);

    // Ambient occlusion & Subsurface scattering
    float ao = calcAO(hitPos, hitNorm);
    float sss = calcSSS(hitPos, rd, hitNorm);

    // Chromatic dispersion & absorption inside semi-translucent skin
    float transmissionDist = clamp(SURF_DIST / max(abs(minDistance), 0.0001), 0.1, 2.5);
    vec3 surfaceColor = mix(uColorA, uColorB, 0.5 + 0.5 * sin(length(hitPos) * 2.0 + uTime * 0.5));
    vec3 absorbed = chromaticAbsorption(transmissionDist, surfaceColor);

    // Combine diffuse, subsurface, ambient, and specular
    vec3 diffuseCol = surfaceColor * (diff1 + diff2) * ao;
    vec3 sssCol = uColorInterior * sss * 1.8;
    vec3 specCol = vec3(1.0, 0.95, 0.9) * (spec1 * 0.9 + spec2 * 0.4);
    vec3 ambientCol = surfaceColor * 0.12 * ao;
    vec3 fresnelCol = mix(uColorB, vec3(1.0), 0.6) * fresnel * 0.8;

    // Composite surface shade
    vec3 shaded = diffuseCol + sssCol + specCol + ambientCol + fresnelCol;
    shaded *= absorbed;

    // Distance atmospheric fog attenuation
    float fog = 1.0 - exp(-hitDist * 0.05);
    finalColor = mix(shaded, bgGradient, fog);
  }

  // Add glow & volumetric interior plasma core
  finalColor += uColorInterior * glowAcc * (0.4 + uSubsurfaceGlow * 0.6);
  finalColor += plasmaEmission * 0.5;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export function createRaymarchUniforms(): RaymarchUniforms {
  return {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uCameraPos: { value: new THREE.Vector3(0, 0, 4.5) },
    uCameraDir: { value: new THREE.Vector3(0, 0, -1) },
    uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
    uFov: { value: 60 },
    uMorphShape: { value: 0 },
    uBlendFactor: { value: 0.5 },
    uFractalIterations: { value: 6.0 },
    uSubsurfaceGlow: { value: 0.6 },
    uColorA: { value: new THREE.Color(0x00ffcc) },
    uColorB: { value: new THREE.Color(0xff00aa) },
    uColorInterior: { value: new THREE.Color(0x5500ff) },
    uMouse3D: { value: new THREE.Vector3(0, 0, 0) },
    uPulse: { value: 0 },
    uSurfaceTension: { value: 0.5 },
  };
}

export class RaymarchMaterial extends THREE.ShaderMaterial {
  declare uniforms: RaymarchUniforms & { [key: string]: THREE.IUniform };

  constructor(customUniforms?: Partial<RaymarchUniforms>) {
    const baseUniforms = createRaymarchUniforms();
    if (customUniforms) {
      Object.assign(baseUniforms, customUniforms);
    }

    super({
      vertexShader: RAYMARCH_VERTEX_SHADER,
      fragmentShader: RAYMARCH_FRAGMENT_SHADER,
      uniforms: baseUniforms as unknown as { [key: string]: THREE.IUniform },
      depthWrite: false,
      depthTest: false,
    });
  }

  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.uniforms.uCameraPos.value.copy(camera.position);
    camera.getWorldDirection(this.uniforms.uCameraDir.value);
    this.uniforms.uCameraUp.value.copy(camera.up);
    this.uniforms.uFov.value = camera.fov;
  }

  setResolution(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
  }
}
