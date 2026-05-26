import { defaultParamValues } from '../paramSchema'
import type { ParamSchema, ParamValue } from '../types'
import type { Scenario } from '../scenario'
import { elasticGasSchema } from '../modes/elasticGas'
import { molecularDynamicsSchema } from '../modes/molecularDynamics'
import { nbodySchema } from '../modes/nbody'
import { gpuNbodySchema } from '../modes/gpuNbody'
import { particleLifeSchema } from '../modes/particleLife'
import { boidsSchema } from '../modes/boids'
import { electrostaticsSchema } from '../modes/electrostatics'

/** A ready-made, hand-tuned showcase setup launchable from the scenario menu. */
export interface CuratedScenario {
  id: string
  title: string
  summary: string
  scenario: Scenario
}

/** Full param set = the mode's schema defaults with the curated overrides applied on top. */
function withDefaults(schema: ParamSchema, overrides: Record<string, ParamValue>): Record<string, ParamValue> {
  return { ...defaultParamValues(schema), ...overrides }
}

function make(
  id: string,
  title: string,
  summary: string,
  modeId: string,
  schema: ParamSchema,
  seed: number,
  overrides: Record<string, ParamValue> = {},
): CuratedScenario {
  return { id, title, summary, scenario: { modeId, seed, params: withDefaults(schema, overrides) } }
}

/**
 * The curated gallery — a couple of evocative setups per showcased mode. Each is a complete,
 * reproducible scenario (seed + full params), so launching one drops the learner straight into
 * the phenomenon.
 */
export const allCuratedScenarios: CuratedScenario[] = [
  make(
    'mb-convergence',
    'Maxwell–Boltzmann convergence',
    'A dense elastic gas whose speed histogram settles onto the analytic Maxwell–Boltzmann curve.',
    'elastic-gas',
    elasticGasSchema,
    7,
    { particleCount: 2000, initialVelocity: 1.2, containerSize: 3 },
  ),
  make(
    'diffusion-mixing',
    'Diffusion & mixing',
    'Fast particles spreading through the box — watch the bulk relax to equilibrium.',
    'elastic-gas',
    elasticGasSchema,
    21,
    { particleCount: 1200, initialVelocity: 1.8 },
  ),
  make(
    'dense-gas-boyle',
    'Dense gas (Boyle setup)',
    'A thermostatted Lennard-Jones gas in a small box — compress it and watch the pressure climb.',
    'molecular-dynamics',
    molecularDynamicsSchema,
    3,
    { particleCount: 512, temperature: 1.0, holdTemperature: true, containerSize: 12 },
  ),
  make(
    'spiral-galaxy',
    'Spiral galaxy',
    'A rotating disc of bodies settling into spiral structure under mutual gravity.',
    'nbody',
    nbodySchema,
    101,
    { particleCount: 1800, gravity: 0.03, rotation: 0.9, softening: 0.15, containerSize: 8 },
  ),
  make(
    'gravitational-collapse',
    'Gravitational collapse',
    'A spinless cloud falling together — clustering, slingshots, and chaotic orbits.',
    'nbody',
    nbodySchema,
    202,
    { particleCount: 1200, gravity: 0.06, rotation: 0, softening: 0.12 },
  ),
  make(
    'galaxy-100k',
    'Galaxy at 60k bodies (GPU)',
    'A GPU N-body disc large enough to resolve fine structure. Needs WebGPU.',
    'nbody-gpu',
    gpuNbodySchema,
    55,
    { particleCount: 60000, gravity: 12, rotation: 0.8 },
  ),
  make(
    'primordial-soup',
    'Primordial soup',
    'Six interacting species under an asymmetric force matrix — cells, chains, and self-replication.',
    'particle-life',
    particleLifeSchema,
    9,
    { particleCount: 5000, numTypes: 6, forceStrength: 1.2 },
  ),
  make(
    'murmuration',
    'Murmuration',
    'A large flock steering by separation, alignment, and cohesion.',
    'boids',
    boidsSchema,
    44,
    { particleCount: 4000, cohesionWeight: 1.2 },
  ),
  make(
    'plasma',
    'Two-sign plasma',
    'Positive and negative charges under a Coulomb force — recombination and oscillation.',
    'electrostatics',
    electrostaticsSchema,
    77,
    { particleCount: 800, coulombConstant: 6 },
  ),
]

/** Curated scenarios for a given mode (preserves gallery order). */
export function curatedScenariosFor(modeId: string): CuratedScenario[] {
  return allCuratedScenarios.filter((c) => c.scenario.modeId === modeId)
}
