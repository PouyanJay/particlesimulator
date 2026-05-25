/**
 * Reynolds flocking ("boids") steering kernel — the pure rule math, decoupled from any
 * neighbour search so it is unit-testable in isolation (mirroring particleLifeForce as a
 * separate tested kernel). The mode feeds neighbours one at a time via the spatial grid;
 * here we only accumulate and resolve the three classic steering behaviours:
 *
 *  - Separation: steer away from neighbours closer than `separationRadius`, weighted by
 *    1/distance so very-close neighbours push hardest (collision avoidance).
 *  - Alignment:  steer to match the average heading (velocity) of perceived neighbours.
 *  - Cohesion:   steer toward the average position (centre of mass) of perceived neighbours.
 *
 * Alignment and cohesion use Reynolds' "steering = desired − velocity" form: we build a
 * desired velocity at cruise speed (`maxSpeed`) and return the correction toward it, so
 * the combined acceleration turns the boid rather than simply adding raw offsets. The
 * accumulator holds running sums only (no per-neighbour allocation), and `resolveSteering`
 * turns those sums into one acceleration vector clamped to `maxForce`.
 */

export interface SteeringWeights {
  separation: number
  alignment: number
  cohesion: number
}

/**
 * Running per-boid sums over its neighbours. Reused across boids by `reset` so the hot
 * loop allocates nothing per frame.
 */
export interface SteeringAccumulator {
  /** Sum of inverse-distance-weighted away vectors from close neighbours (separation). */
  sepX: number
  sepY: number
  sepZ: number
  /** Sum of neighbour velocities within perception (alignment). */
  velX: number
  velY: number
  velZ: number
  /** Sum of neighbour positions within perception (cohesion centre of mass). */
  posX: number
  posY: number
  posZ: number
  /** Count of neighbours within perception (alignment/cohesion averaging divisor). */
  perceived: number
}

export function createSteeringAccumulator(): SteeringAccumulator {
  return { sepX: 0, sepY: 0, sepZ: 0, velX: 0, velY: 0, velZ: 0, posX: 0, posY: 0, posZ: 0, perceived: 0 }
}

/** Zero an accumulator for reuse on the next boid (no allocation in the hot loop). */
export function resetSteeringAccumulator(acc: SteeringAccumulator): void {
  acc.sepX = 0
  acc.sepY = 0
  acc.sepZ = 0
  acc.velX = 0
  acc.velY = 0
  acc.velZ = 0
  acc.posX = 0
  acc.posY = 0
  acc.posZ = 0
  acc.perceived = 0
}

/**
 * Fold one neighbour into the accumulator. `(otherVx, otherVy, otherVz)` is the
 * neighbour's velocity; `(offsetX, offsetY, offsetZ)` is `neighbourPos − selfPos`.
 * Neighbours within `perceptionRadius` count toward alignment/cohesion; only those also
 * within `separationRadius` contribute to separation. The caller's grid already restricts
 * candidates to roughly the perception radius, but we re-check here so the kernel is
 * correct for any candidate list (and so unit tests exercise the radius gates directly).
 */
export function accumulateNeighbor(
  acc: SteeringAccumulator,
  otherVx: number,
  otherVy: number,
  otherVz: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  separationRadius: number,
  perceptionRadius: number,
): void {
  const distSq = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ
  if (distSq === 0 || distSq >= perceptionRadius * perceptionRadius) return

  // Alignment & cohesion see every perceived neighbour.
  acc.perceived++
  acc.velX += otherVx
  acc.velY += otherVy
  acc.velZ += otherVz
  acc.posX += offsetX
  acc.posY += offsetY
  acc.posZ += offsetZ

  // Separation only from neighbours inside the (smaller) separation radius. Weight the
  // away vector by 1/distance so closer neighbours push proportionally harder.
  if (distSq < separationRadius * separationRadius) {
    const dist = Math.sqrt(distSq)
    const inv = 1 / (dist * dist) // (away unit vector) × (1/dist) = −offset/dist²
    acc.sepX -= offsetX * inv
    acc.sepY -= offsetY * inv
    acc.sepZ -= offsetZ * inv
  }
}

/**
 * Scale `v` in place so its magnitude does not exceed `max` (Reynolds "limit"). A vector
 * already within the limit, and the zero vector, are left unchanged.
 */
export function limitMagnitude(v: [number, number, number], max: number): void {
  const magSq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  if (magSq > max * max && magSq > 0) {
    const s = max / Math.sqrt(magSq)
    v[0] *= s
    v[1] *= s
    v[2] *= s
  }
}

/**
 * Steer a desired-direction vector `(dx, dy, dz)` (need not be unit length) toward cruise:
 * normalise it to `maxSpeed`, subtract the current velocity, and add the result (scaled by
 * `weight`) into `out`. This is Reynolds' steering = desired − velocity. A zero desired
 * vector contributes nothing.
 */
function addReynoldsSteer(
  out: [number, number, number],
  dx: number,
  dy: number,
  dz: number,
  vx: number,
  vy: number,
  vz: number,
  maxSpeed: number,
  weight: number,
): void {
  const mag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (mag === 0) return
  const s = maxSpeed / mag
  out[0] += (dx * s - vx) * weight
  out[1] += (dy * s - vy) * weight
  out[2] += (dz * s - vz) * weight
}

/**
 * Combine the accumulated rules into one steering acceleration, clamped to `maxForce`.
 * `(vx, vy, vz)` is the boid's current velocity (used by the Reynolds steering form for
 * alignment and cohesion). Writes the result into `out` and returns it.
 */
export function resolveSteering(
  acc: SteeringAccumulator,
  vx: number,
  vy: number,
  vz: number,
  maxSpeed: number,
  maxForce: number,
  weights: SteeringWeights,
  out: [number, number, number],
): [number, number, number] {
  out[0] = 0
  out[1] = 0
  out[2] = 0
  if (acc.perceived === 0) return out

  // Separation: add the inverse-distance-weighted away-sum directly (scaled by weight),
  // *not* via the Reynolds normalisation — that would discard the 1/dist magnitude and
  // with it the defining "closer neighbours push harder" property. The final maxForce
  // clamp still bounds it.
  out[0] += acc.sepX * weights.separation
  out[1] += acc.sepY * weights.separation
  out[2] += acc.sepZ * weights.separation

  // Alignment: desired = average neighbour velocity (heading).
  const invN = 1 / acc.perceived
  addReynoldsSteer(out, acc.velX * invN, acc.velY * invN, acc.velZ * invN, vx, vy, vz, maxSpeed, weights.alignment)

  // Cohesion: desired = direction toward the neighbours' centre of mass. The accumulated
  // position offsets are relative to the boid, so their mean is exactly that direction.
  addReynoldsSteer(out, acc.posX * invN, acc.posY * invN, acc.posZ * invN, vx, vy, vz, maxSpeed, weights.cohesion)

  limitMagnitude(out, maxForce)
  return out
}
