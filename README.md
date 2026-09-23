# ANIMA: The Anti-Cube

> _"Minecraft trapped reality in rigid cubic voxels, isolated survival grinding, and destructive resource extraction. ANIMA is infinite fluid continuity, organic symbiosis, non-Euclidean morphing topologies, and synesthetic radiance."_

![It's not minecraft](/screenshot.png)

![ANIMA Preview](ANIMA_DEMO.mp4)

---

```
<cadnote>
Brought to you by me asking Gemini 3.8 Flash to not make Minecraft. Everyone else is making Minecraft-clones to test out model capabilities. This is not Minecraft.

Also, I have no idea what's going on in this readme or this repo. Aka vibecoding.
</cadnote>
```

---

## ✦ Philosophical Inversion

| Dimension      | **Minecraft** (The Cube)                                                                      | **ANIMA** (The Continuum)                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Geometry**   | Discrete, rigid $1\times 1\times 1$ cubes, harsh 90° right angles                             | **Infinite Continuous SDFs**: Gyroids, Schwarz P minimal surfaces, smooth polynomial metaballs (`smin`), Mandelbulb fractal folds |
| **Physics**    | Static blocks on a quantized discrete grid with crude falling exceptions                      | **Continuous Navier-Stokes Fluid**: Eulerian velocity grid, vorticity confinement, semi-Lagrangian advection                      |
| **Ecology**    | Desolate terrestrial isolation, farm pens, and enemy mobs                                     | **Living Physarum Slime & Symbiotic Pelagic Flocks**: 32,768 chemoattractant-sensing slime agents weaving transport bridges       |
| **Core Loop**  | **Destructive Extraction**: Chopping trees, strip-mining stone, hoarding items in grid chests | **Generative Synthesis**: Weaving fluid vortices, inoculating morphogens, bending spacetime, resonant singing                     |
| **Aesthetics** | Muddy brown/grey, low-resolution pixelated textures                                           | **Bioluminescent Radiance**: 120,000+ GPU curl noise particles, chromatic dispersion, subsurface scattering, ACES tone mapping    |
| **Audio**      | Silent footsteps and sparse, solitary piano chords                                            | **Synesthetic Web Audio Synthesizer**: Microtonal polyphonic drone chords, modal resonance bell chimes, graviton sub-bass sweeps  |

---

## 🌌 Mathematical & Physical Foundations

### 1. Volumetric Non-Euclidean Raymarching

ANIMA renders full-screen organic topologies without polygon meshes:

- **Gyroid Minimal Surface**: $\cos(x)\sin(y) + \cos(y)\sin(z) + \cos(z)\sin(x) = 0$ bounded within an organic sphere.
- **Schwarz P Minimal Surface**: $\cos(x) + \cos(y) + \cos(z) = 0$ generating periodic cosmic tunnels.
- **Polynomial Smooth Minimum (`smin`)**: Soft-body metaball blending where distance fields fuse like living organic membranes without sharp creases:
  $$smin(a, b, k) = \text{mix}(b, a, h) - k \cdot h \cdot (1 - h) \quad \text{where } h = \text{clamp}\left(0.5 + 0.5 \frac{b - a}{k}, 0, 1\right)$$
- **Tetrahedron Normal Gradient**: High-efficiency 4-tap SDF gradient reconstruction for Phong/Blinn specular highlights, volumetric ambient occlusion (AO), and subsurface scattering (SSS).

### 2. Eulerian Navier-Stokes Fluid Dynamics

A continuous grid-based fluid velocity solver runs every frame with zero garbage collection allocations:

- **Semi-Lagrangian Advection**: Traces velocity characteristics backward through time.
- **Vorticity Confinement**: Restores small-scale turbulent eddies and rotational energy:
  $$\vec{\omega} = \nabla \times \vec{u}, \quad \vec{\eta} = \frac{\nabla |\vec{\omega}|}{|\nabla |\vec{\omega}||}, \quad \vec{F}_{\text{vort}} = \epsilon (\vec{\eta} \times \vec{\omega})$$
- **Poisson Pressure Projection**: Solves $\nabla^2 p = \nabla \cdot \vec{u}$ via iterative Jacobi relaxation to enforce strict incompressibility ($\nabla \cdot \vec{u} = 0$).

### 3. Physarum Polycephalum (True Slime Mold) Transport Network

32,768 biological agents navigate a chemical trail map:

- **3-Sensor Sensory Cone**: Agents sample chemoattractant values ahead at angles $(-\theta, 0, +\theta)$ at distance $d$.
- **Motor Step & Chemotaxis**: Agents steer towards the highest chemical gradient and deposit nutrient trails.
- **Evaporation & Diffusion**: Trail fields diffuse across a $3\times 3$ kernel and evaporate exponentially, producing emergent, self-optimizing biological transport webs.

### 4. Gray-Scott Reaction-Diffusion Morphogenesis

Continuous non-linear chemical reaction producing living coral and labyrinthine patterns:
$$\frac{\partial U}{\partial t} = D_u \nabla^2 U - U V^2 + F(1 - U)$$
$$\frac{\partial V}{\partial t} = D_v \nabla^2 V + U V^2 - (F + K)V$$
Using 9-point isotropic Laplacians on dual-buffered Float32 grids.

### 5. Bioluminescent Soft-Body Symbiotes

160 pelagic soft-body organisms swimming through continuous space:

- Craig Reynolds 3D boids flocking rules (Separation, Alignment, Cohesion).
- Continuous fluid velocity advection coupling (sampled directly from the Navier-Stokes velocity field).
- Trailing dynamic ribbon buffers rendered as additive bioluminescent emission lines.

### 6. Pure Web Audio Procedural Synthesizer

Zero external MP3/WAV audio files:

- **Microtonal Polyphonic Drone**: Multi-oscillator detuned harmonic chords with dual LFO filter modulation.
- **Algorithmic Generative Arpeggiator**: Modal pitch generation across Lydian, Harmonic Minor, and Celestial scales.
- **Physical Modal Resonance Chimes**: Simulates crystalline physical chime modes $(1.0, 2.76, 5.4, 8.9)$ with exponential decay.
- **Synesthetic Bridge**: Real-time bidirectional mapping: fluid kinetic energy drives harmonic overtone richness, while mouse drags modulate pitch bend and spatial stereo panning.

---

## 🛠️ The 9 Genesis Tools (The Anti-Mine, Anti-Craft)

| Key     | Tool                   | Description                                                                                                                                     |
| ------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **`1`** | **Vortex Weaver**      | Injects swirling angular momentum and glowing bioluminescence into fluid and particle fields.                                                   |
| **`2`** | **Graviton Attractor** | Curvature of spacetime brush, drawing particles, fluid, and flocking organisms into harmonic orbit.                                             |
| **`3`** | **Graviton Shockwave** | Detonates repulsive cosmic shockwaves in expanding concentric rings.                                                                            |
| **`4`** | **Turing Morphogen**   | Inoculates concentrated Gray-Scott activator/inhibitor chemicals to trigger spontaneous coral/leopard morphogenesis.                            |
| **`5`** | **Mycelial Spores**    | Releases a burst of Physarum slime mold agents that deposit chemoattractants and form network bridges.                                          |
| **`6`** | **Chromatic Pulse**    | Emits an expansive light wave that excites all ambient matter and rings the procedural chime synth.                                             |
| **`7`** | **Phase Melter**       | Thermally mutates the raymarching SDF topology, blending crystalline minimal surfaces into liquid plasma.                                       |
| **`8`** | **Liquid Spray**       | Continuous high-velocity bioluminescent liquid jet that collides with the non-Euclidean shape, splashing, beading, and adhering to its surface. |
| **`9`** | **Drop Singularity**   | Places persistent gravitational attractor wells (with glowing event horizons and spinning accretion disks) that bend liquid and matter.         |

---

## 🎮 Cosmic Harmony Game Mode

ANIMA includes an active gameplay loop where you act as a **Celestial Harmonizer** nurturing the living cosmos against creeping void entropy:

- **🌸 Resonant Lotus Hydration**: Dormant lotus receptors are rooted along the contours of the non-Euclidean shape. Select **Liquid Spray (`8`)** and spray liquid over them to hydrate and trigger radiant petal blooms!
- **⚡ Vortex Overdrive**: Stagnant entropy pockets form in the continuum. Use the **Vortex Weaver (`1`)** to swirl fluid velocity past critical thresholds, clearing the stagnation.
- **👾 Void Blight Purification**: Rogue discordant energy rifts crackle in space, draining continuum stability. Pummel them with **Liquid Spray (`8`)**, anchor them with **Singularities (`9`)**, and detonate **Harmonic Shockwaves (`Space`)** to dissolve them into showers of starlight!
- **🔥 Combo Multiplier & Genesis Tiers**: Chaining harmonious actions ramps your combo meter from **`x1` $\to$ `x2` $\to$ `x4` $\to$ `x8` $\to$ `x16`**, multiplying all score rewards. Accumulating score ascends your universe through 5 Genesis Tiers:
  1. **Tier I: Primordial Spark**
  2. **Tier II: Resonant Bloom**
  3. **Tier III: Mycelial Nexus**
  4. **Tier IV: Singularity Dawn**
  5. **Tier V: Omnipresent Harmony**
- **Mode Switcher**: Seamlessly toggle between **`GAME MODE ✦`** (missions, scores, health meter) and **`SANDBOX ⟳`** (free-form cosmic sculpting) using the top-left mode button!

---

## 🎨 The 5 Presets

1. **The Abyssal Bloom**: Deep sea hydrothermal abyss, pulsing ruby/magenta soft-body jellies, and swirling fluid currents.
2. **Nebular Gyroid**: Triply periodic cosmic minimal surface folded across infinite dimensions with royal violet and starlight gold iridescence.
3. **Mycelial Nexus**: Sprawling golden Schwarz P minimal surface with streaming Physarum nutrient transport threads.
4. **Turing Chrysalis**: Translucent emerald and jade reaction-diffusion organism with evolving coral/labyrinth skin.
5. **Singularity Flux**: High-energy gravitational vortex with 150,000 relativistic particles streaming through curved spacetime corridors.

---

## 🕹️ Controls Guide

| Input                                    | Action                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| **Left Click + Drag**                    | Interact with active Genesis Tool (Vortex, Gravity, Morphogen, etc.)               |
| **Right Click + Drag** _(or Alt + Drag)_ | Orbit / Rotate Camera around the living cosmos                                     |
| **Middle Click + Drag**                  | Pan Camera across view plane                                                       |
| **Scroll Wheel**                         | Zoom depth / fly through volumetric fields                                         |
| **`1` – `9`**                            | Quick-switch Genesis Tools                                                         |
| **`X`** _(or Clear button)_              | Clear all placed gravitational singularities                                       |
| **`Spacebar`**                           | Detonate Omnidirectional Harmonic Shockwave                                        |
| **`C`**                                  | Toggle Camera Mode: **Celestial Orbit** $\longleftrightarrow$ **6-DOF Free Glide** |
| **`W` / `A` / `S` / `D`**                | Drift / Glide through space (in Free Glide mode)                                   |
| **`R`**                                  | Smooth camera reset to default perspective                                         |
| **`M`**                                  | Toggle Procedural Synesthetic Audio Engine                                         |
| **`?`**                                  | Open Anti-Minecraft Manifesto overlay                                              |

---

## 🚀 Getting Started

### Prerequisites

- Node.js $\ge 18$
- Modern browser with WebGL2 support (Chrome, Edge, Firefox, Brave)

### Installation & Launch

```bash
# 1. Install dependencies
npm install

# 2. Launch Vite development server
npm run dev
```

Open your browser to `http://localhost:3000`.

### Production Build

```bash
# Type check and build optimized bundle
npm run build

# Preview production build
npm run preview
```

---

## 📁 Architecture Overview

```
not-minecraft/
├── index.html                 # Ethereal glassmorphic HUD & canvas mount
├── src/
│   ├── main.ts                # Application orchestrator, loop, state, event routing
│   ├── types.ts               # Shared contracts for tools, presets, telemetry
│   ├── style.css              # Glassmorphic cyberpunk/organic CSS styling
│   │
│   ├── render/
│   │   ├── RaymarchShader.ts  # Volumetric GLSL raymarching SDF engine
│   │   ├── ParticleSystem.ts  # 120k+ GPU curl noise particle flowfield
│   │   ├── PostProcessor.ts   # HDR bloom, chromatic aberration, ACES tonemapping
│   │   └── RendererManager.ts # WebGL2 context, DPR clamping, resize management
│   │
│   ├── sim/
│   │   ├── FluidSimulator.ts      # 2D Navier-Stokes solver with vorticity confinement
│   │   ├── PhysarumNetwork.ts     # 32k-agent slime mold transport simulation
│   │   ├── ReactionDiffusion.ts   # Gray-Scott Turing pattern generator
│   │   └── BioluminescentFlock.ts # Craig Reynolds 3D boids with fluid coupling
│   │
│   ├── audio/
│   │   ├── AudioSynthesis.ts      # Pure Web Audio procedural drone & chime synth
│   │   └── SynestheticBridge.ts   # Real-time physics-to-audio parameter mapper
│   │
│   ├── interaction/
│   │   ├── ToolManager.ts     # Genesis tool coordinator & 3D ray projection
│   │   ├── CameraControls.ts  # Dual-mode orbit & 6-DOF celestial glide controller
│   │   └── Presets.ts         # 5 deeply distinct preset configurations
│   │
│   └── ui/
│       └── HudOverlay.ts      # Telemetry HUD, preset selector, and tool dock
│
├── ANIMA_DEMO.mp4             # High-definition demo video (H.264)
└── ANIMA_DEMO.webm            # High-definition demo video (VP9)
```

---

## 📜 License

MIT License. Built with pure love for organic continuity, non-Euclidean geometry, and generative acoustics. Zero cubes allowed.
