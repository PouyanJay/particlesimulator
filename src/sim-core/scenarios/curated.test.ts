import { describe, it, expect } from 'vitest'
import { allCuratedScenarios, curatedScenariosFor } from './curated'
import { createRegistry } from '../registry'
import { createElasticGasMode } from '../modes/elasticGas'
import { createParticleLifeMode } from '../modes/particleLife'
import { createNbodyMode } from '../modes/nbody'
import { createGpuNbodyMode } from '../modes/gpuNbody'
import { createBoidsMode } from '../modes/boids'
import { createMolecularDynamicsMode } from '../modes/molecularDynamics'
import { createElectrostaticsMode } from '../modes/electrostatics'

// Mirror the app registry so we can validate curated scenarios against real schemas.
const registry = createRegistry()
;[
  createElasticGasMode,
  createParticleLifeMode,
  createNbodyMode,
  createGpuNbodyMode,
  createBoidsMode,
  createMolecularDynamicsMode,
  createElectrostaticsMode,
].forEach((f) => registry.register(f))

describe('curated scenarios', () => {
  it('all reference a registered mode and have unique ids', () => {
    const ids = allCuratedScenarios.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of allCuratedScenarios) {
      expect(registry.has(c.scenario.modeId)).toBe(true)
    }
  })

  it('carry a complete, schema-valid param set for their mode', () => {
    for (const c of allCuratedScenarios) {
      const schema = registry.create(c.scenario.modeId).paramSchema
      const schemaKeys = Object.keys(schema).sort()
      expect(Object.keys(c.scenario.params).sort()).toEqual(schemaKeys)
      // every value is within the declared range / correct type
      for (const [key, def] of Object.entries(schema)) {
        const value = c.scenario.params[key]
        if (def.type === 'number') {
          expect(typeof value).toBe('number')
          expect(value as number).toBeGreaterThanOrEqual(def.min)
          expect(value as number).toBeLessThanOrEqual(def.max)
        } else {
          expect(typeof value).toBe('boolean')
        }
      }
    }
  })

  it('filters by mode, preserving gallery order', () => {
    const gas = curatedScenariosFor('elastic-gas')
    expect(gas.map((c) => c.id)).toEqual(['mb-convergence', 'diffusion-mixing'])
    expect(curatedScenariosFor('does-not-exist')).toEqual([])
  })
})
