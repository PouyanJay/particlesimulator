import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { createSimDriver, type SimDriver } from './simDriver'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { speedToRgb, TYPE_PALETTE } from './colorRamp'

// Fixed instance capacity (matches the CPU schemas' particleCount max). We render
// `mesh.count` ≤ capacity each frame, so changing the particle count never reallocates
// or remounts the mesh. The spatial-grid broadphase keeps the CPU sim feasible at this
// scale; GPU-backed modes (100k+) render via <GpuNbody> instead.
const MAX_INSTANCES = 20000

/** The disposable GPU/sim resources owned by one mount of this component. */
interface CpuResources {
  driver: SimDriver
  geometry: THREE.SphereGeometry
  material: THREE.MeshStandardNodeMaterial
}

/**
 * Renders any CPU-backed simulation as a single instanced mesh, driven by the
 * (framework-agnostic, tested) `SimDriver`. Holds no physics logic: it forwards frame
 * deltas to the driver and copies the resulting buffers into instance matrices/colors.
 * Params/seed are read from the store; the hot loop reads `isPlaying` via getState() so
 * playback toggling never re-renders React.
 */
export function CpuParticles() {
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

  // Own the disposable resources (sim driver + geometry + node material) entirely within a
  // single effect: build on mount, dispose on unmount. Creating and disposing in the *same*
  // effect is what makes this StrictMode-safe — React 19's dev mount→unmount→remount runs
  // cleanup then setup, so it always ends on a fresh, live build. Building in the render body
  // and disposing in a separate effect (the previous approach) left the resources disposed
  // after the dance with nothing to rebuild them unless an incidental re-render happened —
  // which is why switching *from* the GPU mode (the only path that fresh-mounts this
  // component) froze on a default instanced mesh (the lone white sphere) with a dead driver.
  const [resources, setResources] = useState<CpuResources | null>(null)
  useEffect(() => {
    const built: CpuResources = {
      driver: createSimDriver({ registry: simRegistry }),
      geometry: new THREE.SphereGeometry(1, 16, 16),
      // Node material (TSL): compiles to WGSL on WebGPU and GLSL on the WebGL2 fallback.
      // Base color is white so the per-instance speed tint (instanceColor, applied
      // multiplicatively by the node material) renders faithfully.
      material: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 }),
    }
    setResources(built)
    return () => {
      built.driver.dispose()
      built.geometry.dispose()
      built.material.dispose()
      setResources(null)
    }
  }, [])

  const modeId = useParamStore((s) => s.modeId)
  const seed = useParamStore((s) => s.seed)
  const params = useParamStore((s) => s.params)

  // (Re)load the scenario whenever the mode, seed, or any parameter changes.
  // TODO(phase-1): split "structural" params (count, seed) that justify a reload from
  // "live" params (e.g. restitution, gravity) applied to the running mode in place.
  useEffect(() => {
    if (!resources) return
    resources.driver.load({ modeId, seed, params })
    useTelemetryStore.getState().reset()
  }, [resources, modeId, seed, params])

  useFrame((_, delta) => {
    const activeDriver = resources?.driver
    const mesh = meshRef.current
    if (!activeDriver || !mesh) return

    if (useParamStore.getState().isPlaying) activeDriver.advance(delta)

    const buffers = activeDriver.getBuffers()
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

    const sample = activeDriver.consumeTelemetry()
    if (sample) useTelemetryStore.getState().push(sample)
  })

  return resources ? (
    <instancedMesh ref={setMesh} args={[resources.geometry, resources.material, MAX_INSTANCES]} frustumCulled={false} />
  ) : null
}
