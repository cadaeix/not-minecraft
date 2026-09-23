import * as THREE from 'three';

export interface PostProcessorOptions {
  width: number;
  height: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  chromaticAberration?: number;
  vignetteStrength?: number;
  grainIntensity?: number;
  exposure?: number;
}

const BRIGHTNESS_EXTRACT_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHTNESS_EXTRACT_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform float uThreshold;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  // Perceptual relative luminance
  float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp((luminance - uThreshold + 0.1) / 0.2, 0.0, 1.0);
  float factor = max(0.0, luminance - uThreshold) * soft;
  gl_FragColor = vec4(color.rgb * (factor / max(luminance, 0.0001)), color.a);
}
`;

const GAUSSIAN_BLUR_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GAUSSIAN_BLUR_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uDirection;
varying vec2 vUv;

// 9-tap Gaussian distribution filter
void main() {
  vec4 sum = vec4(0.0);
  vec2 tc = vUv;
  
  float weight[5];
  weight[0] = 0.227027;
  weight[1] = 0.1945946;
  weight[2] = 0.1216216;
  weight[3] = 0.054054;
  weight[4] = 0.016216;

  sum += texture2D(tDiffuse, tc) * weight[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = uDirection * float(i);
    sum += texture2D(tDiffuse, tc + off) * weight[i];
    sum += texture2D(tDiffuse, tc - off) * weight[i];
  }

  gl_FragColor = sum;
}
`;

const COMPOSITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloomStrength;
uniform float uChromaticAberration;
uniform float uVignetteStrength;
uniform float uGrainIntensity;
uniform float uExposure;
uniform float uTime;
varying vec2 vUv;

// Narkowicz 2015 ACES Filmic Tone Mapping Curve
vec3 acesFilmic(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Pseudo-random noise generator
float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 center = vec2(0.5);
  vec2 toCenter = vUv - center;
  float dist = length(toCenter);

  // Radial chromatic aberration
  vec2 chromOffset = toCenter * (uChromaticAberration * dist);
  float r = texture2D(tScene, vUv + chromOffset).r;
  float g = texture2D(tScene, vUv).g;
  float b = texture2D(tScene, vUv - chromOffset).b;
  vec3 sceneColor = vec3(r, g, b);

  // Luminous bloom accumulation
  vec3 bloomColor = texture2D(tBloom, vUv).rgb;
  vec3 color = sceneColor + bloomColor * uBloomStrength;

  // Dynamic exposure adjustment
  color *= uExposure;

  // ACES Filmic Tone Mapping
  color = acesFilmic(color);

  // Optical Vignette
  float vignette = clamp(1.0 - dist * dist * uVignetteStrength, 0.0, 1.0);
  color *= vignette;

  // Subtle animated film grain to break 8-bit digital banding
  float grain = (rand(vUv * 2.5 + vec2(uTime * 0.05, uTime * 0.02)) - 0.5) * uGrainIntensity;
  color += vec3(grain);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class PostProcessor {
  private width: number;
  private height: number;
  private sceneTarget: THREE.WebGLRenderTarget;
  private brightTarget: THREE.WebGLRenderTarget;
  private bloomTargetH: THREE.WebGLRenderTarget;
  private bloomTargetV: THREE.WebGLRenderTarget;

  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private quad: THREE.Mesh;

  private brightMaterial: THREE.ShaderMaterial;
  private blurHMaterial: THREE.ShaderMaterial;
  private blurVMaterial: THREE.ShaderMaterial;
  private compositeMaterial: THREE.ShaderMaterial;

  constructor(options: PostProcessorOptions) {
    this.width = options.width;
    this.height = options.height;

    const renderTargetParams: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      stencilBuffer: false,
    };

    // Full resolution scene target
    this.sceneTarget = new THREE.WebGLRenderTarget(this.width, this.height, renderTargetParams);

    // Quarter resolution bloom targets for performance and larger glow radius
    const bloomW = Math.max(1, Math.floor(this.width / 2));
    const bloomH = Math.max(1, Math.floor(this.height / 2));

    this.brightTarget = new THREE.WebGLRenderTarget(bloomW, bloomH, renderTargetParams);
    this.bloomTargetH = new THREE.WebGLRenderTarget(bloomW, bloomH, renderTargetParams);
    this.bloomTargetV = new THREE.WebGLRenderTarget(bloomW, bloomH, renderTargetParams);

    // Setup compositing scene & orthographic camera
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    const planeGeo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(planeGeo);
    this.postScene.add(this.quad);

    // 1. Brightness extraction material
    this.brightMaterial = new THREE.ShaderMaterial({
      vertexShader: BRIGHTNESS_EXTRACT_VERTEX,
      fragmentShader: BRIGHTNESS_EXTRACT_FRAGMENT,
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: options.bloomThreshold ?? 0.75 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const radius = options.bloomRadius ?? 1.25;

    // 2. Horizontal Gaussian blur
    this.blurHMaterial = new THREE.ShaderMaterial({
      vertexShader: GAUSSIAN_BLUR_VERTEX,
      fragmentShader: GAUSSIAN_BLUR_FRAGMENT,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(radius / bloomW, 0.0) },
      },
      depthTest: false,
      depthWrite: false,
    });

    // 3. Vertical Gaussian blur
    this.blurVMaterial = new THREE.ShaderMaterial({
      vertexShader: GAUSSIAN_BLUR_VERTEX,
      fragmentShader: GAUSSIAN_BLUR_FRAGMENT,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(0.0, radius / bloomH) },
      },
      depthTest: false,
      depthWrite: false,
    });

    // 4. Composite & Tone Mapping material
    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloomStrength: { value: options.bloomStrength ?? 0.65 },
        uChromaticAberration: { value: options.chromaticAberration ?? 0.012 },
        uVignetteStrength: { value: options.vignetteStrength ?? 0.95 },
        uGrainIntensity: { value: options.grainIntensity ?? 0.035 },
        uExposure: { value: options.exposure ?? 1.0 },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.sceneTarget.setSize(width, height);

    const bloomW = Math.max(1, Math.floor(width / 2));
    const bloomH = Math.max(1, Math.floor(height / 2));
    this.brightTarget.setSize(bloomW, bloomH);
    this.bloomTargetH.setSize(bloomW, bloomH);
    this.bloomTargetV.setSize(bloomW, bloomH);

    this.blurHMaterial.uniforms.uDirection.value.set(1.25 / bloomW, 0.0);
    this.blurVMaterial.uniforms.uDirection.value.set(0.0, 1.25 / bloomH);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    // Stage 1: Render raw scene to HDR scene target
    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);

    // Stage 2: Extract bright areas above threshold
    this.quad.material = this.brightMaterial;
    this.brightMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
    renderer.setRenderTarget(this.brightTarget);
    renderer.clear();
    renderer.render(this.postScene, this.postCamera);

    // Stage 3: Horizontal Gaussian blur
    this.quad.material = this.blurHMaterial;
    this.blurHMaterial.uniforms.tDiffuse.value = this.brightTarget.texture;
    renderer.setRenderTarget(this.bloomTargetH);
    renderer.clear();
    renderer.render(this.postScene, this.postCamera);

    // Stage 4: Vertical Gaussian blur
    this.quad.material = this.blurVMaterial;
    this.blurVMaterial.uniforms.tDiffuse.value = this.bloomTargetH.texture;
    renderer.setRenderTarget(this.bloomTargetV);
    renderer.clear();
    renderer.render(this.postScene, this.postCamera);

    // Stage 5: Final composite (Chromatic aberration + Bloom + Tone Mapping + Vignette + Grain)
    this.quad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms.tScene.value = this.sceneTarget.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.bloomTargetV.texture;
    this.compositeMaterial.uniforms.uTime.value = performance.now() * 0.001;

    renderer.setRenderTarget(null);
    renderer.render(this.postScene, this.postCamera);
  }

  setBloomStrength(strength: number): void {
    this.compositeMaterial.uniforms.uBloomStrength.value = strength;
  }

  setBloomThreshold(threshold: number): void {
    this.brightMaterial.uniforms.uThreshold.value = threshold;
  }

  setChromaticAberration(amount: number): void {
    this.compositeMaterial.uniforms.uChromaticAberration.value = amount;
  }

  setVignetteStrength(strength: number): void {
    this.compositeMaterial.uniforms.uVignetteStrength.value = strength;
  }

  setGrainIntensity(intensity: number): void {
    this.compositeMaterial.uniforms.uGrainIntensity.value = intensity;
  }

  setExposure(exposure: number): void {
    this.compositeMaterial.uniforms.uExposure.value = exposure;
  }

  dispose(): void {
    this.sceneTarget.dispose();
    this.brightTarget.dispose();
    this.bloomTargetH.dispose();
    this.bloomTargetV.dispose();

    this.brightMaterial.dispose();
    this.blurHMaterial.dispose();
    this.blurVMaterial.dispose();
    this.compositeMaterial.dispose();

    this.quad.geometry.dispose();
  }
}
