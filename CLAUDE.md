# CLAUDE.md — Particle Lab engineering guide

Authoritative conventions for working in this repo. Read this before writing code. The long-term plan
lives in [.claude/plans/](.claude/plans/) — consult [.claude/plans/roadmap.md](.claude/plans/roadmap.md)
for *what* to build and *when*; this file governs *how* we build it.

> **What this is:** a browser-based, GPU-accelerated educational **physics lab** for particle simulations
> (React + R3F + Three.js WebGPU + a hybrid Rapier/WebGPU-compute physics backend). It is evolving from a
> single-mode bouncing-ball demo into a multi-mode lab. See the plan for the full vision.

---

## Golden rules (non-negotiable)

1. **TDD, always.** Write a failing test first, make it pass, refactor. No production logic without a test
   that would fail without it. See [TDD methodology](#tdd-methodology).
2. **Physics must be verified against ground truth.** Simulation code is correct only when it conserves
   what it should (energy, momentum) and matches analytic results (e.g. Maxwell–Boltzmann). Invoke the
   `physics-verifier` agent for any sim/integrator change.
3. **The UI is enterprise-grade, never "vibe-coded."** Tokens only — no magic numbers, no one-off colors,
   no inline ad-hoc styles. Reuse primitives. See [UI/UX & design system](#uiux--design-system). Invoke the
   `ui-reviewer` agent for any UI change.
4. **Keep the three layers decoupled:** `sim-core` (pure TS) ⟂ render (R3F) ⟂ state (Zustand). Business
   logic never lives in components. See [Architecture](#architecture--conventions).
5. **Type-safe and strict.** No `any`, no `@ts-ignore` without a comment justifying it, no `console.log`
   in committed code.
6. **Ship-able at every step.** `npm run build`, `npm run lint`, and `npm test` must pass before any commit.
7. **Don't reach for a new dependency** when the standard stack ([tech-decisions.md](.claude/plans/tech-decisions.md))
   already covers it. New deps need a one-line justification.

---

## Architecture & conventions

### The three layers (strict separation)

```
sim-core/   Pure TypeScript. Owns simulation state & stepping. NO React, NO three.js imports.
            Deterministic given (seed, params). Unit-testable in isolation (this is where most tests live).
render/     React Three Fiber. Reads sim state each frame via useFrame and draws it. NO physics/business logic.
state/      Zustand stores. paramStore (persisted, undoable) + telemetryStore (transient, never persisted).
ui/         React components (control panel, charts, modals). Reads/writes paramStore. No three.js.
```

- **Components never compute simulation results.** They read from `sim-core` (via refs/buffers) or stores.
- **`useFrame` reads params via `store.getState()`** or transient subscriptions — never via props that
  would trigger re-renders inside the hot loop.
- **Telemetry is a separate store** so high-frequency writes never pollute undo/redo history or presets.

### The `SimMode` plugin contract

Every simulation is a registered `SimMode`. Adding a mode must require **zero** changes to the app shell
or render layer — that seam is the test of the architecture.

```ts
interface SimMode<P extends ParamSchema = ParamSchema> {
  id: string;
  label: string;
  paramSchema: P;                 // drives auto-generated Leva controls + presets + URL state
  backend: 'rapier' | 'webgpu-compute';
  init(ctx: SimContext): void;    // allocate buffers / Rapier world from seed + params
  step(dt: number): void;         // fixed-timestep advance (see integrators below)
  getTelemetry(): Telemetry;      // measured quantities for charts/readouts
  getBuffers(): ParticleBuffers;  // positions/colors for the render layer
  dispose(): void;
}
```

### Determinism & time-stepping

- **Fixed timestep + accumulator** (decoupled from render rate) so runs are reproducible and shareable.
- **Seed all RNG.** A scenario = `{ mode, params, seed, camera }` — never serialize raw particle state.
- **Integrators:** semi-implicit (symplectic) Euler by default; **velocity Verlet** for energy-conserving
  modes (MD, N-body). **Do not use RK4** for conservative/long-running or stiff systems.
- GPU float results aren't bit-identical across vendors — "reproducible enough" for sharing, not bit-exact.

### File & naming conventions

- Files: components `PascalCase.tsx`; modules/hooks `camelCase.ts`; one primary export per file.
- Tests live next to source as `*.test.ts(x)`; E2E under `e2e/`.
- Shaders/compute: TSL node graphs in `sim-core`; keep WGSL/GLSL escape hatches isolated and commented.
- No barrel files that obscure dependencies across the layer boundary.

---

## Development workflow

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build  — must pass before commit
npm run lint       # eslint — must pass before commit
npm test           # Vitest (unit + component) — must pass before commit
npm run test:e2e   # Playwright (added with the TDD scaffolding skill)
```

The loop for any change: **failing test → minimal code to pass → refactor under green → lint/build → review
agent**. Use the `tdd` skill to scaffold tests and the relevant reviewer agent before considering work done.

---

## TDD methodology

We practice test-driven development. The test is written **before** the implementation and must fail for
the right reason first (red), then pass (green), then we refactor with the test as a safety net.

### Test pyramid

| Layer | Tool | What it covers |
|---|---|---|
| **Unit** (most tests) | Vitest | `sim-core` math: integrators, force kernels, spatial hashing, neighbor search, conservation, param/seed determinism, store logic, pure utils. |
| **Component** | Vitest + React Testing Library | UI behavior: controls update the store, panels render states, accessibility roles/labels, keyboard interaction. Test behavior, not implementation. |
| **E2E / visual** | Playwright | Critical flows (pick mode → tune → run → share URL → restore), and visual-regression snapshots of key screens to guard the design system. |

### Physics is tested as invariants, not snapshots

Simulation correctness = laws hold, not "pixels match." Examples of required assertions:
- **Conservation:** elastic collisions conserve total momentum and kinetic energy within tolerance.
- **Analytic convergence:** the MD gas's speed distribution converges to the Maxwell–Boltzmann curve
  (statistical test against the analytic PDF) — this *is* the acceptance test for the gas mode.
- **Integrator order/stability:** velocity Verlet conserves energy over N steps within bounded drift;
  verify convergence order on a known system (e.g. harmonic oscillator).
- **Determinism:** same `(seed, params)` ⇒ identical `sim-core` trajectory (CPU path) bit-for-bit.
- **Neighbor search:** spatial-hash results equal brute-force O(N²) results on small N.

The `physics-verifier` agent owns reviewing these. New sim modes are not "done" until their invariants are
encoded as tests.

### Rules

- Every bug fix starts with a regression test that reproduces it.
- A PR/commit that adds behavior adds tests; coverage of `sim-core` should stay high (target ≥ 90% lines).
- **GPU caveat:** compute-shader output is hard to unit-test headlessly. Strategy: keep a **reference CPU
  implementation** of each kernel in `sim-core`, test *that* exhaustively, and assert the GPU path matches
  the CPU path on small inputs (tolerance for float differences). Pure math stays CPU-testable.
- Don't test framework/library internals; test our logic and our contracts.

---

## UI/UX & design system

**Design language: Refined dark technical** (the Linear / Vercel / Stripe-dark register). Calm, spacious,
precise, restrained. One accent color used sparingly. It must read as a professional instrument, not a demo.

### Anti-"vibe-coded" rules (these are how we avoid looking amateur)

- **No magic numbers.** Every color, space, radius, duration, font-size comes from a **token**. If a value
  isn't in the token set, add it to the set deliberately — don't inline it.
- **No one-off components.** Build from shared primitives (`Button`, `Slider`, `Panel`, `Field`, `Tabs`,
  `Dialog`, `Tooltip`, `Select`). A second use of a pattern means extract a component.
- **Consistency over novelty.** Same control = same look everywhere. No per-screen visual experiments.
- **Restraint.** No gratuitous gradients, glows, or animations. Motion is functional and subtle. (The
  current glassy gradient look is being retired.)
- **Alignment & rhythm.** Everything sits on the 4px spacing grid and a consistent type scale. Optical
  alignment matters; ragged spacing is the #1 "vibe-coded" tell.
- **States are complete.** Every interactive element defines default / hover / active / focus-visible /
  disabled / loading, and every data view defines empty / loading / error.

### Design tokens (single source of truth — define as CSS variables / a TS token module)

```
Color — surfaces (dark)
  --bg-base       #0B0E14   app background
  --bg-surface    #12161F   panels
  --bg-elevated   #1A1F2B   popovers, modals, raised controls
  --border        #232A37   hairline separators (1px)
  --border-strong #313A4B   emphasized borders / inputs

Color — text
  --text-primary    #E6EAF2
  --text-secondary  #9BA6B7
  --text-muted      #6B7588
  --text-on-accent  #0B0E14

Color — accent (use sparingly: primary action, active state, focus ring, key data series)
  --accent         #6366F1   (indigo)  | hover --accent-hover #7C7FF2 | subtle bg --accent-subtle #6366F11A
Color — semantic
  --success #34D399   --warning #FBBF24   --danger #F87171   --info #60A5FA
Data-viz series: a fixed, color-blind-safe categorical ramp (define once; reuse for all charts/particle types).

Spacing (4px base):  4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
Radius:  sm 6 · md 8 · lg 12 · full 9999
Elevation: prefer 1px borders + faint shadow over heavy drop-shadows
  --shadow-1 0 1px 2px rgba(0,0,0,.4)   --shadow-2 0 4px 16px rgba(0,0,0,.35)

Typography
  UI font:   Inter / system-ui sans      Data/numbers: ui-monospace, "JetBrains Mono"
  Sizes (px/line):  12/16 · 13/18 · 14/20 (base) · 16/24 · 20/28 · 24/32 · 32/40
  Weights: 400 body · 500 labels/UI · 600 headings. Avoid 700+ except rare emphasis.
  Numeric readouts use the mono font + tabular figures so values don't jitter.

Motion
  Durations: fast 120ms · base 200ms · slow 320ms     Easing: cubic-bezier(0.4, 0, 0.2, 1)
  Respect prefers-reduced-motion: reduce — disable non-essential transitions/animation.
```

### Layout

- A consistent app frame: top bar (brand, mode selector, global actions) · left instrument panel
  (parameters) · center canvas · dockable telemetry/measurement panels. Panels are collapsible and
  resizable, never overlapping content.
- Density is purposeful: parameters are scannable, grouped, and labeled with units; numeric values are
  right-aligned mono.

### Accessibility (WCAG 2.2 AA minimum)

- Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI boundaries). Verify accent-on-surface combos.
- Full keyboard operability; visible `:focus-visible` ring (use the accent). Logical tab order.
- Semantic HTML / ARIA via Radix primitives; label every control and chart; don't encode meaning by color
  alone (pair with shape/label).
- Honor `prefers-reduced-motion` and `prefers-color-scheme` where applicable.

### Components

- **Leva** auto-generates parameter controls from each mode's `paramSchema` — themed to the tokens above.
- **shadcn/ui (Radix)** provides the app chrome (dialogs, tabs, command palette, selects, tooltips).
  Restyle to the tokens; never ship default shadcn colors.
- Charts (**uPlot**) use the token palette and the categorical data-viz ramp.

The `ui-reviewer` agent enforces all of the above on every UI change.

---

## Code quality standards

- **TypeScript strict**; no `any` (use `unknown` + narrowing). Public functions get explicit return types.
- **Naming:** intention-revealing; no abbreviations that aren't domain-standard (`dt`, `vel` are fine).
- **Functions small and single-purpose;** extract rather than nest deeply. Comment the *why*, not the *what*.
- **No dead code, commented-out blocks, or debug logging** in commits (remove the existing
  `console.log`s in `ControlPanel.tsx` when touched).
- **Error handling is explicit;** no silent catches that hide bugs (the current swallow-all `try/catch` in
  the frame loop is a known anti-pattern to fix during the refactor).
- **DRY across the layer boundary** (e.g. `getContainerSize` is currently duplicated — keep one source).

---

## Performance budgets

Target and verify with `r3f-perf` / `stats-gl` (dev) per render tier:

| Tier | Target |
|---|---|
| Desktop (discrete GPU) | ≥ 1M particles @ 60fps (points), 60fps UI |
| Mid laptop (integrated) | ≥ 500k @ 60fps; fluids ≥ 50k |
| Mobile | ≥ 100k @ 30fps; reduced post-FX |
| WebGL2 fallback | functional with hard count caps; no crash |

Hot-loop discipline: no per-frame allocations, no per-particle JS objects, keep state on the GPU, never
re-render React from the sim loop. Profile before optimizing; the `webgpu-shader-specialist` agent reviews
compute-path performance.

---

## Tooling: agents & skills (in `.claude/`)

Invoke the right specialist; don't do their job ad hoc.

| When you are… | Use |
|---|---|
| Changing simulation/physics/integrator/kernel code | **`physics-verifier`** agent — validates conservation & analytic correctness, reviews invariant tests |
| Touching any UI / styling / component | **`ui-reviewer`** agent — enforces this design system, reuse, and a11y |
| Writing/reviewing WebGPU/TSL compute, spatial hashing, buffers, fallback | **`webgpu-shader-specialist`** agent |
| Finishing any change | **`code-reviewer`** agent — general quality/architecture/TDD-adherence review |
| Setting up or adding tests | **`tdd`** skill — scaffolds Vitest/RTL/Playwright and the red-green-refactor flow |
| Confirming a change actually works in the app | built-in `verify` skill |
| Simplifying / de-duplicating after green | built-in `simplify` skill |

---

## Reference

- Plan & phases: [.claude/plans/roadmap.md](.claude/plans/roadmap.md)
- Simulation modes: [.claude/plans/simulation-modes.md](.claude/plans/simulation-modes.md)
- Stack rationale & sources: [.claude/plans/tech-decisions.md](.claude/plans/tech-decisions.md)
