# Particle Lab — Phased Roadmap

> The full execution plan. Read [README.md](./README.md) first for the vision and headline decisions,
> [tech-decisions.md](./tech-decisions.md) for stack rationale, and [simulation-modes.md](./simulation-modes.md)
> for per-mode detail. Compiled 2026-05-24.

## Status tracker

| Phase | Status | Notes |
|---|---|---|
| 0 — Foundation & de-risking | ✅ Done (2026-05-25) | Decoupled sim-core/state/render/ui, SimMode plugin, Zustand, TDD (73 tests). **three.js→r17x/R3F9/WebGPU upgrade deferred to Phase 1** — not needed for the decoupling; done with browser verification where GPU compute requires it. |
| 1 — Rendering leap & visual wow | ⬜ Not started | **Starts with the deferred renderer upgrade** (three r17x+, R3F 9, WebGPURenderer + WebGL2 fallback) as its first task. |
| 2 — Simulation engine & first GPU modes | ⬜ Not started | |
| 3 — Educational lab core | ⬜ Not started | |
| 4 — Advanced simulations | ⬜ Not started | |
| 5 — Lab platform | ⬜ Not started | |
| 6 — Polish & launch | ⬜ Not started | |

Legend: ⬜ not started · 🟡 in progress · ✅ done

---

## Where we are starting (baseline)

- **Stack:** React 18, Vite 6, TS 5.8, `@react-three/fiber` 8.13, `@react-three/drei` 9.80,
  `@react-three/rapier` 1.1, `three` **0.149** (very old), `chart.js` + `recharts` (redundant), `rc-slider`.
- **Code:** ~2,759 LOC. `src/components/PhysicsContainer.tsx` is **1,146 lines** and entangles physics,
  collision detection, telemetry, and rendering. `src/App.tsx` (478 lines) holds ~20 `useState` hooks
  **prop-drilled** into every child — the main architectural bottleneck.
- **Capability:** one mode (elastic-collision gas in a box), one sphere mesh per particle, ~500-particle
  ceiling, CPU physics via Rapier, heuristic collision detection driving a red-flash effect, speed +
  collision graphs, density warnings.

The current collision detection infers collisions from velocity changes rather than reading Rapier's
contact events — a quirk to retire during the refactor.

---

## Cross-cutting concerns (apply to every phase)

- **Browser support / fallback:** WebGPU ≈ 70% of browsers (May 2026). Always ship a **WebGL2 fallback**
  (three.js `WebGPURenderer` auto-falls-back; TSL compiles to GLSL). Reduce particle counts on fallback.
- **Determinism:** GPU float results aren't bit-identical across vendors — fine for visual/educational use,
  but seed RNG and use fixed timesteps so runs are *reproducible enough* to share via URL.
- **Performance budgets:** define per-tier targets (e.g. desktop 1M @ 60fps points; mid laptop 500k;
  mobile 100k @ 30fps). Keep `r3f-perf`/`stats-gl` visible in dev; verify against budgets each phase.
- **Mobile & accessibility:** every phase keeps the app usable on phones (count caps, touch controls)
  and keyboard-navigable; respect `prefers-reduced-motion`.
- **Ship-ability:** the app must run and deploy at the end of every phase.

---

# Phase 0 — Foundation & de-risking

**Goal:** modernize the stack and decouple the architecture *without changing user-visible features*, so
all later work compounds on a solid base. This is the single highest-leverage phase.

**Why now:** `three@0.149` + R3F 8 cannot run WebGPU/TSL compute; the monolithic `PhysicsContainer` +
prop-drilled `useState` cannot absorb new modes. Both block everything else.

### Workstreams

1. **Dependency upgrade (de-risk first).** — ⏭️ **Deferred to Phase 1** (2026-05-25). The decoupling
   below was achievable on the current stack (sim-core is framework-agnostic), so the major, browser-only
   renderer upgrade was moved to the start of Phase 1 where GPU compute actually needs it, rather than risk
   the freshly-decoupled app on an upgrade that can't be verified headlessly.
   - Bump `three` `0.149 → r17x+` and `@react-three/fiber` `8 → 9` (async `gl` prop for `await renderer.init()`),
     `@react-three/drei`, `@react-three/rapier` to matching versions. Expect breaking changes; do it on a branch.
   - Verify the existing sim still works on the upgraded stack (WebGLRenderer first), then introduce
     `WebGPURenderer` with `forceWebGL` fallback toggle.
2. **State migration to Zustand.**
   - Move the ~20 `App.tsx` `useState` params into a Zustand `paramStore` (with `persist`).
   - Telemetry (speed/collision history) goes in a **separate, non-persisted** store so it never pollutes
     undo/redo or presets.
   - Read params inside `useFrame` via `getState()`/transient subscriptions (no re-renders).
3. **Decouple sim-core / render / store.**
   - Extract a pure-TS **simulation core** owning the Rapier world + particle state (no React).
   - Render layer (R3F) reads positions each frame; **no business logic** in components.
   - Retire the velocity-change collision *heuristic* in favor of reading Rapier contact/collision events.
4. **`SimMode` plugin interface.**
   - Define `interface SimMode { id; label; paramSchema; init(ctx); step(dt); getTelemetry(); dispose(); }`.
   - Re-implement the existing elastic gas as the **first registered mode** behind this interface.
   - Param schema drives auto-generated controls later (Phase 5).
5. **Tooling & hygiene.**
   - Add `r3f-perf` + `stats-gl` (dev). Remove dead debug `console.log`s in `ControlPanel.tsx`.
   - De-duplicate `getContainerSize` (currently in both `App.tsx` and `PhysicsContainer.tsx`).
   - Decide charts: keep telemetry working (uPlot swap happens in Phase 3); flag `recharts` for removal.

### Deliverables
- App on three r17x+/R3F 9, optionally rendering through WebGPU with WebGL2 fallback.
- Zustand stores; zero prop-drilling of sim params.
- `PhysicsContainer` split into sim-core + thin render layer; elastic gas runs as a `SimMode`.
- Profiling overlays in dev.

### Success criteria
- Feature parity with today; no visual/behavioral regressions.
- Switching `forceWebGL` on/off both render correctly.
- Adding a trivial second stub mode requires **no** changes to `App`/render layer (proves the plugin seam).

### Risks & mitigations
- *r149→r17x is a large jump* → upgrade incrementally on a branch, lean on the WebGPU migration guides
  (see tech-decisions sources), keep WebGLRenderer path working before flipping to WebGPU.
- *R3F 8→9 breaking changes* → follow the v9 migration notes; the async renderer init is the main gotcha.

---

# Phase 1 — Rendering leap & visual wow

**Goal:** make the app *look* extraordinary and break the per-mesh particle ceiling by driving rendering
from GPU buffers, even while physics is still (mostly) Rapier.

**Why now:** the per-particle sphere mesh is the rendering bottleneck and the biggest "this looks like a
2015 demo" tell. Fixing rendering first delivers a visible win and sets up GPU compute in Phase 2.

### Workstreams

1. **Buffer-driven particle representation (tiers).**
   - Replace one-mesh-per-particle with a **single draw**: `THREE.Points` / `spriteNodeMaterial` for high
     counts; `InstancedMesh` (matrices fed from a buffer) for the lit "hero" tier (< ~50k).
   - LOD switch by count/distance: sphere → billboard → point.
2. **Scale the existing elastic gas to 100k+.**
   - Even on Rapier-CPU this is limited, so this phase is mainly about the *render path*; true 1M comes
     with GPU compute in Phase 2. Demonstrate buffer rendering with a non-physics particle field if needed.
3. **HDR + post-processing stack ("wow").**
   - HDR float rendering → **selective Bloom** (emissive particles > 1.0) → optional **DoF** → **SSAO**
     (hero tier only) → **chromatic aberration + vignette** → **ACES/AgX tone-mapping** → **TAA/SMAA**.
   - WebGPU path: three.js node-based PostProcessing/RenderPipeline. WebGL fallback: pmndrs `postprocessing`.
4. **Color-by-property & visual encodings.**
   - Color particles by speed / kinetic energy / type / density; velocity→brightness mapping.
   - Optional velocity-vector arrows toggle; **trails/ribbons** with additive blending.
5. **Scene polish.**
   - Better lighting/environment, refined container wireframe, camera framing, subtle motion.

### Deliverables
- Single-draw particle rendering with LOD tiers.
- Full post-processing pipeline with a few presets ("clean", "neon", "soft").
- Color-by-property modes + trails.

### Success criteria
- The elastic gas renders smoothly at far higher counts than 500 (render-bound, not mesh-bound).
- Bloom/tone-mapping visibly elevate the look; effects toggle cleanly on WebGL fallback (possibly reduced).

### Risks & mitigations
- *Post FX cost on mobile* → quality tiers; disable SSAO/DoF/TAA on low-end; respect `prefers-reduced-motion`.
- *Additive blending depth-sort issues* → use `depthWrite:false`, rely on additive for glow rather than sorting.

---

# Phase 2 — Simulation engine & first GPU modes

**Goal:** build the **shared GPU compute infrastructure** once, then ship the two highest-wow,
lowest-difficulty modes on top of it: **Particle-Life** and **N-body gravity**.

**Why now:** these two modes prove the GPU compute path end-to-end and deliver the biggest "holy cow"
moments per unit effort (Particle-Life D3/I5, N-body all-pairs D2/I5). The shared infra they need powers
almost every later mode.

### Workstreams

1. **Shared GPU compute building blocks (build once, reuse everywhere).**
   - Particle state in storage buffers (pos, vel, accel, mass, type, life), **double-buffered (ping-pong)**.
   - **Uniform spatial-hash grid** + **GPU sort** (bitonic or counting-sort + prefix-sum) for neighbor search.
   - **Fixed-timestep accumulator** with substepping; **selectable integrators** (semi-implicit Euler default,
     velocity Verlet for energy-conserving modes).
   - WebGL2 fallback: texture ping-pong (`GPUComputationRenderer`) for the simplest modes only.
2. **Mode: Particle-Life.**
   - N×N **asymmetric** attraction/repulsion matrix between color types; piecewise-linear force with a
     short-range repulsion core; spatial-hash binning. Editable matrix UI + randomize + #types slider.
   - Target ~65k+ particles (WebGPU), per the lisyarus reference.
3. **Mode: N-body gravity (all-pairs).**
   - O(N²) all-pairs on GPU; velocity Verlet. Preset initial conditions (galaxy, bang, swirl, collision,
     three-body). Good to ~10k–50k all-pairs; flag Barnes-Hut as a later stretch for >50k.
4. **Mode switching UX.**
   - Mode selector that swaps the active `SimMode`, resets buffers, and loads mode-appropriate defaults.

### Deliverables
- Reusable compute infra (grid + sort + integrators + fixed step).
- Two new modes live behind the mode selector.
- "Initial conditions" preset launcher for N-body.

### Success criteria
- Particle-Life runs ≥ 50k particles at interactive framerates on a mid GPU; matrix edits visibly change emergent structure.
- N-body forms a recognizable galaxy/orbit from presets; energy stays stable over minutes (Verlet).
- Adding mode #3 reuses the grid/sort/integrators without rebuilding them.

### Risks & mitigations
- *WebGPU atomics only on 32-bit ints* → fixed-point encoding for any scatter/atomicAdd (grid build).
- *O(N²) blow-up* → spatial hashing mandatory above ~50k; document per-mode count ceilings.
- *Fallback gaps* → on WebGL2, cap counts hard and disable modes that need general scatter/atomics.

---

# Phase 3 — Educational lab core

**Goal:** turn "mesmerizing motion" into a genuine **physics lab** with measurement, derived quantities,
and a pedagogy layer — and add the cheap-to-reuse modes that showcase it best.

**Why now:** measurement + pedagogy is what differentiates this from a pretty screensaver, and the
Maxwell–Boltzmann histogram is the single highest-value educational feature. The MD/Lennard-Jones gas is
the best vehicle for it; Boids and Electrostatics reuse Phase-2 kernels almost for free.

### Workstreams

1. **Telemetry overhaul.**
   - Replace recharts/static charts with **uPlot** for 60fps streaming. Add energy-vs-time, P–V–T, and
     per-type population charts alongside the existing speed/collision graphs.
2. **Maxwell–Boltzmann histogram (flagship).**
   - Live speed histogram **overlaid with the analytic Maxwell–Boltzmann curve** — the sim literally
     demonstrates the theory converging. Show light vs. heavy particle distributions separately.
3. **Derived measurements & conserved quantities.**
   - Total momentum & total kinetic energy readouts (flag when collisions are inelastic).
   - Temperature = mean KE, pressure = wall impulse/area, diffusion coefficient, mean-squared-displacement.
4. **Pedagogy layer.**
   - **Live equation panel** (PV=nRT, F=Gm₁m₂/r², v=√…) updating with the sim.
   - **"Hold a variable constant" locks** (freeze T, V, P, or N) to isolate cause/effect (PhET pattern).
   - Concept tooltips / annotated callouts; **"reveal the rules"** toggle showing the micro-rule behind
     emergent macro-behavior.
   - Measurement tools you can drop into the scene (thermometer, pressure gauge, ruler, tracer tag).
5. **New modes (cheap reuse).**
   - **MD / Lennard-Jones gas** — pairwise LJ with cutoff + cell list, velocity Verlet, periodic or walled
     box. Demonstrates ideal gas, Maxwell–Boltzmann, phase transitions, Brownian motion. *Best educational payoff.*
   - **Boids / flocking** — separation/alignment/cohesion over the spatial-hash neighbors; pointer disturbs flock.
   - **Electrostatics** — reuse the N-body kernel with Coulomb (signed-by-charge) force; field-line viz.
   - **Brownian tracer** — many small + one tagged particle; plot MSD vs. time → diffusion coefficient.

### Deliverables
- uPlot telemetry suite; Maxwell–Boltzmann overlay; conserved-quantity + derived-measurement panels.
- Equation panel, "hold constant" locks, in-scene measurement tools.
- MD/LJ gas, Boids, Electrostatics modes.

### Success criteria
- Running the MD gas, the speed histogram visibly converges to the Maxwell–Boltzmann curve.
- Locking volume and adding heat changes pressure/temperature consistently with PV=nRT.
- Telemetry holds 60fps with multiple live charts open.

### Risks & mitigations
- *Measurement accuracy on GPU* → use Verlet + fixed step; validate against analytic results (the histogram is the test).
- *UI clutter* → collapsible measurement docks; per-mode default panel layouts.

---

# Phase 4 — Advanced simulations

**Goal:** the high-effort, high-payoff models that make the lab feel complete and cutting-edge.

**Why now:** these (especially fluids) are the most technically demanding and benefit from a mature
compute + rendering foundation (Phases 0–3). They're also the biggest visual showpieces after Particle-Life.

### Workstreams

1. **Fluids — SPH and MLS-MPM.**
   - **MLS-MPM** (grid-based, no neighbor search, fixed-point `atomicAdd` for P2G) reaches ~100k on iGPU,
     ~300k on mid GPUs. Pair with **Screen-Space Fluid Rendering** (depth + thickness + bilateral blur +
     normal reconstruction + refraction) for liquid surfaces.
   - Provide SPH as an alternative (neighbor-search, ~30k ceiling) for comparison/teaching.
   - Port/reference `matsuoka-601/webgpu-ocean` and `jeantimex/fluid`.
2. **Position-Based Dynamics (PBD/XPBD).**
   - **Cloth** (distance + bending constraints), **soft bodies** (tetrahedral volume constraints), and
     **granular/sand** (XPBI return-mapping). Graph-coloring to parallelize constraint batches on GPU.
3. **Spring-mass systems.**
   - Hooke + damping with symplectic Euler/Verlet; ropes, lattices, simple deformables.
4. **Rigid-body sandbox (Rapier, polished).**
   - Keep Rapier for joints/stacking/CCD at modest counts; add grab-and-throw, barriers, drop-in objects.
   - Upgrade to the Rapier **SIMD** build for the free 2–5× speedup.
5. **Optional stretch: Barnes-Hut N-body** for >50k gravitating bodies (GPU octree — hardest structure).

### Deliverables
- Fluid mode (MLS-MPM + SSFR) and an SPH comparison mode.
- Cloth / soft-body / granular modes via XPBD.
- Polished Rapier rigid-body sandbox.

### Success criteria
- Fluid mode renders a convincing liquid surface at ≥ 50k particles on a mid GPU.
- Cloth/soft-body remain stable (no explosion) across the parameter range.

### Risks & mitigations
- *Fluids are D5* → time-box; ship SSFR incrementally (depth-only blob first, then full refraction).
- *XPBD races* → graph-coloring is essential; start with cloth (best-understood) before soft bodies/sand.

---

# Phase 5 — Lab platform (UX, sharing, pedagogy, reach)

**Goal:** wrap the engine in a polished, shareable, teachable product.

**Why now:** with modes and measurement in place, the remaining value is in *usability, distribution, and
curriculum* — turning a powerful tool into something people actually share and learn from.

### Workstreams

1. **Controls & UI overhaul.**
   - **Leva** auto-generated from each mode's `paramSchema`; **shadcn/ui (Radix)** for app shell, command
     palette, dialogs, preset manager, export modal, tabs. Retire `rc-slider`.
2. **Presets, scenarios & history.**
   - Named presets (Zustand `persist`); JSON scenario = {mode, params, camera, seed}; import/export files.
   - **Undo/redo** via `zundo` (params only, not telemetry); small **XState** machine for
     idle→running→paused→recording→exporting lifecycle.
3. **Sharing & embedding.**
   - **Shareable URLs**: lz-string-compressed param state in the URL **hash**; restore on load.
   - **`/embed` route**: hash-driven, control panel hidden — instant iframes.
4. **Recording & export.**
   - **canvas-record (WebCodecs)** → MP4/WebM/GIF, frame-precise; MediaRecorder fallback. `toBlob`
     screenshots (incl. transparent bg). **CSV/JSON** export of telemetry & scenarios.
5. **Pedagogy & content.**
   - **Guided lab challenges** with checkpoints/questions ("predict what happens if you halve the volume").
   - **Curated scenario menu** per mode (three-body chaos, diffusion demo, MB convergence, galaxy collision).
6. **Reach.**
   - **2D high-performance mode** (ortho `Points`, or PixiJS) as a distinct max-count tier for 2D demos +
     stress tests. **PWA** (`vite-plugin-pwa`) for offline/installable. Mobile touch controls; accessibility pass.
7. **Optional threading.**
   - Run physics in a worker (or `@react-three/offscreen` with Safari fallback) to keep the UI at 60fps
     under heavy load.

### Deliverables
- Leva + shadcn UI; presets/scenarios; undo/redo; shareable URLs + `/embed`; WebCodecs recording; CSV/JSON export.
- Guided challenges + curated scenario menu; PWA; 2D mode.

### Success criteria
- A scenario can be tuned, shared via URL, opened by someone else identically, and embedded in an iframe.
- A run can be recorded to MP4 and telemetry exported to CSV.
- A guided challenge walks a learner through a concept end-to-end.

### Risks & mitigations
- *OffscreenCanvas Safari gaps* → keep main-thread fallback; consider physics-in-worker split instead.
- *URL length* → lz-string hash; cap/seed where state is large (e.g. don't serialize 1M positions — store seed + params).

---

# Phase 6 — Polish & launch

**Goal:** harden, document, and ship.

### Workstreams
- **Performance hardening:** meet per-tier budgets; profile with `r3f-perf`/`stats-gl`/Spector.js; LOD,
  frustum culling, count caps; verify WebGL2 fallback and mobile tiers.
- **Content:** scenario gallery, onboarding tour, per-mode explainer copy, the live demo & README refresh.
- **Docs:** architecture doc, "how to add a SimMode" guide, contribution notes.
- **QA:** cross-browser (Chrome/Safari/Firefox), mobile, reduced-motion, keyboard nav.
- **Deploy:** keep GitHub Pages CI; ensure WebGPU works under the Pages base path; add analytics if desired.

### Success criteria
- Smooth on target hardware tiers; graceful on fallback; documented; deployed; demo-ready.

---

## Sequencing notes & dependencies

- **Phase 0 gates everything.** Don't start GPU modes before the upgrade + decoupling land.
- **Phase 1 and the Phase 2 infra** can overlap once Phase 0 is done (rendering vs. compute are separable).
- **Within Phases 2–4, modes are independent** — order them by the difficulty/impact ranking in
  [simulation-modes.md](./simulation-modes.md), and let user interest steer which ships next.
- **The Maxwell–Boltzmann histogram + MD gas (Phase 3)** is the recommended "first real lab" milestone —
  it's the moment the app stops being a toy.
- **Shared compute infra (Phase 2) is the highest-leverage technical investment** — grid + sort + integrators
  power particle-life, boids, MD, SPH, electrostatics, and the scaled elastic gas.

## A pragmatic "minimum extraordinary" path

If time is limited, this subset already transforms the app:
1. Phase 0 (foundation) — non-negotiable.
2. Phase 1 (buffer rendering + bloom) — instant visual transformation.
3. Phase 2 Particle-Life — the single most "mesmerizing per line of code" mode.
4. Phase 3 MD gas + Maxwell–Boltzmann histogram — the credibility-defining lab feature.
5. Phase 5 shareable URLs + recording — so people can actually share what they make.
