import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { createSimDriver, type SimDriver } from './simDriver'
import { simRegistry } from '../state/simRegistry'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { speedToRgb, TYPE_PALETTE } from './colorRamp'
import { SURFACE_METALNESS, SURFACE_ROUGHNESS } from './materialConstants'
import { theme } from '../ui/theme'

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
  // Spring/connection rendering: a single LineSegments whose vertex buffer is gathered from
  // the active mode's `edges` each frame (empty/hidden for particle-only modes).
  lineGeometry: THREE.BufferGeometry
  lineMaterial: THREE.LineBasicNodeMaterial
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

  // Spring lines: the LineSegments object plus the CPU-side vertex buffer it draws from. The
  // buffer is (re)allocated lazily when a mode's edge count first appears or grows; `drawRange`
  // handles shrinking without reallocating. Two vertices per edge, xyz each.
  const lineRef = useRef<THREE.LineSegments | null>(null)
  const linePositions = useRef<Float32Array | null>(null)
  const lineVertexCapacity = useRef(0)

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
      material: new THREE.MeshStandardNodeMaterial({ color: 0xffffff, roughness: SURFACE_ROUGHNESS, metalness: SURFACE_METALNESS }),
      lineGeometry: new THREE.BufferGeometry(),
      // Structural connector color (tokenised — mirrors --text-muted, ≈3.9:1 on bg-base so the
      // spring network reads clearly as structure without competing with the speed-coloured
      // masses). LineBasicNodeMaterial compiles to WGSL/GLSL like the instanced mesh material.
      lineMaterial: new THREE.LineBasicNodeMaterial({ color: new THREE.Color(theme.textMuted) }),
    }
    setResources(built)
    return () => {
      built.driver.dispose()
      built.geometry.dispose()
      built.material.dispose()
      built.lineGeometry.dispose()
      built.lineMaterial.dispose()
      linePositions.current = null
      lineVertexCapacity.current = 0
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

      // Spring lines: gather each edge's two endpoints into the line vertex buffer. Modes
      // without `edges` (the particle-only majority) hide the LineSegments entirely. Edges are
      // assumed to index within `buffers.count` (guaranteed by the topology builder), so the
      // positions reads below are always in-bounds even though the mesh draws only `n` instances.
      const lines = lineRef.current
      const edges = buffers.edges
      if (lines && resources && edges && edges.length > 0) {
        const vertexCount = edges.length // one line vertex per edge endpoint
        let verts = linePositions.current
        if (!verts || lineVertexCapacity.current < vertexCount) {
          verts = new Float32Array(vertexCount * 3)
          linePositions.current = verts
          lineVertexCapacity.current = vertexCount
          const attr = new THREE.BufferAttribute(verts, 3)
          attr.setUsage(THREE.DynamicDrawUsage)
          resources.lineGeometry.setAttribute('position', attr)
        }
        for (let k = 0; k < vertexCount; k++) {
          const o = edges[k] * 3
          const t = k * 3
          verts[t] = buffers.positions[o]
          verts[t + 1] = buffers.positions[o + 1]
          verts[t + 2] = buffers.positions[o + 2]
        }
        resources.lineGeometry.setDrawRange(0, vertexCount)
        ;(resources.lineGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
        lines.visible = true
      } else if (lines) {
        lines.visible = false
      }
    }

    const sample = activeDriver.consumeTelemetry()
    if (sample) useTelemetryStore.getState().push(sample)
  })

  return resources ? (
    <>
      <instancedMesh ref={setMesh} args={[resources.geometry, resources.material, MAX_INSTANCES]} frustumCulled={false} />
      {/* Springs/connections. Hidden until a mode supplies `edges`; buffer filled in useFrame. */}
      <lineSegments ref={lineRef} args={[resources.lineGeometry, resources.lineMaterial]} frustumCulled={false} visible={false} />
    </>
  ) : null
}
