import type { NumberParam } from '../types'

/**
 * The universal "Scene" parameters, defined once and composed into every mode's schema
 * (single source of truth — composition over per-mode duplication). Each factory presets the
 * `type` and `group` so a universal concept always renders in the same panel section with the
 * same semantics; modes supply only the label and range that differ. A matching behaviour for
 * each lives in `physics/environment.ts`, so a feature like gravity travels as param + physics.
 */

/** The label/range a mode supplies for a universal number parameter. */
export interface NumberParamOptions {
  label: string
  default: number
  min: number
  max: number
  step?: number
}

/** Number of particles/atoms/bodies/boids. */
export function countParam(options: NumberParamOptions): NumberParam {
  return { type: 'number', group: 'scene', step: 1, ...options }
}

/** Container bounds — the side length of the cubic box the system lives in. */
export function containerParam(options: NumberParamOptions): NumberParam {
  return { type: 'number', group: 'scene', step: 0.5, ...options }
}

/** Rendered particle size (visual, unless a mode also uses it physically, e.g. the elastic gas). */
export function displaySizeParam(options: NumberParamOptions): NumberParam {
  return { type: 'number', group: 'scene', step: 0.01, ...options }
}

/**
 * External uniform gravity strength (0 = off). A universal optional behaviour, grouped with
 * the other environment/scene settings. Pair with `applyGravity` from `physics/environment.ts`.
 * (N-body's gravity is its own inter-particle force, not this external field.)
 */
export function gravityParam(options?: Partial<NumberParamOptions>): NumberParam {
  return { type: 'number', group: 'scene', label: 'Gravity', default: 0, min: 0, max: 10, step: 0.5, ...options }
}
