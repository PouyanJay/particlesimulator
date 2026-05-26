import './webgpu' // registers three/webgpu JSX elements; must load before <Canvas>
import * as THREE from 'three/webgpu'
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ParticleField } from './ParticleField'
import { PostFx } from './PostFx'
import { SceneEnvironment } from './SceneEnvironment'
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

/**
 * The shadow-casting key light. A single directional light grounds the bodies with a crisp
 * shadow on the floor; its orthographic shadow camera is sized to the active container (plus
 * the ground beneath it) so the shadow stays sharp and never clips as modes change box size.
 * Resolution is modest (1024²) — the gated, low-count casters keep this cheap.
 */
function KeyLight({ containerSize }: { containerSize: number }) {
  const lightRef = useRef<THREE.DirectionalLight>(null)

  useEffect(() => {
    const light = lightRef.current
    if (!light) return
    const cam = light.shadow.camera
    // Cover the box plus margin for the floor contact; symmetric ortho frustum.
    const half = containerSize * 1.1
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.near = 0.1
    cam.far = containerSize * 8
    cam.updateProjectionMatrix()
    // Pull shadows in slightly to avoid acne/peter-panning on the matte ground.
    light.shadow.bias = -0.0008
    light.shadow.normalBias = 0.02
  }, [containerSize])

  return (
    <directionalLight
      ref={lightRef}
      position={[containerSize * 1.4, containerSize * 2, containerSize * 1.1]}
      intensity={2.1}
      castShadow
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
    />
  )
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
        // Slightly lift exposure so the IBL-lit, dark surfaces stay readable without washing
        // out; ACES keeps highlights from clipping before bloom thresholds them.
        renderer.toneMappingExposure = 1.1
        // Real-time shadow maps. Works on both the WebGPU and WebGL2 backends; soft PCF edges
        // suit the matte ground. Per-instance casting is gated by count in the renderers so
        // only modest-count modes pay for it (see CpuParticles/RapierBodies).
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        await renderer.init()
        return renderer
      }}
    >
      {/* Background stays the dark theme colour: the environment below is LIGHTING ONLY, never
          the backdrop, so the wireframe + dark void are preserved and bloom thresholds only the
          bright particles. */}
      <color attach="background" args={[theme.bgBase]} />

      {/* A low ambient fills shadowed sides; the IBL environment supplies the rest of the fill
          and the reflections. Kept dim so the key light and bloom still dominate. */}
      <ambientLight intensity={0.25} />
      <KeyLight containerSize={containerSize} />
      <SceneEnvironment containerSize={containerSize} />

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
