/**
 * Fixed-timestep accumulator (the "Gaffer on Games" pattern).
 *
 * The simulation always advances in equal `dt` increments regardless of the variable
 * render frame time. This keeps runs reproducible and stable, and decouples physics
 * from frame rate. A `maxFrameTime` clamp prevents the "spiral of death" where a long
 * stall queues up an unbounded number of catch-up steps.
 */
export interface FixedTimestep {
  /**
   * Feed the elapsed real time since the last call. Invokes `step(dt)` once per fixed
   * increment that fits, carrying any remainder to the next call. Returns the number
   * of steps taken.
   */
  advance(realDelta: number, step: (dt: number) => void): number
}

export function createFixedTimestep(dt: number, maxFrameTime = 0.25): FixedTimestep {
  let accumulator = 0
  return {
    advance(realDelta, step) {
      if (realDelta > 0) {
        accumulator += Math.min(realDelta, maxFrameTime)
      }
      let steps = 0
      while (accumulator >= dt) {
        step(dt)
        accumulator -= dt
        steps++
      }
      return steps
    },
  }
}
