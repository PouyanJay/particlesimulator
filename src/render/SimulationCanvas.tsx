import './webgpu' // registers three/webgpu JSX elements; must load before <Canvas>
import * as THREE from 'three/webgpu'
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ParticleField } from './ParticleField'
import { PostFx } from './PostFx'
import { useParamStore } from '../state/paramStore'
import { theme } from '../ui/theme'
import { defaultCameraPosition, zoomLimitsForContainer } from './cameraFraming'

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
  const modeId = useParamStore((s) => s.modeId)

  useEffect(() => {
    const size = currentContainerSize()
    const [x, y, z] = defaultCameraPosition(size, CAMERA_FOV)
    camera.position.set(x, y, z)
    const controls = controlsRef.current
    if (controls) {
      const { min, max } = zoomLimitsForContainer(size, CAMERA_FOV)
      controls.minDistance = min
      controls.maxDistance = max
      controls.target.set(0, 0, 0)
      controls.update()
    } else {
      camera.lookAt(0, 0, 0)
    }
    // `modeId` is the reset trigger; camera and the ref object are stable.
  }, [modeId, camera, controlsRef])

  return null
}

/** The 3D viewport: lighting, the container wireframe, orbit controls, and the particles. */
export function SimulationCanvas() {
  const containerSize = useParamStore((s) =>
    typeof s.params.containerSize === 'number' ? s.params.containerSize : FALLBACK_CONTAINER_SIZE,
  )
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
    >
      <color attach="background" args={[theme.bgBase]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 10, 6]} intensity={1.1} />

      <ParticleField />

      <mesh>
        <boxGeometry args={[containerSize, containerSize, containerSize]} />
        <meshBasicMaterial color={theme.border} wireframe transparent opacity={0.45} />
      </mesh>

      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate makeDefault />
      <CameraRig controlsRef={controlsRef} />

      {/* Must be last: takes over the render to present the post-processed (bloom) frame. */}
      <PostFx />
    </Canvas>
  )
}
