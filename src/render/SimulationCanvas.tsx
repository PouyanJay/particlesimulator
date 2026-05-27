import './webgpu' // registers three/webgpu JSX elements; must load before <Canvas>
import * as THREE from 'three/webgpu'
import { useEffect, useRef, lazy, Suspense, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ParticleField } from './ParticleField'
import { PostFx } from './PostFx'
import { useParamStore } from '../state/paramStore'
import { theme } from '../styles/theme'
import { defaultCameraPosition, cameraDistanceForContainer, zoomLimitsForContainer } from './cameraFraming'
import { registerCamera, consumePendingCameraPose } from './cameraBridge'
import { registerCanvas } from './canvasBridge'
import type { CameraPose } from '../sim-core/scenario'

// Fallback when the active mode has no `containerSize` param. TODO(phase-1): expose
// container bounds via mode metadata / ParticleBuffers rather than reading a param by
// name here, so the render shell stays mode-agnostic.
const FALLBACK_CONTAINER_SIZE = 2.5

/** Vertical field of view (deg) — shared by the camera and the fit-to-box framing math. */
const CAMERA_FOV = 45

// Append `?forceWebGL` to the URL to force the WebGL2 backend — used to verify that the
// WebGPU and fallback paths render identically (CLAUDE.md fallback-parity requirement).
const FORCE_WEBGL =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('forceWebGL')

// Dev-only profiling overlay, behind `?stats`. The dynamic import is gated on `import.meta.env.DEV`
// (not just the render) so Rollup dead-code-eliminates it in production — the r3f-perf/stats-gl
// chunk is never emitted or service-worker-precached for end users.
const SHOW_STATS =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('stats')
const PerfOverlay = import.meta.env.DEV
  ? lazy(() => import('./PerfOverlay').then((m) => ({ default: m.PerfOverlay })))
  : null

type OrbitControlsRef = ComponentRef<typeof OrbitControls>

/** The active mode's container size (or the fallback), read non-reactively. */
function currentContainerSize(): number {
  const { params } = useParamStore.getState()
  return typeof params.containerSize === 'number' ? params.containerSize : FALLBACK_CONTAINER_SIZE
}

/**
 * Standardizes the camera: frames the active mode's box on initial load and re-frames it on
 * every mode switch or projection change. A single perspective camera is used throughout —
 * OrbitControls always owns it, so orbit/pan/zoom never break. The 2D view is the same camera
 * placed straight overhead with rotation locked (the orbit controls' `enableRotate` flag), so
 * switching projection is just a re-frame, not a camera swap. Param tweaks within a mode don't
 * move the camera; only mode/view changes reset it.
 */
function CameraRig({ controlsRef }: { controlsRef: RefObject<OrbitControlsRef | null> }) {
  const camera = useThree((s) => s.camera)
  const modeId = useParamStore((s) => s.modeId)
  const view = useParamStore((s) => s.view)

  // Expose the live camera to the UI/state layers (scenario save/share/restore) without
  // prop-drilling refs. Registered once the controls exist; deregistered on unmount.
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    registerCamera({
      getPose(): CameraPose {
        return {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
        }
      },
      setPose(pose) {
        camera.position.set(...pose.position)
        controls.target.set(...pose.target)
        controls.update()
      },
    })
    return () => registerCamera(null)
  }, [camera, controlsRef])

  // Frame the scene on mount and whenever the mode or projection changes. A scenario load can
  // queue a specific pose (shared URL / preset); when present it overrides the default framing.
  useEffect(() => {
    const controls = controlsRef.current
    const size = currentContainerSize()
    const pending = consumePendingCameraPose()

    if (pending) {
      camera.position.set(...pending.position)
      controls?.target.set(...pending.target)
    } else if (view === '2d') {
      // Straight overhead (looking down −Z), framed like the perspective view; rotation is
      // locked by OrbitControls so it reads as a flat 2D projection. Zoom + pan still work.
      camera.position.set(0, 0, cameraDistanceForContainer(size, CAMERA_FOV))
      controls?.target.set(0, 0, 0)
    } else {
      camera.position.set(...defaultCameraPosition(size, CAMERA_FOV))
      controls?.target.set(0, 0, 0)
    }

    if (controls) {
      const { min, max } = zoomLimitsForContainer(size, CAMERA_FOV)
      controls.minDistance = min
      controls.maxDistance = max
      controls.update()
    } else {
      camera.lookAt(0, 0, 0)
    }
    // `modeId`/`view` are the reset triggers; camera and the ref object are stable.
  }, [modeId, view, camera, controlsRef])

  return null
}

/** The 3D viewport: lighting, the container wireframe, orbit controls, and the particles. */
export function SimulationCanvas() {
  const containerSize = useParamStore((s) =>
    typeof s.params.containerSize === 'number' ? s.params.containerSize : FALLBACK_CONTAINER_SIZE,
  )
  const is2D = useParamStore((s) => s.view === '2d')
  const controlsRef = useRef<OrbitControlsRef>(null)

  return (
    <Canvas
      camera={{ position: defaultCameraPosition(currentContainerSize(), CAMERA_FOV), fov: CAMERA_FOV }}
      dpr={[1, 2]}
      // WebGPURenderer picks the WebGPU backend when available and falls back to WebGL2
      // otherwise (or when ?forceWebGL is set). Awaited via R3F 9's async `gl` prop.
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({
          ...props,
          forceWebGL: FORCE_WEBGL,
        } as ConstructorParameters<typeof THREE.WebGPURenderer>[0])
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        await renderer.init()
        return renderer
      }}
      onCreated={(state) => registerCanvas(state.gl.domElement)}
    >
      <color attach="background" args={[theme.bgBase]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 10, 6]} intensity={1.1} />

      <ParticleField />

      <mesh>
        <boxGeometry args={[containerSize, containerSize, containerSize]} />
        <meshBasicMaterial color={theme.border} wireframe transparent opacity={0.45} />
      </mesh>

      {/* Single perspective camera throughout; 2D just locks rotation for a flat top-down view. */}
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate={!is2D} makeDefault />
      <CameraRig controlsRef={controlsRef} />

      {SHOW_STATS && PerfOverlay && (
        <Suspense fallback={null}>
          <PerfOverlay />
        </Suspense>
      )}

      {/* Must be last: takes over the render to present the post-processed (bloom) frame. */}
      <PostFx />
    </Canvas>
  )
}
