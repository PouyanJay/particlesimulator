import { createRegistry } from '../sim-core/registry'
import { createElasticGasMode } from '../sim-core/modes/elasticGas'
import { createParticleLifeMode } from '../sim-core/modes/particleLife'
import { createNbodyMode } from '../sim-core/modes/nbody'
import { createGpuNbodyMode } from '../sim-core/modes/gpuNbody'
import { createBoidsMode } from '../sim-core/modes/boids'
import { createMolecularDynamicsMode } from '../sim-core/modes/molecularDynamics'
import { createElectrostaticsMode } from '../sim-core/modes/electrostatics'
import { createSpringMassMode } from '../sim-core/modes/springMass'

/**
 * The application's simulation registry. Modes register here once; the UI and render
 * layer only ever see the generic registry/`SimMode` interface, so adding a mode is a
 * one-line change here with no edits elsewhere (the plugin seam — see CLAUDE.md).
 */
export const simRegistry = createRegistry()
simRegistry.register(createElasticGasMode)
simRegistry.register(createParticleLifeMode)
simRegistry.register(createNbodyMode)
simRegistry.register(createGpuNbodyMode)
simRegistry.register(createBoidsMode)
simRegistry.register(createMolecularDynamicsMode)
simRegistry.register(createElectrostaticsMode)
simRegistry.register(createSpringMassMode)
