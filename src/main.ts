import * as THREE from 'three';
import {
  RaymarchMaterial,
  ParticleSystem,
  PostProcessor,
  RendererManager,
} from './render';
import {
  FluidSimulator,
  PhysarumNetwork,
  ReactionDiffusion,
  BioluminescentFlock,
  LiquidSpraySimulator,
  AttractorManager,
} from './sim';
import {
  AudioSynthesis,
  SynestheticBridge,
} from './audio';
import {
  ToolManager,
  CameraControls,
  PRESET_ABYSSAL_BLOOM,
  PRESET_NEBULAR_GYROID,
  PRESET_MYCELIAL_NEXUS,
  PRESET_TURING_CHRYSALIS,
  PRESET_SINGULARITY_FLUX,
  getPresetByName,
  blendPresets,
  clonePreset,
} from './interaction';
import {
  GameStateManager,
  ResonanceNodes,
  VoidBlight,
  GameHud,
} from './game';
import { HudOverlay } from './ui/HudOverlay';
import { PresetConfig, SimulationTelemetry, ToolType } from './types';

export class AnimaApp {
  // Core Three.js & Render Engine
  private rendererManager: RendererManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraControls: CameraControls;
  private postProcessor: PostProcessor;

  // Visual Entities
  private raymarchMaterial: RaymarchMaterial;
  private raymarchMesh: THREE.Mesh;
  private particleSystem: ParticleSystem;
  private flock: BioluminescentFlock;
  private flockRibbonMesh: THREE.LineSegments;

  // Simulation Engines
  private fluidSim: FluidSimulator;
  private physarum: PhysarumNetwork;
  private reactionDiffusion: ReactionDiffusion;
  private liquidSpray: LiquidSpraySimulator;
  private attractors: AttractorManager;

  // Audio Engine
  private audio: AudioSynthesis;
  private bridge: SynestheticBridge;

  // Interaction & UI
  private toolManager: ToolManager;
  private hud: HudOverlay;
  // Game Mode & Ecosystem Harmonization
  private gameState: GameStateManager;
  private resonanceNodes: ResonanceNodes;
  private voidBlight: VoidBlight;
  private gameHud: GameHud;

  // Preset State & Transition Interpolation
  private currentPreset: PresetConfig;
  private targetPreset: PresetConfig;
  private isMorphingPreset = false;
  private morphTimer = 0;
  private morphDuration = 2.4;
  private startPresetSnapshot: PresetConfig;

  // Telemetry Metrics
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private telemetry: SimulationTelemetry = {
    fps: 60,
    particleCount: 120000,
    fluidKineticEnergy: 0,
    entropy: 0.74,
    biomass: 32000,
    dominantHarmonicHz: 432,
    activeOrganisms: 160,
    activeAttractors: 0,
    liquidDropletCount: 0,
  };

  // Scratch objects for 0-GC loop
  private scratchV3 = new THREE.Vector3();
  private scratchPointerState = {
    isDragging: false,
    pointerX: 0,
    pointerY: 0,
    deltaX: 0,
    deltaY: 0,
    activeTool: 'vortex' as ToolType,
    intensity: 0.8,
    particleVelocity: 0.5,
  };

  constructor() {
    const container = document.getElementById('canvas-container')!;

    // 1. Initialize Renderer & WebGL2
    this.rendererManager = new RendererManager({
      container,
      antialias: true,
      maxDpr: 2.0,
    });

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 2. Setup Three.js Scene and Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 4, 18);

    // 3. Setup Camera Controls
    this.cameraControls = new CameraControls(this.camera, this.rendererManager.canvas, {
      mode: 'orbit',
      moveSpeed: 16.0,
      rotateSpeed: 0.0035,
      zoomSpeed: 1.25,
      minDistance: 3.0,
      maxDistance: 80.0,
      organicSway: true,
    });

    // 4. Setup Post-Processing Compositor (HDR Bloom, Chromatic Aberration, ACES Tonemapping)
    this.postProcessor = new PostProcessor({
      width,
      height,
      bloomStrength: 0.38,
      bloomThreshold: 0.7,
      bloomRadius: 1.0,
      chromaticAberration: 0.012,
      vignetteStrength: 0.85,
      grainIntensity: 0.024,
      exposure: 1.0,
    });

    // 5. Setup Full-Screen Volumetric Raymarching Quad
    this.raymarchMaterial = new RaymarchMaterial();
    this.raymarchMaterial.setResolution(width, height);

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.raymarchMesh = new THREE.Mesh(quadGeo, this.raymarchMaterial);
    this.raymarchMesh.frustumCulled = false;
    this.raymarchMesh.renderOrder = -100;
    this.scene.add(this.raymarchMesh);

    // 6. Setup 120k+ GPU Particle System
    this.particleSystem = new ParticleSystem({
      count: 120000,
      maxCount: 150000,
      baseSize: 1.8,
      hue: 0.52,
    });
    this.particleSystem.renderOrder = 1;
    this.scene.add(this.particleSystem);

    // 7. Setup Bioluminescent Flock & Soft-Body Ribbons
    this.flock = new BioluminescentFlock({
      count: 160,
      trailLength: 24,
      containmentRadius: 16.0,
      maxSpeed: 7.5,
    });

    const ribbonGeo = this.flock.createRibbonGeometry();
    const ribbonMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flockRibbonMesh = new THREE.LineSegments(ribbonGeo, ribbonMat);
    this.flockRibbonMesh.frustumCulled = false;
    this.flockRibbonMesh.renderOrder = 2;
    this.scene.add(this.flockRibbonMesh);

    // 8. Setup Continuous Simulation Engines
    this.fluidSim = new FluidSimulator({
      width: 128,
      height: 128,
      viscosity: 0.0001,
      vorticityStrength: 0.45,
    });

    this.physarum = new PhysarumNetwork({
      width: 256,
      height: 256,
      agentCount: 32768,
      sensorAngle: 0.45,
      sensorDist: 16.0,
      stepSize: 1.3,
    });

    this.reactionDiffusion = new ReactionDiffusion({
      width: 192,
      height: 192,
      feed: 0.038,
      kill: 0.061,
    });
    // 8b. Setup 3D Liquid Spray Simulator & Gravitational Attractors
    this.liquidSpray = new LiquidSpraySimulator(16000);
    this.scene.add(this.liquidSpray.mesh);

    this.attractors = new AttractorManager();
    this.scene.add(this.attractors.getGroup());
    // 8c. Setup Cosmic Harmony Game Systems (Nodes, Blight, Quests)
    this.gameState = new GameStateManager();
    this.resonanceNodes = new ResonanceNodes(this.gameState);
    this.scene.add(this.resonanceNodes.getGroup());

    this.voidBlight = new VoidBlight(this.gameState);
    this.scene.add(this.voidBlight.getGroup());

    this.gameHud = new GameHud(this.gameState);

    this.gameState.onNotification((notif) => {
      if (typeof notif.points === 'number' && notif.points > 0) {
        this.audio.triggerChime(480 + Math.random() * 260, 0.7);
      }
    });

    // 9. Setup Procedural Web Audio Engine & Synesthetic Bridge
    this.audio = new AudioSynthesis();
    this.bridge = new SynestheticBridge(this.audio);

    // 10. Setup Tool Manager
    this.toolManager = new ToolManager(this.camera, this.rendererManager.canvas);

    // 11. Initial Presets
    this.currentPreset = clonePreset(PRESET_ABYSSAL_BLOOM);
    this.targetPreset = clonePreset(PRESET_ABYSSAL_BLOOM);
    this.startPresetSnapshot = clonePreset(PRESET_ABYSSAL_BLOOM);
    this.applyPresetInstant(this.currentPreset);

    // 12. Setup UI Telemetry HUD & Controls
    this.hud = new HudOverlay({
      onToolSelect: (tool: ToolType) => {
        this.toolManager.setTool(tool);
      },
      onPresetSelect: (presetId: string) => {
        this.switchPreset(presetId);
      },
      onAudioToggle: async () => {
        return await this.toggleAudio();
      },
      onCameraReset: () => {
        this.cameraControls.reset(new THREE.Vector3(0, 0, 0), 22.0);
      },
      onCameraModeToggle: () => {
        const nextMode = this.cameraControls.getMode() === 'orbit' ? 'free_glide' : 'orbit';
        this.cameraControls.setMode(nextMode);
        return nextMode === 'orbit' ? 'Orbit Mode' : 'Free Glide';
      },
      onImpulse: () => {
        this.triggerCosmicImpulse();
      },
      onClearAttractors: () => {
        this.attractors.clear();
        this.audio.triggerGravitonShock(0.5);
      },
    });

    // 13. Wire Tool Event Callbacks
    this.bindToolInteractions();

    // 14. Handle Resizing
    this.rendererManager.onResize((w, h) => {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.postProcessor.setSize(w, h);
      this.raymarchMaterial.setResolution(w, h);
    });

    // 15. Start Render & Physics Loop
    this.rendererManager.onRender((dt: number, time: number) => {
      this.update(dt, time);
      this.render();
    });
    this.rendererManager.start();
  }

  private bindToolInteractions() {
    // Tool continuous stroke handler
    this.toolManager.onStroke((stroke) => {
      if (!stroke.active) return;

      const tool = stroke.tool;
      const pt = stroke.point3D;
      const speed = stroke.speed;

      // Coordinate mapping to 2D simulation grids [0..1]
      const simNormX = THREE.MathUtils.clamp(stroke.screenPos.x / window.innerWidth, 0.02, 0.98);
      const simNormY = THREE.MathUtils.clamp(1.0 - stroke.screenPos.y / window.innerHeight, 0.02, 0.98);

      const fluidX = simNormX * this.fluidSim.width;
      const fluidY = simNormY * this.fluidSim.height;

      switch (tool) {
        case 'vortex': {
          // Inject swirling vorticity into Navier-Stokes
          const spin = stroke.vortex.spinDirection;
          const swirlVx = stroke.velocity3D.x * 2.5 + Math.sin(stroke.time * 6.0) * 1.5;
          const swirlVy = stroke.velocity3D.y * 2.5 + Math.cos(stroke.time * 6.0) * 1.5;

          this.fluidSim.addVelocity(fluidX, fluidY, swirlVx, swirlVy);
          this.fluidSim.addDensity(fluidX, fluidY, 1.2 * stroke.strength);

          // Excite bioluminescent flock
          this.flock.applyGravitonImpulse(pt, 12.0 * stroke.strength, stroke.radius * 2.5, 0.4);
          this.gameState.reportFluidEnergy(this.fluidSim.getKineticEnergy());
          break;
        }

        case 'graviton_pull': {
          // Curvature of spacetime towards brush point
          this.flock.applyGravitonImpulse(pt, 25.0 * stroke.strength, stroke.radius * 4.0, 0.8);

          // Fluid suction towards attractor
          const pullX = (0.5 - simNormX) * 4.0;
          const pullY = (0.5 - simNormY) * 4.0;
          this.fluidSim.addVelocity(fluidX, fluidY, pullX, pullY);
          break;
        }

        case 'graviton_push': {
          // Repulsive shockwave
          this.flock.applyGravitonImpulse(pt, -32.0 * stroke.strength, stroke.radius * 5.0, 0.6);
          this.audio.triggerGravitonShock(stroke.strength);
          break;
        }

        case 'turing_seed': {
          // Gray-Scott activator/inhibitor injection
          const rdX = simNormX * this.reactionDiffusion.width;
          const rdY = simNormY * this.reactionDiffusion.height;
          this.reactionDiffusion.inject(rdX, rdY, stroke.radius * 2.0, 0.9);
          break;
        }

        case 'mycelium_spore': {
          // Physarum slime mold spore burst
          const physX = simNormX * this.physarum.width;
          const physY = simNormY * this.physarum.height;
          this.physarum.depositFood(physX, physY, 2.5, 12.0);
          this.physarum.spawnSporeBurst(physX, physY, 128, 8.0);
          break;
        }

        case 'chromatic_pulse': {
          // Synesthetic modal chime and light pulse
          if (stroke.justStarted) {
            const chimeFreq = 220 + simNormX * 660;
            this.audio.triggerChime(chimeFreq, 0.85);
            this.raymarchMaterial.uniforms.uPulse.value = 1.0;
          }
          break;
        }

        case 'phase_melt': {
          // SDF Topology thermal mutation
          const currentTension = this.raymarchMaterial.uniforms.uSurfaceTension.value;
          this.raymarchMaterial.uniforms.uSurfaceTension.value = THREE.MathUtils.lerp(
            currentTension,
            0.12,
            0.05
          );
          const currentBlend = this.raymarchMaterial.uniforms.uBlendFactor.value;
          this.raymarchMaterial.uniforms.uBlendFactor.value = THREE.MathUtils.clamp(
            currentBlend + 0.02,
            0.2,
            1.4
          );
          break;
        }
        case 'liquid_spray': {
          // Continuous high-velocity liquid jet from camera along 3D ray
          const sprayOrigin = stroke.ray.origin.clone().addScaledVector(stroke.ray.direction, 1.5);
          this.liquidSpray.emitSpray(
            sprayOrigin,
            stroke.ray.direction,
            36,
            28.0,
            0.07,
            this.currentPreset.raymarch.colorA
          );
          if (Math.random() < 0.25) {
            this.audio.triggerChime(340 + Math.random() * 260, 0.35);
          }
          break;
        }

        case 'place_attractor': {
          // Drop persistent gravitational singularity
          if (stroke.justStarted) {
            this.gameState.reportAttractorPlaced();
            this.attractors.addAttractor(
              stroke.point3D.clone(),
              3.5 * stroke.strength,
              this.currentPreset.raymarch.colorB
            );
            this.audio.triggerGravitonShock(0.9);
            this.audio.triggerChime(528, 0.9);
            this.raymarchMaterial.uniforms.uPulse.value = 1.2;
          }
          break;
        }
      }

      // Update pointer scratch state for synesthetic bridge
      this.scratchPointerState.isDragging = true;
      this.scratchPointerState.pointerX = (stroke.screenPos.x / window.innerWidth) * 2.0 - 1.0;
      this.scratchPointerState.pointerY = -(stroke.screenPos.y / window.innerHeight) * 2.0 + 1.0;
      this.scratchPointerState.deltaX = stroke.screenDelta.x;
      this.scratchPointerState.deltaY = stroke.screenDelta.y;
      this.scratchPointerState.activeTool = tool;
      this.scratchPointerState.intensity = stroke.strength;
    });

    // Pulse trigger callback (Spacebar or pulse button)
    this.toolManager.onPulse((tool, point, strength) => {
      this.triggerCosmicImpulse(point, strength);
    });
  }

  private triggerCosmicImpulse(point?: THREE.Vector3, strength: number = 1.0) {
    const pt = point || this.cameraControls.target;
    this.gameState.reportShockwave();
    this.voidBlight.hitWithShockwave(pt, 30.0, 50.0);
    this.flock.applyGravitonImpulse(pt, -45.0 * strength, 28.0, 1.2);
    this.audio.triggerGravitonShock(strength);
    this.audio.triggerChime(528, 0.95);
    this.raymarchMaterial.uniforms.uPulse.value = 1.5;

    // Fluid turbulence burst
    const midX = this.fluidSim.width * 0.5;
    const midY = this.fluidSim.height * 0.5;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
      this.fluidSim.addVelocity(
        midX + Math.cos(angle) * 10,
        midY + Math.sin(angle) * 10,
        Math.cos(angle) * 8.0,
        Math.sin(angle) * 8.0
      );
    }
  }

  public switchPreset(presetId: string) {
    const preset = this.resolvePresetById(presetId);
    if (!preset) return;

    this.startPresetSnapshot = clonePreset(this.currentPreset);
    this.targetPreset = clonePreset(preset);
    this.isMorphingPreset = true;
    this.morphTimer = 0;

    // Cinematic camera transition
    this.cameraControls.transitionToPreset(preset, 2.2);

    // Audio preset scale and tuning
    this.audio.applyPreset(preset.audio);
  }

  private resolvePresetById(id: string): PresetConfig | undefined {
    switch (id.toLowerCase()) {
      case 'abyssal': return PRESET_ABYSSAL_BLOOM;
      case 'gyroid': return PRESET_NEBULAR_GYROID;
      case 'mycelium': return PRESET_MYCELIAL_NEXUS;
      case 'turing': return PRESET_TURING_CHRYSALIS;
      case 'singularity': return PRESET_SINGULARITY_FLUX;
      default: return getPresetByName(id) || PRESET_ABYSSAL_BLOOM;
    }
  }

  private applyPresetInstant(preset: PresetConfig) {
    // Raymarching uniforms
    const rm = this.raymarchMaterial.uniforms;
    rm.uMorphShape.value = preset.raymarch.morphShape;
    rm.uBlendFactor.value = preset.raymarch.blendFactor;
    rm.uFractalIterations.value = preset.raymarch.fractalIterations;
    rm.uSubsurfaceGlow.value = preset.raymarch.subsurfaceGlow;
    rm.uColorA.value.copy(preset.raymarch.colorA);
    rm.uColorB.value.copy(preset.raymarch.colorB);
    rm.uColorInterior.value.copy(preset.raymarch.colorInterior);
    rm.uSurfaceTension.value = preset.raymarch.surfaceTension;

    // Particle system
    this.particleSystem.setCount(preset.particles.count);
    this.particleSystem.setHue(preset.particles.colorHue);
    this.particleSystem.setPhosphorescence(preset.particles.phosphorescence);

    // Simulation
    this.fluidSim.viscosity = preset.simulation.viscosity;
    this.fluidSim.vorticityStrength = preset.simulation.vorticity;
    this.reactionDiffusion.setParameters(preset.simulation.reactionFeed, preset.simulation.reactionKill);
    this.physarum.sensorAngle = preset.simulation.slimeSensorAngle;
    this.physarum.sensorDist = preset.simulation.slimeSensorDist;
    this.physarum.stepSize = preset.simulation.slimeStepSize;

    // Audio
    this.audio.applyPreset(preset.audio);
    // Liquid spray settings sync
    this.liquidSpray.morphShape = preset.raymarch.morphShape;
    this.liquidSpray.blendFactor = preset.raymarch.blendFactor;
    this.liquidSpray.currentLiquidColor.copy(preset.raymarch.colorA);
    this.resonanceNodes?.respawnNodes(preset.raymarch.morphShape, performance.now() * 0.001);
  }

  private async toggleAudio(): Promise<boolean> {
    if (!this.audio.isPlaying()) {
      if (!this.audio.isInitialized()) {
        await this.audio.init();
      }
      await this.audio.start();
      return true;
    } else {
      this.audio.stop();
      return false;
    }
  }

  private update(dt: number, time: number) {
    // 1. Morphing Presets Interpolation
    if (this.isMorphingPreset) {
      this.morphTimer += dt;
      const alpha = Math.min(1.0, this.morphTimer / this.morphDuration);
      const blended = blendPresets(this.startPresetSnapshot, this.targetPreset, alpha, this.currentPreset);
      this.applyPresetInstant(blended);

      if (alpha >= 1.0) {
        this.isMorphingPreset = false;
      }
    }

    // 2. Camera Controls Update
    this.cameraControls.update(dt);

    // 3. Tool Manager Update (Zero GC)
    this.toolManager.update(dt);

    // 4. Update Raymarching Camera and Uniforms
    this.raymarchMaterial.updateCamera(this.camera);
    this.raymarchMaterial.uniforms.uTime.value = time;
    this.raymarchMaterial.uniforms.uPulse.value = Math.max(
      0.0,
      this.raymarchMaterial.uniforms.uPulse.value - dt * 1.8
    );

    // 5. Simulation Step
    this.fluidSim.step(dt);
    this.physarum.step(dt);
    this.reactionDiffusion.step(dt);

    // 6. Symbiotic Flock Step & Ribbon Buffer Update
    this.flock.step(dt, this.fluidSim);
    this.flock.updateRibbonGeometry(this.flockRibbonMesh.geometry);

    // 6b. Placed Attractor Dynamics & Liquid Spray Step
    this.attractors.update(dt, time);
    this.liquidSpray.morphShape = this.currentPreset.raymarch.morphShape;
    this.liquidSpray.blendFactor = this.currentPreset.raymarch.blendFactor;
    this.liquidSpray.update(dt, time, this.attractors.getAttractors());

    // Couple placed attractors into flocking organisms
    const activeAtts = this.attractors.getAttractors();
    for (let a = 0; a < activeAtts.length; a++) {
      const att = activeAtts[a];
      this.flock.applyGravitonImpulse(att.position, att.mass * 3.5, 22.0);
    }
    // 6c. Game Simulation Systems Update
    this.gameState.update(dt);
    this.gameHud.update(dt);
    this.resonanceNodes.update(dt, time);
    this.voidBlight.update(dt, time, this.attractors.getAttractors());

    // Check liquid spray droplet interactions with nodes & blight
    const sprayCount = this.liquidSpray.getDropletCount();
    if (sprayCount > 0) {
      const packedPos = this.liquidSpray.getPackedPositions();
      this.resonanceNodes.checkLiquidCollisions(packedPos, sprayCount, this.liquidSpray.dropletRadius);
      this.voidBlight.checkLiquidCollisions(packedPos, sprayCount, this.liquidSpray.dropletRadius);
    }
    // 7. GPU Particle System Update
    const attractorPos = this.toolManager.getPoint3D();
    const toolMeta = this.toolManager.getActiveMetadata();
    const toolStrength = this.toolManager.isInteracting()
      ? (this.toolManager.getActiveTool() === 'graviton_pull' ? 1.8 : -1.5)
      : 0.15;

    this.particleSystem.update(
      dt,
      time,
      attractorPos,
      toolStrength,
      this.fluidSim.getVelocityTexture()
    );

    // 8. Audio Synesthetic Bridge Update
    const kineticEnergy = this.fluidSim.getKineticEnergy();
    const biomass = this.physarum.getBiomass();
    const entropy = this.reactionDiffusion.getMorphogenEntropy();

    if (!this.toolManager.isInteracting()) {
      this.scratchPointerState.isDragging = false;
    }

    this.bridge.update(
      {
        fps: this.currentFps,
        particleCount: this.particleSystem.getCount(),
        fluidKineticEnergy: kineticEnergy,
        entropy,
        biomass,
        dominantHarmonicHz: this.currentPreset.audio.baseFrequency * 4.0,
        activeOrganisms: this.flock.getActiveCount(),
        activeAttractors: this.attractors.getCount(),
        liquidDropletCount: this.liquidSpray.getDropletCount(),
      },
      this.scratchPointerState,
      dt
    );

    // 9. Telemetry HUD Refresh (Every 6 frames to avoid DOM overhead)
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.1) {
      this.currentFps = THREE.MathUtils.lerp(this.currentFps, 1.0 / Math.max(0.001, dt), 0.2);
      this.telemetry.fps = this.currentFps;
      this.telemetry.fluidKineticEnergy = kineticEnergy;
      this.telemetry.entropy = entropy;
      this.telemetry.biomass = biomass;
      this.telemetry.dominantHarmonicHz = this.currentPreset.audio.baseFrequency * 4.0;
      this.telemetry.particleCount = this.particleSystem.getCount();
      this.telemetry.activeOrganisms = this.flock.getActiveCount();
      this.telemetry.activeAttractors = this.attractors.getCount();
      this.telemetry.liquidDropletCount = this.liquidSpray.getDropletCount();

      this.hud.updateTelemetry(this.telemetry);
      this.fpsTimer = 0;
    }
  }

  private render() {
    // Stage: HDR Post-Processing Compositor (Raymarching + Particles + Flock Ribbons -> Bloom + Aberration)
    this.postProcessor.render(this.rendererManager.renderer, this.scene, this.camera);
  }
}

// Instantiate application on window load
window.addEventListener('DOMContentLoaded', () => {
  new AnimaApp();
});
