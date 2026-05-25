# Technical Decisions & Research Appendix

> The architecture and stack decisions behind the [roadmap](./roadmap.md), with rationale, the dependency
> add/remove list, the browser-support/fallback strategy, and the consolidated research sources.
> Compiled 2026-05-24 from four parallel research streams.

---

## 1. Framework — stay on React + React Three Fiber

**Decision:** keep React 18 + R3F. Do **not** migrate to Svelte 5/Threlte, SolidJS, or Vue.

**Rationale:**
- **The 60fps hot path is framework-agnostic.** R3F's reconciler runs *outside* the animation loop;
  `useFrame` executes directly inside `requestAnimationFrame`, identical to vanilla three.js. React only
  does work when props change. So R3F is *not* the bottleneck — the per-frame physics/collision math is.
  Svelte would not make the simulation loop faster.
- **Migration cost is high, payoff low.** ~Half the codebase is three.js/Rapier logic shaped as R3F
  components (the 1,146-line `PhysicsContainer`). A framework switch rewrites that, plus the drei
  integrations, for gains that don't touch the WebGL/physics hot path. three.js itself dominates the
  bundle in both worlds, diluting Svelte's small-framework advantage.
- **R3F's first-party ecosystem *is* the lab toolkit:** Leva, `@react-three/offscreen`, `r3f-perf`, drei,
  `@react-three/rapier`, `@react-three/postprocessing` — all pmndrs, all the features we want.
- **The gains we're actually after** (decoupled architecture, presets, undo/redo, telemetry, export) are
  **framework-independent** and fully achievable in React. Where Svelte's fine-grained reactivity *would*
  have helped (avoiding prop-drill re-renders) is solved by adopting a proper state library (Zustand).

*Honest caveat:* if starting from zero with a Svelte preference, **Threlte 8** is a defensible, mature
choice (it ships `@threlte/rapier`, `@threlte/extras`, `@threlte/xr`). Given an existing R3F app, migration
is not worth it. SolidJS's `solid-three` is **stale (~3 yrs)** and not production-ready — ruled out.

---

## 2. Renderer — three.js WebGPURenderer + TSL, WebGL2 fallback

**Decision:** upgrade `three` `0.149 → r17x+` and R3F `8 → 9`; render through **`WebGPURenderer`**
(`import { WebGPURenderer } from 'three/webgpu'`) with **automatic WebGL2 fallback**; author shaders/compute
in **TSL** (Three.js Shading Language).

**Rationale:**
- **WebGPU is production-ready (May 2026):** baseline across all major browsers since Jan 2026 — Chrome/Edge
  (since 113), Chrome Android, Safari (macOS Tahoe 26 / iOS 26), Firefox (Windows 141, macOS ARM 145).
  ~70% of browsers; reports cite ~15× compute gains over WebGL2. WebGPU's real compute shaders + storage
  buffers + `atomicAdd` are what make million-particle physics feasible in-browser.
- **TSL writes once, runs everywhere:** a JS node graph that lowers to **WGSL** (WebGPU) or **GLSL**
  (WebGL2) at compile time — no dual shader codebase. `WebGPURenderer` auto-falls-back to WebGL2.
- **r149 is the gating dependency.** WebGPU/TSL need r171+; R3F v9 adds the async `gl` prop for
  `await renderer.init()`. This upgrade unblocks the entire GPU path.

### Particle representation tiers (by count)

| Tier | Count | Representation | Notes |
|---|---|---|---|
| Hero / rigid | < 50k | `InstancedMesh` lit spheres | Shadows, SSAO; matrices fed from a GPU buffer |
| Standard 3D | 50k – 1M | `Points` / `spriteNodeMaterial` billboards | Additive blending, soft particles, velocity stretch |
| Massive 3D | 1M – 10M+ | GPU point sprites, buffers only | Pure compute→render, no per-particle CPU work |
| Fluid | up to ~100k | MLS-MPM compute + **Screen-Space Fluid Rendering** | Depth/thickness/normal-reconstruction pipeline |
| 2D | up to ~1M+ | Ortho `Points` (or PixiJS) | Max-count stress/showcase + 2D physics |

### Effect stack ("wow" factor)
HDR float rendering → **selective Bloom** (emissive particles > 1.0) → optional **Depth of Field** →
**SSAO** (hero tier only) → **Chromatic Aberration + Vignette** → **ACES/AgX tone-mapping** + color grading
→ **TAA/SMAA**. Bloom + HDR + additive blending is ~80% of the payoff. WebGPU: node-based
PostProcessing/RenderPipeline. WebGL fallback: pmndrs `postprocessing` / `@react-three/postprocessing`.

---

## 3. Physics backend — hybrid (Rapier + custom WebGPU compute)

**Decision:** keep **Rapier** for true rigid-body modes (≤ a few thousand bodies); build a **custom WebGPU
compute** engine (via WebGPURenderer + TSL, raw WGSL where needed) for all force-field/particle modes.
Provide a **WebGL2 texture-ping-pong fallback** for the simplest modes only.

**Rationale:**
- **Rapier's CPU solver caps ~500–5k bodies.** It's best-in-class for *correct contact resolution,
  friction, stacking, joints, CCD, determinism* — keep it where that matters. (Upgrade to the
  `@dimforge/rapier3d-simd` build for a free 2–5× speedup.)
- **Force-field models are massively parallel** (gravity, particle-life, MD, boids, electrostatics, SPH) and
  map perfectly to GPU compute → 100k–1M+; they map *poorly* to a CPU constraint solver. The current
  ~500-sphere ceiling is exactly the Rapier-on-CPU wall.
- **Demonstrated WebGPU ceilings** (single laptop GPU, cheap per-particle physics): desktop ~1M @ 60fps,
  mid laptop ~500k, mobile ~100k @ 30fps. O(N²) force models drop this 1–2 orders without acceleration structures.

### Shared compute infrastructure (build once, reuse everywhere)
- **Uniform spatial-hash grid** + **GPU sort** (bitonic, or counting-sort + prefix-sum) for neighbor search.
- **Fixed-timestep accumulator** (+ substepping) decoupled from render rate for reproducibility.
- **Integrators:** semi-implicit (symplectic) **Euler** default; **velocity Verlet** for MD/N-body energy
  conservation. **Avoid RK4** for conservative/long-running or stiff systems (not symplectic → energy drift,
  and less stable than semi-implicit Euler for springs).
- **Double-buffered (ping-pong) state** in storage buffers. *Caveat:* WebGPU atomics only on 32-bit ints →
  fixed-point encoding for any scatter/`atomicAdd` (grid build, MLS-MPM P2G).

---

## 4. State management — Zustand + zundo (+ XState for lifecycle)

**Decision:** **Zustand** as the param store (with `persist`); **zundo** for undo/redo; a small **XState**
machine only for sim lifecycle (idle→running→paused→recording→exporting). Keep **telemetry in a separate,
non-persisted, non-undoable** store.

**Rationale:** Zustand is pmndrs (pairs with R3F), tiny, and — crucially — readable inside `useFrame` via
`getState()`/transient subscriptions **without triggering re-renders**, exactly right for a sim loop that
must not re-render the UI. `zundo` is a <700B temporal middleware (use a shallow/meaningful-change equality
so per-frame telemetry doesn't create history). Presets = named serializable slices persisted to
localStorage. *Alternative:* **Jotai** if per-parameter URL deep-linking via `atomWithHash` is preferred.
This replaces the current prop-drilling of ~20 `useState` hooks — the main architectural bottleneck.

---

## 5. Controls UI — Leva + shadcn/ui (Radix)

**Decision:** **Leva** for the live parameter "instrument panel" (auto-generated per mode from the
`SimMode` `paramSchema`), **shadcn/ui (Radix)** for app chrome (dialogs, command palette, preset manager,
export modal, tabs). Retire `rc-slider`. **Avoid dat.GUI** (unmaintained); Tweakpane is the solid #2.

**Rationale:** Leva is React-first, pairs natively with R3F, supports folders/nested groups, custom
plugins, theming, multiple panels, and built-in monitor graphs — the closest "lab instrument" feel for the
least code, wired straight into Zustand. shadcn/Radix gives accessible, owned components for the
sophisticated app shell Leva alone can't provide.

---

## 6. Charts — uPlot (remove recharts)

**Decision:** **uPlot** for all live telemetry; **remove `recharts`**; keep `chart.js` only if wanted for
static summary charts; `visx` for bespoke scientific views.

**Rationale:** uPlot is canvas-based and purpose-built for streaming time series — ~10% CPU / 12MB for
3,600 points @ 60fps, vs Chart.js ~40%/77MB and recharts (SVG) janking on thousands of DOM nodes. The
current 500ms / 100-point throttle is the right instinct; uPlot can go to true 60fps if desired.

---

## 7. Export / sharing — WebCodecs + lz-string hash

**Decision:** **canvas-record (WebCodecs)** for video/GIF (MediaRecorder fallback); native `toBlob` for
screenshots (incl. transparent bg); **CSV/JSON** export of telemetry & scenarios; **lz-string-compressed
state in the URL hash** for shareable links + an **`/embed`** route.

**Rationale:** WebCodecs encodes up to ~10× realtime with hardware acceleration and **frame-precise timing**
(MediaRecorder gives no frame control, mostly WebM) — ideal for smooth, deterministic sim recordings. URL
**hash** (not query) keeps state client-side and allows longer payloads; lz-string `compressToEncodedURIComponent`
is URI-safe. **Don't serialize 1M positions** — store **seed + params + mode + camera** and regenerate.

---

## 8. App architecture — decouple + plugin modes

**Decision:** split the monolithic `PhysicsContainer` into **(a) sim-core (pure TS)**, **(b) render layer
(R3F, no business logic)**, **(c) param store (Zustand)**; define a **`SimMode` plugin interface** and
register modes in a map; optionally run physics in a **Web Worker** (or `@react-three/offscreen` with a
Safari fallback); add **`vite-plugin-pwa`**.

**Rationale:** decoupling is the prerequisite for presets, workers, multiple modes, and everything else —
the single highest-leverage refactor, and what turns a demo into an extensible lab. A `SimMode` interface
(`init/step/getTelemetry/paramSchema/dispose`) lets each mode auto-generate its Leva controls and swap
cleanly. Physics-in-worker isolates the CPU-heavy part without the OffscreenCanvas+WebGL Safari gaps.

---

## 9. Profiling

`r3f-perf` + `stats-gl` always-on in dev (FPS/MS/MB, draw calls, GPU timing); **Spector.js** browser
extension for deep per-frame draw-call/shader inspection when optimizing; lean on `renderer.info`.

---

## 10. Dependency changes

**Add:** `three@r17x+`/`@react-three/fiber@9` (upgrade), `zustand`, `zundo`, (opt) `xstate`,
`leva`, `uplot` (+ `uplot-react`), shadcn/ui + Radix primitives, `@react-three/postprocessing` (WebGL path),
`canvas-record`, `lz-string`, `r3f-perf`, `stats-gl`, `vite-plugin-pwa`; (opt) `@dimforge/rapier3d-simd`,
`@react-three/offscreen`, `pixi.js` (2D mode).

**Remove:** `recharts`, `rc-slider` + `@types/react-slider` (replaced by Leva), redundant chart lib once
uPlot lands.

**Keep:** `react`, `@react-three/fiber`/`drei` (upgraded), `@react-three/rapier` (rigid-body modes), `vite`.

---

## 11. Known cleanups in the current code (do during Phase 0)

- Remove dead debug `console.log`s in `src/components/ControlPanel.tsx` (fire every render).
- De-duplicate `getContainerSize` (in both `src/App.tsx` and `src/components/PhysicsContainer.tsx`).
- Retire the velocity-change collision **heuristic** in `PhysicsContainer.tsx` in favor of Rapier
  contact/collision events.
- Migrate the ~20 `useState` params in `src/App.tsx` into Zustand (kills prop-drilling).
- `three@0.149` + R3F 8 are well behind current — upgrade alongside the refactor.

---

## Research sources

### Similar projects & feature inspiration
- PhET — [Gas Properties](https://phet.colorado.edu/en/simulations/gas-properties), [PhET](https://phet.colorado.edu/)
- [Falstad applets](https://www.falstad.com/mathphysics.html) · [oPhysics](https://ophysics.com/) · [Desmos](https://www.desmos.com/)
- Particle Life — [Ventrella Clusters](https://www.ventrella.com/Clusters/) · [Tom Mohr app](https://github.com/tom-mohr/particle-life-app) · [lisyarus WebGPU](https://lisyarus.github.io/blog/posts/particle-life-simulation-in-browser-using-webgpu.html)
- [Lenia paper](https://arxiv.org/abs/1812.05433) · [Lenia web](https://wartets.github.io/Lenia-Web/)
- Fluids/sandbox — [WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) · [Sandspiel](https://sandspiel.club) ([making-of](https://maxbittker.com/making-sandspiel/)) · [The Powder Toy](https://powdertoy.co.uk/)
- N-body — [JS_ParticleSystem (1M)](https://github.com/DrA1ex/JS_ParticleSystem) · [GPU Gems N-body](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-31-fast-n-body-simulation-cuda) · [Gravity Simulator](https://gravitysimulator.org/)
- MD/gas — [Maxwell-Boltzmann demo](https://github.com/rafael-fuente/Ideal-Gas-Simulation-To-Verify-Maxwell-Boltzmann-distribution) · [Simulating Ideal Gas (PDF)](https://jeffjar.me/files/simulating-ideal-gas.pdf) · [Schroeder Interactive MD](https://arxiv.org/pdf/1502.06169) · [Brownian motion](https://en.wikipedia.org/wiki/Brownian_motion)
- Showcases — [three.js webgpu_compute_particles](https://threejs.org/examples/webgpu_compute_particles.html) · [webgpu_compute_birds](https://threejs.org/examples/webgpu_compute_birds.html) · [Codrops dreamy GPGPU](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/) · [Wawa Sensei TSL GPGPU](https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu)

### Rendering / visualization
- [web.dev WebGPU baseline](https://web.dev/blog/webgpu-supported-major-browsers) · [caniuse WebGPU](https://caniuse.com/webgpu) · [gpuweb Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- [utsubo Three.js 2026](https://www.utsubo.com/blog/threejs-2026-what-changed) · [WebGPU migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) · [100 perf tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Maxime Heckel — Field Guide to TSL & WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/) · [Three.js Roadmap: WebGPU compute](https://threejsroadmap.com/blog/introduction-to-webgpu-compute-shaders) · [post-processing 2026](https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026)
- [GPUComputationRenderer docs](https://threejs.org/docs/pages/GPUComputationRenderer.html) · [GPGPU Galaxy 2M](https://discourse.threejs.org/t/gpgpu-galaxy-particles/88937)
- [Babylon GPU Particles](https://doc.babylonjs.com/features/featuresDeepDive/particles/particle_system/gpu_particles/) · [PixiJS v8 ParticleContainer](https://pixijs.com/blog/particlecontainer-v8) · [deck.gl performance](https://deck.gl/docs/developer-guide/performance)
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) · [react-postprocessing](https://react-postprocessing.docs.pmnd.rs/)
- [Codrops WebGPU fluids (SSFR/MLS-MPM)](https://tympanus.net/codrops/2025/02/26/webgpu-fluid-simulations-high-performance-real-time-rendering/) · [Evil Martians OffscreenCanvas](https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers)

### Physics simulation methodologies & engines
- [Dimforge 2025 review](https://dimforge.com/blog/2026/01/09/the-year-2025-in-dimforge/) · [rapier.rs](https://rapier.rs/) · [Jolt](https://github.com/jrouwe/JoltPhysics) · [cannon-es](https://github.com/pmndrs/cannon-es) · [Web Game Dev physics](https://www.webgamedev.com/physics)
- [WebGPU 1M particles](https://markaicode.com/webgpu-physics-simulation-1m-particles/) · [webgpu-ocean (MLS-MPM/SPH/SSFR)](https://github.com/matsuoka-601/webgpu-ocean) · [jeantimex/fluid](https://github.com/jeantimex/fluid)
- [webgpu-compute-exploration (MIT, multi-sim)](https://github.com/scttfrdmn/webgpu-compute-exploration) · [BoidsWebGPU](https://github.com/jtsorlinis/BoidsWebGPU) · [WebGPU Samples computeBoids](https://webgpu.github.io/webgpu-samples/samples/computeBoids/)
- [WebGPU Samples bitonicSort](https://webgpu.github.io/webgpu-samples/?sample=bitonicSort) · [three.js webgpu_compute_sort_bitonic](https://threejs.org/examples/webgpu_compute_sort_bitonic.html) · [fixed-radius NN (arXiv)](https://arxiv.org/pdf/1805.04911)
- [Barnes–Hut](https://en.wikipedia.org/wiki/Barnes%E2%80%93Hut_simulation) · [bneukom/gpu-nbody](https://github.com/bneukom/gpu-nbody) · [Gaffer integration basics](https://gafferongames.com/post/integration_basics/) · [Verlet](https://en.wikipedia.org/wiki/Verlet_integration)
- [XPBD overview](https://www.emergentmind.com/topics/extended-position-based-dynamics-xpbd) · [webgpu-crowd-simulation (PBD)](https://github.com/wayne-wu/webgpu-crowd-simulation) · [GPU_Soft_Body_Physics](https://github.com/WilKam01/GPU_Soft_Body_Physics)

### Frameworks & architecture
- [R3F docs](https://r3f.docs.pmnd.rs/getting-started/introduction) · [R3F advantages/disadvantages (forum)](https://discourse.threejs.org/t/advantages-and-disadvantages-of-react-three-fiber/49160) · [SvelteKit vs React three.js (forum)](https://discourse.threejs.org/t/sveltekit-vs-react-performance-for-three-js-a-review-thourgh-my-new-two-web-pages/76482)
- [Threlte features](https://threlte.vercel.app/docs/features) · [Svelte vs React 2026](https://strapi.io/blog/svelte-vs-react-comparison) · [solid-three](https://github.com/solidjs-community/solid-three)
- [Zustand/Jotai/Valtio guide](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025) · [zundo](https://github.com/charkour/zundo) · [Jotai atomWithHash deep-links](https://www.sematic.dev/blog/implementing-deep-links-in-react-with-atoms)
- [Leva](https://github.com/pmndrs/leva) · [npmtrends dat.gui/leva/tweakpane](https://npmtrends.com/dat.gui-vs-leva-vs-tweakpane)
- [uPlot](https://github.com/leeoniya/uPlot) · [charts comparison 2026](https://www.pkgpulse.com/guides/recharts-vs-chartjs-vs-nivo-vs-visx-react-charting-2026) · [Chart.js performance](https://www.chartjs.org/docs/latest/general/performance.html)
- [canvas-record (WebCodecs)](https://github.com/dmnsgn/canvas-record) · [WebCodecs canvas→MP4](https://devtails.xyz/adam/how-to-save-html-canvas-to-mp4-using-web-codecs-api) · [lz-string URL encoding](https://garrett-bodley.medium.com/encoding-data-inside-of-a-url-query-string-f286b7e20465)
- [@react-three/offscreen](https://github.com/pmndrs/react-three-offscreen) · [r3f-perf](https://github.com/utsuboco/r3f-perf) · [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
