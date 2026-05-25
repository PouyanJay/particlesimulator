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
  const driverRef = useRef<SimDriver | null>(null)
  if (!driverRef.current) driverRef.current = createSimDriver({ registry: simRegistry })

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.4, metalness: 0.1 }),
    [],
  )

  const modeId = useParamStore((s) => s.modeId)
  const seed = useParamStore((s) => s.seed)
  const params = useParamStore((s) => s.params)

  // (Re)load the scenario whenever the mode, seed, or any parameter changes.
  // Phase 0 deliberately re-initialises on *any* param change (deterministic restart).
  // TODO(phase-1): split "structural" params (count, seed) that justify a reload from
  // "live" params (e.g. restitution, gravity) applied to the running mode in place.
  useEffect(() => {
    driverRef.current?.load({ modeId, seed, params })
    useTelemetryStore.getState().reset()
  }, [modeId, seed, params])

  // Release GPU resources on unmount.
  useEffect(() => {
    const driver = driverRef.current
    return () => {
      geometry.dispose()
      material.dispose()
      driver?.dispose()
    }
  }, [geometry, material])

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
