import * as THREE from 'three/webgpu'
import {
  instancedArray,
  Fn,
  compute,
  instanceIndex,
  Loop,
  If,
  Continue,
  uniform,
  uint,
  vec3,
  float,
  mix,
  uv,
  smoothstep,
} from 'three/tsl'
import { SLOW_COLOR, FAST_COLOR } from '../colorRamp'

/**
 * GPU N-body: all-pairs Newtonian gravity in TSL compute shaders. State (position,
 * velocity) lives in GPU storage buffers and never round-trips to the CPU. Two passes
 * (verified safe, no ping-pong needed): pass A reads all positions (read-only) and
 * writes each body's velocity; pass B advances each body's position. Mirrors the CPU
 * reference `sim-core/physics/gravity.ts` (a_i = G·Σ Δ/(|Δ|²+ε²)^{3/2}); the GPU form
 * drops the i<j symmetry (each thread sums over all j independently).
 *
 * Sized points require Sprite-instancing on WebGPU (plain Points force 1px), so bodies
 * render as instanced sprites reading position/velocity straight from the buffers.
 */
export interface NbodyGpu {
  computeVelocity: ReturnType<typeof compute>
  computePosition: ReturnType<typeof compute>
  sprite: THREE.Sprite
  /** The velocity storage buffer (xyz per body), for CPU read-back of telemetry. */
  velocityAttribute: THREE.BufferAttribute
  uniforms: {
    g: ReturnType<typeof uniform>
    softeningSq: ReturnType<typeof uniform>
    dt: ReturnType<typeof uniform>
    halfBound: ReturnType<typeof uniform>
    vMax: ReturnType<typeof uniform>
  }
  dispose(): void
}

export function createNbodyGpu(
  count: number,
  seedPositions: Float32Array,
  seedVelocities: Float32Array,
  radius: number,
): NbodyGpu {
  // Storage buffers seeded directly from the CPU arrays. setPBO enables the random
  // gather (reading other bodies' positions) on the WebGL2 fallback backend.
  const positionStorage = instancedArray(seedPositions, 'vec3')
  const velocityStorage = instancedArray(seedVelocities, 'vec3')
  positionStorage.setPBO(true)

  const g = uniform(0.02)
  const softeningSq = uniform(0.04)
  const dt = uniform(1 / 90)
  const halfBound = uniform(5)
  const vMax = uniform(1)

  // Pass A: accumulate acceleration over all bodies, semi-implicit Euler on velocity.
  const velocityKernel = Fn(() => {
    const i = instanceIndex
    const pos = positionStorage.element(i)
    const vel = velocityStorage.element(i)
    const acc = vec3(0).toVar()

    Loop({ start: uint(0), end: uint(count), type: 'uint', condition: '<' }, ({ i: j }) => {
      If(j.equal(i), () => {
        Continue()
      })
      const other = positionStorage.element(j)
      const d = other.sub(pos)
      const distSq = d.dot(d).add(softeningSq)
      const invDist = distSq.sqrt().reciprocal()
      const invDist3 = invDist.mul(invDist).mul(invDist)
      acc.addAssign(d.mul(g).mul(invDist3))
    })

    vel.addAssign(acc.mul(dt))
  })
  const computeVelocity = compute(velocityKernel(), count)

  // Pass B: advance position; clamp to the container bounds (keeps the cluster framed).
  const positionKernel = Fn(() => {
    const pos = positionStorage.element(instanceIndex)
    const vel = velocityStorage.element(instanceIndex)
    pos.addAssign(vel.mul(dt))
    const hb = vec3(halfBound)
    pos.assign(pos.clamp(hb.negate(), hb))
  })
  const computePosition = compute(positionKernel(), count)

  // Render: instanced sprites reading position straight from the GPU buffer, colored by
  // speed via the same blue→red ramp as the CPU modes, with a soft round falloff.
  const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false })
  material.blending = THREE.AdditiveBlending
  material.positionNode = positionStorage.toAttribute()
  const speed = velocityStorage.toAttribute().length()
  const t = speed.div(vMax).clamp(0, 1)
  material.colorNode = mix(vec3(...SLOW_COLOR), vec3(...FAST_COLOR), t)
  material.scaleNode = float(radius * 2)
  material.opacityNode = smoothstep(0.5, 0.0, uv().sub(0.5).length())

  const sprite = new THREE.Sprite(material)
  sprite.count = count
  sprite.frustumCulled = false

  return {
    computeVelocity,
    computePosition,
    sprite,
    // The storage node's underlying buffer attribute — read back on the CPU for telemetry.
    velocityAttribute: velocityStorage.value as unknown as THREE.BufferAttribute,
    uniforms: { g, softeningSq, dt, halfBound, vMax },
    dispose() {
      material.dispose()
    },
  }
}
