import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three/webgpu'
import { createSimDriver, type SimDriver } from './simDriver'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { ensureRapierReady, isRapierReady } from '../sim-core/physics/rapierEngine'
import { ShapeType } from '../sim-core/types'
import { TYPE_PALETTE } from './colorRamp'
import { SHADOW_CASTER_MAX_COUNT, SURFACE_METALNESS, SURFACE_ROUGHNESS } from './materialConstants'

// Per-shape instance capacity (matches the rigid-body schema's bodyCount max). We draw
// `mesh.count` ≤ capacity each frame, so changing the count never reallocates the mesh.
const MAX_BODIES = 400

// Categorical colours from the shared, colour-blind-safe data-viz ramp. Bodies are coloured by
// shape (boxes vs spheres) — the salient distinction in a rigid-body sandbox — and the colour is
// paired with the shape itself, so meaning is never carried by colour alone.
const SPHERE_COLOR = TYPE_PALETTE[0]
const BOX_COLOR = TYPE_PALETTE[1]

/** The disposable resources owned by one mount: the sim driver and the two shape meshes. */
interface RapierResources {
  driver: SimDriver
  boxGeometry: THREE.BoxGeometry
  sphereGeometry: THREE.SphereGeometry
  boxMaterial: THREE.MeshStandardNodeMaterial
  sphereMaterial: THREE.MeshStandardNodeMaterial
}

/**
 * Renderer for the Rapier rigid-body sandbox (the `rapier` backend; see ParticleField). Draws
 * the bodies as two instanced meshes — boxes and spheres — reading per-body position,
 * orientation, shape and half-extents from the buffers, so shapes are correctly oriented and
 * sized (unlike the uniform-sphere particle path). Holds no physics: it forwards frame deltas
 * to the generic `SimDriver`, exactly like CpuParticles.
 *
 * Rapier's WASM loads asynchronously, so the driver is only created once `ensureRapierReady()`
 * resolves (mirroring how the canvas awaits `renderer.init()`); until then nothing is drawn, and
 * a load failure surfaces an in-viewport error rather than a silent permanent blank.
 */
export function RapierBodies() {
  const boxRef = useRef<THREE.InstancedMesh | null>(null)
  const sphereRef = useRef<THREE.InstancedMesh | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])

  // Gate everything on Rapier being initialised. `isRapierReady()` short-circuits re-mounts once
  // the singleton has loaded; the first mount awaits the dynamic import + init, and a rejection is
  // captured (never swallowed) so the viewport can report it.
  const [ready, setReady] = useState(isRapierReady())
  const [loadError, setLoadError] = useState<Error | null>(null)
  useEffect(() => {
    if (ready) return
    let alive = true
    void ensureRapierReady().then(
      () => alive && setReady(true),
      (err: unknown) => alive && setLoadError(err instanceof Error ? err : new Error(String(err))),
    )
    return () => {
      alive = false
    }
  }, [ready])

  // Own the driver + geometries + materials for one mount; build once Rapier is ready, dispose on
  // unmount. Creating and disposing in the same effect is what keeps it StrictMode-safe.
  const [resources, setResources] = useState<RapierResources | null>(null)
  useEffect(() => {
    if (!ready) return
    const surface = { roughness: SURFACE_ROUGHNESS, metalness: SURFACE_METALNESS }
    const built: RapierResources = {
      driver: createSimDriver({ registry: simRegistry }),
      boxGeometry: new THREE.BoxGeometry(1, 1, 1), // unit cube → scaled by full side (2·halfExtent)
      sphereGeometry: new THREE.SphereGeometry(1, 16, 16), // unit radius → scaled by radius
      boxMaterial: new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(BOX_COLOR), ...surface }),
      sphereMaterial: new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(SPHERE_COLOR), ...surface }),
    }
    setResources(built)
    return () => {
      built.driver.dispose()
      built.boxGeometry.dispose()
      built.sphereGeometry.dispose()
      built.boxMaterial.dispose()
      built.sphereMaterial.dispose()
      setResources(null)
    }
  }, [ready])

  const modeId = useParamStore((s) => s.modeId)
  const seed = useParamStore((s) => s.seed)
  const params = useParamStore((s) => s.params)

  // (Re)load the scenario whenever the mode, seed, or any parameter changes.
  useEffect(() => {
    if (!resources) return
    resources.driver.load({ modeId, seed, params })
    useTelemetryStore.getState().reset()
  }, [resources, modeId, seed, params])

  useFrame((_, delta) => {
    const driver = resources?.driver
    const boxMesh = boxRef.current
    const sphereMesh = sphereRef.current
    if (!driver || !boxMesh || !sphereMesh) return

    if (useParamStore.getState().isPlaying) driver.advance(delta)

    const buffers = driver.getBuffers()
    if (buffers) {
      const n = Math.min(buffers.count, MAX_BODIES)
      const { positions, orientations, shapeTypes, halfExtents, radius } = buffers
      let boxN = 0
      let sphereN = 0

      for (let i = 0; i < n; i++) {
        const o3 = i * 3
        dummy.position.set(positions[o3], positions[o3 + 1], positions[o3 + 2])
        if (orientations) {
          const o4 = i * 4
          quat.set(orientations[o4], orientations[o4 + 1], orientations[o4 + 2], orientations[o4 + 3])
          dummy.quaternion.copy(quat)
        } else {
          dummy.quaternion.identity()
        }

        const isBox = shapeTypes ? shapeTypes[i] === ShapeType.Box : false
        if (halfExtents) {
          if (isBox) dummy.scale.set(2 * halfExtents[o3], 2 * halfExtents[o3 + 1], 2 * halfExtents[o3 + 2])
          else dummy.scale.setScalar(halfExtents[o3]) // sphere radius
        } else {
          dummy.scale.setScalar(radius)
        }
        dummy.updateMatrix()

        if (isBox) boxMesh.setMatrixAt(boxN++, dummy.matrix)
        else sphereMesh.setMatrixAt(sphereN++, dummy.matrix)
      }

      boxMesh.count = boxN
      sphereMesh.count = sphereN
      boxMesh.instanceMatrix.needsUpdate = true
      sphereMesh.instanceMatrix.needsUpdate = true

      // Gate shadow casting on the live count so high-count scenes never pay for per-instance
      // shadow-map renders (see SHADOW_CASTER_MAX_COUNT). Rigid bodies (≤ MAX_BODIES = 400)
      // normally fall under the threshold and cast; if a future scene exceeds it, they stop
      // casting but still receive IBL and rest on the shadow-catching ground.
      const cast = n <= SHADOW_CASTER_MAX_COUNT
      boxMesh.castShadow = cast
      sphereMesh.castShadow = cast
      // Let modest-count bodies also catch each other's shadows (stacked boxes/spheres read as
      // solid). Tied to the same gate so dense scenes skip the extra shadow sampling too.
      boxMesh.receiveShadow = cast
      sphereMesh.receiveShadow = cast
    }

    const sample = driver.consumeTelemetry()
    if (sample) useTelemetryStore.getState().push(sample)
  })

  const setBox = useCallback((m: THREE.InstancedMesh | null) => {
    boxRef.current = m
  }, [])
  const setSphere = useCallback((m: THREE.InstancedMesh | null) => {
    sphereRef.current = m
  }, [])

  if (loadError) {
    return (
      <Html center>
        <div className="canvas-error" role="alert">
          Couldn’t load the physics engine. Check your connection and reload.
        </div>
      </Html>
    )
  }
  if (!resources) return null
  return (
    <>
      <instancedMesh ref={setBox} args={[resources.boxGeometry, resources.boxMaterial, MAX_BODIES]} frustumCulled={false} />
      <instancedMesh ref={setSphere} args={[resources.sphereGeometry, resources.sphereMaterial, MAX_BODIES]} frustumCulled={false} />
    </>
  )
}
