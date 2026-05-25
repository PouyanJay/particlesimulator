# Particle Simulator → "Particle Lab" — Master Plan

> An ambitious, research-backed roadmap to evolve this app from a ~500-sphere React/Three.js/Rapier
> bouncing-ball demo into a **sophisticated, GPU-accelerated, educational physics laboratory** capable
> of simulating millions of particles across many physics models — with extraordinary visuals and a
> polished, shareable lab UX.
>
> Compiled **2026-05-24** from deep research across four dimensions (similar projects, rendering tech,
> simulation methodologies, framework/architecture). Sources are catalogued in
> [tech-decisions.md](./tech-decisions.md).

---

## The vision in one paragraph

A browser-based "physics lab" where you pick a **simulation mode** (ideal gas, particle-life, N-body
gravity, fluids, flocking, electrostatics, soft bodies…), tune its parameters on a live instrument
panel, and watch up to **millions** of GPU-simulated particles respond in real time — rendered
beautifully with HDR bloom and modern post-processing. Alongside the 3D scene sit **live measurement
tools** (speed histograms vs. the analytic Maxwell–Boltzmann curve, conserved-quantity readouts,
energy/temperature/pressure plots) and a **pedagogy layer** (governing equations, "hold a variable
constant" locks, guided challenges) that turn mesmerizing motion into genuine understanding. Every
scenario is **shareable via URL, recordable to video, and embeddable**.

---

## Headline decisions (the "what & why" at a glance)

| Area | Decision | Rationale (short) |
|---|---|---|
| **Framework** | **Stay on React 18 + React Three Fiber** (do *not* migrate to Svelte/Threlte) | The 60fps hot path is WebGL/physics math, which is framework-agnostic. Migration would rewrite the 1,146-line physics core for gains that don't touch the bottleneck. R3F's first-party ecosystem (Leva, offscreen, r3f-perf, drei, rapier) *is* the lab toolkit. |
| **Renderer** | Upgrade three.js `r149 → r17x+`, R3F `8 → 9`; adopt **WebGPURenderer + TSL** with automatic **WebGL2 fallback** | WebGPU reached baseline across all major browsers (Jan 2026). TSL compiles one shader graph to both WGSL and GLSL. This is the gating prerequisite for everything GPU. |
| **Physics backend** | **Hybrid**: keep **Rapier** for true rigid-body modes (≤ few thousand bodies); build a **custom WebGPU compute** engine for all force-field/particle modes | Rapier's CPU solver caps ~500–5k bodies; force-field models (gravity, particle-life, MD, boids) are massively parallel and map perfectly to GPU compute → 100k–1M+. |
| **Architecture** | **Decouple** the monolithic `PhysicsContainer` into **sim-core (pure TS) / render layer (R3F) / param store (Zustand)**; add a **`SimMode` plugin interface** | Highest-leverage early move. This single refactor — not a framework switch — turns a demo into an extensible lab. |
| **State** | **Zustand** (+ `persist`) + **zundo** (undo/redo); small **XState** machine for sim lifecycle | Kills prop-drilling; readable in `useFrame` without re-renders; clean presets + history. |
| **Controls UI** | **Leva** for parameters + **shadcn/ui (Radix)** for app chrome/modals | "Instrument panel" feel + sophisticated app shell. |
| **Charts** | **uPlot** for live telemetry; **remove recharts** | uPlot is ~4–7× lighter on CPU/RAM at 60fps streaming; SVG charts jank. |
| **Export/Share** | **canvas-record (WebCodecs)** for video/GIF, `toBlob` screenshots, **lz-string hash** deep-links, `/embed` route, CSV/JSON export, PWA | Frame-precise capture; URL-safe shareable scenarios. |
| **Visual "wow"** | HDR float rendering → **selective Bloom** → DoF/SSAO → chromatic aberration + vignette → ACES/AgX tone-mapping → TAA/SMAA | Bloom + HDR + additive blending is ~80% of the visual payoff for a particle sim. |

---

## Phase overview

| Phase | Theme | Outcome |
|---|---|---|
| **0 — Foundation & de-risking** | Upgrades + architecture refactor (no new features) | Modern stack (WebGPU + R3F9 + Zustand), decoupled sim-core/render/store, `SimMode` plugin scaffold, profiling in place. The existing sim still works, now on solid ground. |
| **1 — Rendering leap & visual wow** | GPU-driven particles + post-processing | Existing elastic-gas mode rendered from GPU buffers (Points/Instanced), scaled 500 → 100k+, with HDR bloom, color-by-property, trails. The app *looks* extraordinary. |
| **2 — Simulation engine & first GPU modes** | Shared compute infra + the two highest-wow modes | Spatial-hash grid + GPU sort + integrators + fixed timestep. Ships **Particle-Life** and **N-body gravity**. The app becomes multi-mode. |
| **3 — Educational lab core** | Measurement + pedagogy + cheap reuse modes | **Maxwell–Boltzmann histogram**, conserved-quantity readouts, live equation panel, "hold constant" locks, measurement tools; **MD/Lennard-Jones gas**, **Boids**, **Electrostatics**. The app becomes a *lab*. |
| **4 — Advanced simulations** | High-effort, high-payoff models | **SPH/MLS-MPM fluids** (+ screen-space fluid rendering), **PBD/XPBD** cloth/soft-bodies/granular sand, spring-mass. |
| **5 — Lab platform** | UX, sharing, pedagogy, reach | Leva + shadcn UI overhaul, presets/scenarios, undo/redo, shareable URLs + `/embed`, WebCodecs recording, guided lab challenges, 2D mode, PWA, mobile/accessibility. |
| **6 — Polish & launch** | Content, docs, performance hardening | Scenario gallery, onboarding/tour, perf budgets met across tiers, docs, deploy. |

Full detail per phase: **[roadmap.md](./roadmap.md)**.

---

## The documents in this folder

- **[roadmap.md](./roadmap.md)** — the full phased plan: goals, workstreams, deliverables, success criteria, and risks for each of Phases 0–6, plus cross-cutting concerns and sequencing notes. **Start here for execution.**
- **[simulation-modes.md](./simulation-modes.md)** — catalogue of every simulation mode with its algorithm, what it teaches, scale ceiling, key parameters, difficulty/impact rating, and reusable open-source references.
- **[tech-decisions.md](./tech-decisions.md)** — the architecture & stack decisions with full rationale, the dependency add/remove list, browser-support & fallback strategy, and the consolidated research source list.

---

## How to use this plan

1. Phases are **roughly sequential** but **Phase 0 is a hard prerequisite** for everything (it unblocks WebGPU + the plugin architecture).
2. Within Phases 2–4, individual **modes are independent** — pick by the difficulty/impact ranking in [simulation-modes.md](./simulation-modes.md), not strictly top-to-bottom.
3. Each phase is scoped to be **independently shippable** — the app stays usable at every step.
4. This is a living document. As phases complete, update the status table in [roadmap.md](./roadmap.md).

## Guiding principles

- **Decouple before you extend.** Architecture first; features compound on it.
- **GPU by default, CPU where correctness demands it.** Hybrid, not religious.
- **Every mode earns its place pedagogically.** Mesmerizing *and* instructive.
- **Ship at every phase.** No multi-month dark periods.
- **Graceful degradation.** WebGL2 + reduced counts for the ~30% without WebGPU; mobile tier.
