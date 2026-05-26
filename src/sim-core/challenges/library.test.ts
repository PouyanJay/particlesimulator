import { describe, it, expect } from 'vitest'
import { allChallenges, challengesFor } from './library'
import type { Challenge, ChallengeContext } from './types'
import type { Telemetry } from '../types'
import { elasticGasSchema } from '../modes/elasticGas'
import { molecularDynamicsSchema } from '../modes/molecularDynamics'
import { nbodySchema } from '../modes/nbody'

/** The real param schemas, keyed by the mode id challenges reference. */
const schemasByMode: Record<string, Record<string, unknown>> = {
  'elastic-gas': elasticGasSchema,
  'molecular-dynamics': molecularDynamicsSchema,
  nbody: nbodySchema,
}

function telemetry(): Telemetry {
  return { particleCount: 0, averageSpeed: 0, kineticEnergy: 0 }
}

/**
 * Run a check's `evaluate` against a Proxy params object that records every key it reads.
 * This surfaces the *real* param keys a param-based check depends on without parsing
 * describe strings or reaching into the builder's internals.
 */
function paramKeysReadBy(evaluate: (ctx: ChallengeContext) => boolean): string[] {
  const accessed = new Set<string>()
  const params = new Proxy(
    {},
    {
      get(_target, prop): undefined {
        if (typeof prop === 'string') accessed.add(prop)
        return undefined
      },
    },
  ) as Record<string, number | boolean>
  evaluate({ telemetry: telemetry(), params, baseline: telemetry() })
  return [...accessed]
}

describe('challengesFor', () => {
  it('returns only challenges targeting the given mode', () => {
    for (const challenge of allChallenges) {
      const result = challengesFor(challenge.modeId)
      expect(result).toContain(challenge)
      for (const other of result) expect(other.modeId).toBe(challenge.modeId)
    }
  })

  it('returns an empty list for an unknown mode', () => {
    expect(challengesFor('does-not-exist')).toEqual([])
  })

  it('preserves library order within a mode', () => {
    const md = challengesFor('molecular-dynamics')
    const orderInLibrary = allChallenges.filter((c) => c.modeId === 'molecular-dynamics')
    expect(md).toEqual(orderInLibrary)
  })
})

describe('library integrity', () => {
  it('has at least three challenges', () => {
    expect(allChallenges.length).toBeGreaterThanOrEqual(3)
  })

  it('every challenge has a non-empty modeId, title, summary and at least one step', () => {
    for (const challenge of allChallenges) {
      expect(challenge.modeId.length).toBeGreaterThan(0)
      expect(challenge.title.length).toBeGreaterThan(0)
      expect(challenge.summary.length).toBeGreaterThan(0)
      expect(challenge.steps.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('every step has a non-empty id and prompt', () => {
    for (const challenge of allChallenges) {
      for (const step of challenge.steps) {
        expect(step.id.length).toBeGreaterThan(0)
        expect(step.prompt.length).toBeGreaterThan(0)
      }
    }
  })

  it('uses unique challenge ids across the whole library', () => {
    const ids = allChallenges.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses unique step ids within each challenge', () => {
    for (const challenge of allChallenges) {
      const stepIds = challenge.steps.map((s) => s.id)
      expect(new Set(stepIds).size).toBe(stepIds.length)
    }
  })

  it('targets only modes that exist in the registry-known schemas', () => {
    for (const challenge of allChallenges) {
      expect(schemasByMode[challenge.modeId]).toBeDefined()
    }
  })

  it('every param-based check references a key that exists in its mode schema', () => {
    for (const challenge of allChallenges) {
      const schema = schemasByMode[challenge.modeId]
      for (const step of challenge.steps) {
        if (!step.check) continue
        for (const key of paramKeysReadBy(step.check.evaluate)) {
          expect(schema, `${challenge.id}/${step.id} reads param "${key}"`).toHaveProperty(key)
        }
      }
    }
  })

  it('exposes a describe string on every check', () => {
    for (const challenge of allChallenges) {
      for (const step of challenge.steps) {
        if (step.check) expect(step.check.describe.length).toBeGreaterThan(0)
      }
    }
  })
})

// A compile-time assertion that the public type is exported and usable.
const _typeCheck: Challenge[] = allChallenges
void _typeCheck
