import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createSimDriver, type SimDriver } from './simDriver'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { theme } from '../ui/theme'

// Fixed instance capacity (the elastic gas schema caps particleCount here). We render
// `mesh.count` ≤ capacity each frame, so changing the particle count never reallocates
// or remounts the mesh.
const MAX_INSTANCES = 2000

/**
 * Renders the active simulation as a single instanced mesh, driven entirely by the
 * (framework-agnostic, tested) `SimDriver`. This component holds no physics logic: it
 * forwards frame deltas to the driver and copies the resulting buffers into instance
 * matrices. Params/seed are read from the store; the hot loop reads `isPlaying` via
 * getState() so playback toggling never re-renders React.
 */
export function ParticleField() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // StrictMode-safe lazy resources. React 19 StrictMode (which R3F 9 now inherits) mounts
  // → unmounts → remounts in dev; the unmount cleanup disposes AND nulls these, so the
  // remount recreates fresh GPU objects instead of reusing disposed ones. The `??=` reads
  // return non-null locals for the render below.
  const driverRef = useRef<SimDriver | null>(null)
  const geometryRef = useRef<THREE.SphereGeometry | null>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const driver = (driverRef.current ??= createSimDriver({ registry: simRegistry }))
  const geometry = (geometryRef.current ??= new THREE.SphereGeometry(1, 16, 16))
  const material = (materialRef.current ??= new THREE.MeshStandardMaterial({
    color: theme.accent,
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
      for (let i = 0; i < n; i++) {
        dummy.position.set(buffers.positions[i * 3], buffers.positions[i * 3 + 1], buffers.positions[i * 3 + 2])
        dummy.scale.setScalar(buffers.radius)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }

    const sample = driver.consumeTelemetry()
    if (sample) useTelemetryStore.getState().push(sample)
  })

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_INSTANCES]} frustumCulled={false} />
}
