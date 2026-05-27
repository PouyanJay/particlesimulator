# How to add a simulation mode

A simulation is a `SimMode` plugin. Adding one is **one registration line** — no changes to the app
shell, the control panel, or the render layer (that seam is the architectural test). This guide walks
through a CPU-backed mode; GPU-resident modes are noted at the end.

## 1. Write a failing test first (TDD)

Modes live in `src/sim-core/modes/`, tested next to the source. Start with the invariants the mode must
satisfy — that's the acceptance criterion, not pixels. Examples:

- Determinism: same `(seed, params)` ⇒ identical trajectory.
- Conservation: elastic collisions conserve momentum/energy within tolerance.
- Analytic convergence: a gas's speed distribution approaches Maxwell–Boltzmann.
- Containment/stability: positions stay finite and inside the box over a long run.

```ts
// src/sim-core/modes/myMode.test.ts
import { describe, it, expect } from 'vitest'
import { createMyMode } from './myMode'

describe('my mode', () => {
  it('is deterministic for a fixed seed', () => {
    const a = createMyMode(); a.init({ seed: 1, params: defaultsFor(a) })
    const b = createMyMode(); b.init({ seed: 1, params: defaultsFor(b) })
    a.step(1 / 90); b.step(1 / 90)
    expect(a.getBuffers().positions).toEqual(b.getBuffers().positions)
  })
})
```

## 2. Implement the `SimMode`

```ts
// src/sim-core/modes/myMode.ts
import { countParam, containerParam, displaySizeParam } from '../params/common'
import type { ParamValues, ParticleBuffers, SimContext, SimMode, Telemetry } from '../types'

// The schema drives the auto-generated control panel, presets, and URL state. `group: 'scene'`
// params (count/container/size) render under "Scene"; everything else under "Dynamics".
export const myModeSchema = {
  particleCount: countParam({ label: 'Particle Count', default: 500, min: 10, max: 20000, step: 10 }),
  containerSize: containerParam({ label: 'Container Size', default: 4, min: 2, max: 10 }),
  particleRadius: displaySizeParam({ label: 'Particle Size', default: 0.05, min: 0.02, max: 0.15 }),
  myForce: { type: 'number', label: 'My Force', default: 1, min: 0, max: 5, step: 0.1 },
} as const

export function createMyMode(): SimMode<typeof myModeSchema> {
  let positions = new Float32Array(0)
  // ...own mutable state here...

  function init(ctx: SimContext<typeof myModeSchema>): void {
    // Seed all RNG from ctx.seed; allocate buffers from ctx.params. Reproducible.
  }
  function step(dt: number): void {
    // Advance by one fixed dt. Use sim-core/physics + integrators; no React/three here.
  }
  function getBuffers(): ParticleBuffers {
    // xyz-interleaved positions (length 3*count); optional velocities/types/colors; radius.
    return { count: positions.length / 3, positions, radius: 0.05 }
  }
  function getTelemetry(): Telemetry {
    return { particleCount: positions.length / 3, averageSpeed: 0, kineticEnergy: 0 }
  }
  function dispose(): void {}

  return { id: 'my-mode', label: 'My Mode', backend: 'cpu', paramSchema: myModeSchema, init, step, getBuffers, getTelemetry, dispose }
}
```

Reuse existing building blocks rather than reinventing: `physics/spatialGrid` (neighbour search),
`physics/environment` (`reflectInBox`, `applyGravity`, `thermostatRescale`), `integrators/`, and
`params/common` for the universal Scene params.

## 3. Register it

```ts
// src/state/simRegistry.ts
import { createMyMode } from '../sim-core/modes/myMode'
simRegistry.register(createMyMode)
```

That's it for wiring — the mode now appears in the selector, gets an auto-generated control panel, and
is shareable/persistable. Bump `version` in `paramStore.ts` if you change an existing mode's schema so
stale persisted params are discarded.

## 4. Add the trimmings

- **Explainer copy** — add an entry in `src/ui/modeExplainers.ts` (a test enforces every registered mode
  has one).
- **Curated scenarios** — optionally add to `src/sim-core/scenarios/curated.ts` (validated against the
  schema by test).
- **Challenges** — optionally add a guided challenge in `src/sim-core/challenges/library.ts`.

## 5. Verify

`npm test`, `npm run lint`, `npm run build` must pass. For any physics/integrator/kernel change, validate
conservation and analytic convergence (the `physics-verifier` agent owns this). UI/GPU changes are
browser-verified (`npm run dev`).

## GPU-resident modes

Set `backend: 'webgpu-compute'`. The CPU `SimMode` then carries the param schema + telemetry, while the
actual simulation/rendering runs in a dedicated R3F component under `src/render/gpu/` (see `GpuNbody.tsx`
/ `nbodyCompute.ts`) dispatched by `ParticleField`. Keep a CPU reference of each kernel in `sim-core` and
assert the GPU path matches it on small inputs.
