import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { createSimDriver, type SimDriver } from './simDriver'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { speedToRgb, TYPE_PALETTE } from './colorRamp'

// Fixed instance capacity (matches the elastic gas schema's particleCount max). We render
// `mesh.count` ≤ capacity each frame, so changing the particle count never reallocates
// or remounts the mesh. The spatial-grid broadphase keeps the CPU sim feasible at this
// scale; the Sprite/Points tier for 100k+ lands with the Phase 2 GPU backend.
const MAX_INSTANCES = 20000

/**
 * Renders the active simulation as a single instanced mesh, driven entirely by the
 * (framework-agnostic, tested) `SimDriver`. This component holds no physics logic: it
 * forwards frame deltas to the driver and copies the resulting buffers into instance
 * matrices. Params/seed are read from the store; the hot loop reads `isPlaying` via
 * getState() so playback toggling never re-renders React.
 */
export function ParticleField() {
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Pre-allocate instanceColor the moment the mesh is created (before the node material
  // compiles), so MeshStandardNodeMaterial reliably injects the per-instance color tint.
  // Lazy creation via setColorAt is timing-fragile under StrictMode material recreation.
  const setMesh = useCallback((mesh: THREE.InstancedMesh | null) => {
    meshRef.current = mesh
    if (mesh && !mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3).fill(1), 3)
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    }
  }, [])
  const tmpColor = useMemo(() => new THREE.Color(), [])
  // Reused scratch so the per-particle color computation allocates nothing per frame.
  const rgb = useMemo<[number, number, number]>(() => [0, 0, 0], [])
  // Smoothed reference speed for the color ramp — auto-scales to the current speed range
  // (mode-agnostic; uses last frame's value, then eases toward this frame's max).
  const vMaxRef = useRef(1)
  // Pre-built categorical colors for color-by-type modes (hex is sRGB).
  const typeColors = useMemo(() => TYPE_PALETTE.map((hex) => new THREE.Color(hex)), [])

  // StrictMode-safe lazy resources. React 19 StrictMode (which R3F 9 now inherits) mounts
  // → unmounts → remounts in dev; the unmount cleanup disposes AND nulls these, so the
  // remount recreates fresh GPU objects instead of reusing disposed ones. The `??=` reads
  // return non-null locals for the render below.
  const driverRef = useRef<SimDriver | null>(null)
  const geometryRef = useRef<THREE.SphereGeometry | null>(null)
  const materialRef = useRef<THREE.MeshStandardNodeMaterial | null>(null)
  const driver = (driverRef.current ??= createSimDriver({ registry: simRegistry }))
  const geometry = (geometryRef.current ??= new THREE.SphereGeometry(1, 16, 16))
  // Node material (TSL): compiles to WGSL on WebGPU and GLSL on the WebGL2 fallback.
  // Base color is white so the per-instance speed tint (instanceColor, applied
  // multiplicatively by the node material) renders faithfully.
  const material = (materialRef.current ??= new THREE.MeshStandardNodeMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.1,
  }))

  const modeId = useParamStore((s) => s.modeId)
  const seed = useParamStore((s) => s.seed)
  const params = useParamStore((s) => s.params)

  // (Re)load the scenario whenever the mode, seed, or any parameter changes.
  // Phase 0 deliberately re-initialises on *any* param change (deterministic restart).
  // TODO(phase-1): split "structural" params (count, seed) that justify a reload from
  // "live" params (e.g. restitution, gravity) applied to the running mode in place.
  useEffect(() => {
    driver.load({ modeId, seed, params })
    useTelemetryStore.getState().reset()
  }, [driver, modeId, seed, params])

  // Dispose and null GPU resources on unmount so a StrictMode remount recreates them.
  useEffect(() => {
    return () => {
      driverRef.current?.dispose()
      geometryRef.current?.dispose()
      materialRef.current?.dispose()
      driverRef.current = null
      geometryRef.current = null
      materialRef.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const driver = driverRef.current
    const mesh = meshRef.current
    if (!driver || !mesh) return

    if (useParamStore.getState().isPlaying) driver.advance(delta)

    const buffers = driver.getBuffers()
    if (buffers) {
      const n = Math.min(buffers.count, MAX_INSTANCES)
      const velocities = buffers.velocities
      const particleTypes = buffers.types
      // Coloring: by type (categorical) when the mode provides types, else by speed.
      const colored = Boolean(particleTypes || velocities)
      const vMax = vMaxRef.current // last frame's smoothed max speed
      let frameMaxSpeedSq = 0
      for (let i = 0; i < n; i++) {
        const o = i * 3
        dummy.position.set(buffers.positions[o], buffers.positions[o + 1], buffers.positions[o + 2])
        dummy.scale.setScalar(buffers.radius)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        if (particleTypes) {
          mesh.setColorAt(i, typeColors[particleTypes[i] % typeColors.length])
        } else if (velocities) {
          const vx = velocities[o]
          const vy = velocities[o + 1]
          const vz = velocities[o + 2]
          const speedSq = vx * vx + vy * vy + vz * vz
          if (speedSq > frameMaxSpeedSq) frameMaxSpeedSq = speedSq
          speedToRgb(Math.sqrt(speedSq), vMax, rgb)
          tmpColor.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)
          mesh.setColorAt(i, tmpColor)
        }
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (colored && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      // Ease the color-ramp ceiling toward this frame's max speed (mode-agnostic).
      if (velocities) {
        vMaxRef.current = Math.max(1e-6, vMaxRef.current * 0.9 + Math.sqrt(frameMaxSpeedSq) * 0.1)
      }
    }

    const sample = driver.consumeTelemetry()
    if (sample) useTelemetryStore.getState().push(sample)
  })

  return <instancedMesh ref={setMesh} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} />
}
