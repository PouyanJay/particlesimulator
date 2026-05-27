# Architecture

Particle Lab is built in four strictly-separated layers. The separation is the point: it's what lets a
new simulation mode drop in without touching the app shell or the renderer.

```
src/
  sim-core/   Pure TypeScript. Owns simulation state & stepping. NO React, NO three.js.
  render/     React Three Fiber. Reads sim state each frame and draws it. No physics/business logic.
  state/      Zustand stores (params, telemetry, presets, UI) + the XState lifecycle.
  ui/         React components (panels, dialogs, charts, command palette). No three.js.
```

A rule of thumb: if a file imports `three`/`@react-three/*`, it belongs in `render/`; if it imports
React, it belongs in `render/`, `state/`, or `ui/` — never `sim-core/`.

## sim-core (pure TS)

Deterministic given `(seed, params)`; this is where most of the test suite lives. Key pieces:

- **`types.ts`** — the `SimMode` plugin contract (`init/step/getTelemetry/getBuffers/dispose`), the
  parameter schema types, `ParticleBuffers`, and `Telemetry`.
- **`registry.ts`** — a `SimModeRegistry`: register a factory, list modes, construct one by id. Adding a
  mode is one registration; the UI/render layers only ever see the generic registry.
- **`modes/`** — one file per simulation (elastic gas, molecular dynamics, N-body, particle life, boids,
  electrostatics, GPU N-body). **`physics/`** — reusable force kernels, the spatial grid, environment
  helpers. **`integrators/`**, **`time/fixedTimestep.ts`** — semi-implicit Euler / velocity Verlet and the
  fixed-step accumulator. **`measure/`** — conserved quantities, Maxwell–Boltzmann, substances.
- **`scenario.ts`** — the serializable unit of save/share: `{ modeId, seed, params, substanceId, camera,
  view }`, with lz-string URL-hash and JSON (de)serialization that validates untrusted input.
- **`scenarios/curated.ts`**, **`challenges/`** — curated gallery data and the guided-challenge model +
  checks (pure; the UI renders them).

## render (R3F)

Reads from `sim-core` and draws; holds no physics. Key pieces:

- **`SimulationCanvas.tsx`** — the `<Canvas>`, lighting, container, a single perspective camera +
  OrbitControls (2D = same camera, top-down, rotation locked), and the `CameraRig`.
- **`simDriver.ts`** — a framework-agnostic loop: load a `Scenario`, advance on a fixed timestep, sample
  telemetry. The testable core of the render layer (no three.js, no React).
- **`ParticleField.tsx`** dispatches by backend: CPU modes → **`CpuParticles.tsx`** (instanced mesh driven
  by a `SimDriver`); `webgpu-compute` → **`gpu/GpuNbody.tsx`** (GPU-resident sim + sprites).
- **`PostFx.tsx`** — mode-aware HDR bloom pipeline. **`worker/`** — the optional physics-in-worker path
  (transferable-buffer protocol + a `SimDriver` client). Bridges (`cameraBridge`, `canvasBridge`) expose
  the live camera/canvas to the UI without prop-drilling.

## state (Zustand + XState)

- **`paramStore.ts`** — the scenario source of truth (mode, seed, params, substance, view), persisted and
  wrapped with **zundo** for undo/redo (tracks the scenario slice only; play/pause is excluded).
  `paramHistoryGroup.ts` coalesces slider drags into one undo step.
- **`telemetryStore.ts`** — transient measured quantities (never persisted, never undoable).
- **`presetStore.ts`**, **`onboardingStore.ts`**, **`uiStore.ts`** (which overlay is open),
  **`lifecycleMachine.ts`** (XState: idle/running/paused/recording/exporting).

`useFrame` reads params via `store.getState()` — never via props — so the hot loop never re-renders React.

## ui

Token-styled components built on shared primitives in `ui/controls/` (`Button`, `Select`, `RangeField`,
`ToggleField`, `Dialog`, `Tabs`, `Tooltip`, `TextField`, `ButtonGroup`, `Kbd`, the `roving` helper). The
design system (tokens, spacing, a11y) is defined in `CLAUDE.md` and `src/styles/tokens.css`. The command
palette, preset manager, share/export/scenario/challenge dialogs, and the welcome tour live here.

## Data flow each frame

```
UI writes params → paramStore ──getState()──▶ SimDriver.load/advance (sim-core) ──getBuffers()──▶
  CpuParticles/GpuNbody draw ; SimDriver.getTelemetry() ──(throttled)──▶ telemetryStore ──▶ charts/readouts
```

Scenario save/share reads `paramStore` + the camera bridge → `scenario.ts` → URL hash / preset / file.
Restoring goes the other way through `render/applyScenario.ts`, which also positions the camera.
