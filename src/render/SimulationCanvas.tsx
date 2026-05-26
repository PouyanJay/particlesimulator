import './webgpu' // registers three/webgpu JSX elements; must load before <Canvas>
import * as THREE from 'three/webgpu'
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { ParticleField } from './ParticleField'
import { PostFx } from './PostFx'
import { useParamStore } from '../state/paramStore'
import { theme } from '../ui/theme'
import {
  defaultCameraPosition,
  zoomLimitsForContainer,
  orthoCameraPosition,
  orthoZoomForContainer,
} from './cameraFraming'
import { registerCamera, consumePendingCameraPose } from './cameraBridge'
import { registerCanvas } from './canvasBridge'
import { isRecording, stepRecording } from '../export/recordingController'
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

type OrbitControlsRef = ComponentRef<typeof OrbitControls>

/** The active mode's container size (or the fallback), read non-reactively. */
function currentContainerSize(): number {
  const { params } = useParamStore.getState()
  return typeof params.containerSize === 'number' ? params.containerSize : FALLBACK_CONTAINER_SIZE
}

/**
 * Standardizes the camera: frames the active mode's box on initial load and re-frames it on
 * every mode switch, so each mode opens from the same baseline view regardless of its world
 * size. Param tweaks within a mode intentionally don't move the camera — only mode changes
 * reset it (`selectMode` resets params, so the box size read here is the new mode's default).
 */
function CameraRig({ controlsRef }: { controlsRef: RefObject<OrbitControlsRef | null> }) {
  const camera = useThree((s) => s.camera)
  const viewportHeight = useThree((s) => s.size.height)
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

  // Frame the scene on mount and whenever the mode, projection, or active camera changes. A
  // scenario load can queue a specific pose (shared URL / preset); when present it overrides
  // the default framing so the restored viewpoint wins.
  useEffect(() => {
    const controls = controlsRef.current
    const size = currentContainerSize()
    const is2D = view === '2d'
    const pending = consumePendingCameraPose()

    if (pending) {
      camera.position.set(...pending.position)
      controls?.target.set(...pending.target)
    } else if (is2D) {
      // Orthographic top-down: fit the box to the viewport via the camera's zoom.
      camera.position.set(...orthoCameraPosition(size))
      if ('isOrthographicCamera' in camera && camera.isOrthographicCamera) {
        camera.zoom = orthoZoomForContainer(size, viewportHeight)
        camera.updateProjectionMatrix()
      }
      controls?.target.set(0, 0, 0)
    } else {
      camera.position.set(...defaultCameraPosition(size, CAMERA_FOV))
      if (controls) {
        const { min, max } = zoomLimitsForContainer(size, CAMERA_FOV)
        controls.minDistance = min
        controls.maxDistance = max
      }
      controls?.target.set(0, 0, 0)
    }

    if (controls) controls.update()
    else camera.lookAt(0, 0, 0)
    // `modeId`/`view`/`camera`/`viewportHeight` are the reset triggers; the ref is stable.
  }, [modeId, view, camera, viewportHeight, controlsRef])

  return null
}

/** Advances the active video recording once per rendered frame (no-op when not recording). */
function RecorderStepper() {
  useFrame(() => {
    if (isRecording()) void stepRecording()
  })
  return null
}

/** The 3D viewport: lighting, the container wireframe, orbit controls, and the particles. */
export function SimulationCanvas() {
  const containerSize = useParamStore((s) =>
    typeof s.params.containerSize === 'number' ? s.params.containerSize : FALLBACK_CONTAINER_SIZE,
  )
  const is2D = useParamStore((s) => s.view === '2d')
  const controlsRef = useRef<OrbitControlsRef>(null)
  const initialSize = currentContainerSize()

  return (
    <Canvas
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
      {/* Two cameras; `makeDefault` follows the projection. 3D orbits a perspective view; 2D is
          a flat top-down orthographic view (the high-count "2D tier"). */}
      <PerspectiveCamera
        makeDefault={!is2D}
        fov={CAMERA_FOV}
        position={defaultCameraPosition(initialSize, CAMERA_FOV)}
      />
      <OrthographicCamera
        makeDefault={is2D}
        position={orthoCameraPosition(initialSize)}
        near={0.1}
        far={initialSize * 4}
      />

      <color attach="background" args={[theme.bgBase]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 10, 6]} intensity={1.1} />

      <ParticleField />

      <mesh>
        <boxGeometry args={[containerSize, containerSize, containerSize]} />
        <meshBasicMaterial color={theme.border} wireframe transparent opacity={0.45} />
      </mesh>

      {/* In 2D, lock rotation to keep the flat top-down framing; pan + zoom stay enabled. */}
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate={!is2D} makeDefault />
      <CameraRig controlsRef={controlsRef} />
      <RecorderStepper />

      {/* Must be last: takes over the render to present the post-processed (bloom) frame. */}
      <PostFx />
    </Canvas>
  )
}
