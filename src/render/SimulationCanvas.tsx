import './webgpu' // registers three/webgpu JSX elements; must load before <Canvas>
import * as THREE from 'three/webgpu'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ParticleField } from './ParticleField'
import { useParamStore } from '../state/paramStore'
import { theme } from '../ui/theme'

// Fallback when the active mode has no `containerSize` param. TODO(phase-1): expose
// container bounds via mode metadata / ParticleBuffers rather than reading a param by
// name here, so the render shell stays mode-agnostic.
const FALLBACK_CONTAINER_SIZE = 2.5

// Append `?forceWebGL` to the URL to force the WebGL2 backend — used to verify that the
// WebGPU and fallback paths render identically (CLAUDE.md fallback-parity requirement).
const FORCE_WEBGL =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('forceWebGL')

/** The 3D viewport: lighting, the container wireframe, orbit controls, and the particles. */
export function SimulationCanvas() {
  const containerSize = useParamStore((s) =>
    typeof s.params.containerSize === 'number' ? s.params.containerSize : FALLBACK_CONTAINER_SIZE,
  )

  return (
    <Canvas
      camera={{ position: [4, 4, 4], fov: 45 }}
      dpr={[1, 2]}
      // WebGPURenderer picks the WebGPU backend when available and falls back to WebGL2
      // otherwise (or when ?forceWebGL is set). Awaited via R3F 9's async `gl` prop.
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer({
          ...props,
          forceWebGL: FORCE_WEBGL,
        } as ConstructorParameters<typeof THREE.WebGPURenderer>[0])
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

      <OrbitControls enablePan enableZoom enableRotate minDistance={2} maxDistance={20} makeDefault />
    </Canvas>
  )
}
