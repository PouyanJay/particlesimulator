import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { theme } from '../ui/theme'
import { ENV_MAP_INTENSITY } from './materialConstants'

/**
 * Builds a small procedural "studio" scene used only as input to the PMREM prefilter — a dark
 * room with a brighter overhead panel and two cooler side panels. This gives PBR surfaces a soft
 * directional ambient fill (top-lit) and a faint, tasteful reflection gradient without any
 * external HDRI download (offline/PWA-friendly) and without the chrome-showroom look.
 *
 * Built entirely from `three/webgpu` classes (not three's addon RoomEnvironment) so every object
 * comes from the SAME three build as the renderer — sidestepping the "two three copies" instanceof
 * hazard that bites cross-build PMREM/scene traversal. Emissive `MeshBasicNodeMaterial` boxes act
 * as area lights for the prefilter; they're disposed immediately after generation.
 */
function buildEnvironmentScene(): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene()
  const disposables: Array<{ dispose: () => void }> = []

  const panel = (
    color: THREE.ColorRepresentation,
    intensity: number,
    size: [number, number, number],
    position: [number, number, number],
  ): void => {
    const geometry = new THREE.BoxGeometry(...size)
    const material = new THREE.MeshBasicNodeMaterial()
    material.color = new THREE.Color(color).multiplyScalar(intensity)
    material.side = THREE.BackSide // faces inward, lighting the room interior
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...position)
    scene.add(mesh)
    disposables.push(geometry, material)
  }

  // Enclosing shell so reflections fall off to the backdrop colour. Sourced from the bgBase token
  // (not a literal) so the fall-off tracks the real background if the theme ever changes.
  panel(theme.bgBase, 1.0, [30, 30, 30], [0, 0, 0])
  // Bright overhead key — the dominant fill/reflection direction (top-down).
  panel(0xeaf0ff, 3.2, [16, 1, 16], [0, 12, 0])
  // Cooler, dimmer side fills for a subtle reflection gradient (not symmetric, so surfaces
  // get a gentle left/right falloff rather than a flat wash).
  panel(0x2a3550, 1.4, [1, 14, 14], [-12, 0, 0])
  panel(0x202838, 0.9, [1, 14, 14], [12, 0, 0])

  return {
    scene,
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}

/**
 * Image-based lighting + a shadow-receiving ground plane for all simulation modes.
 *
 * IBL: a *procedural* environment (built above, prefiltered through the WebGPU `PMREMGenerator`)
 * is assigned to `scene.environment` for soft ambient fill and subtle reflections on the PBR
 * bodies. It is LIGHTING ONLY — `scene.background` stays the dark theme colour (set in
 * SimulationCanvas), so the container wireframe and dark backdrop are preserved and bloom still
 * thresholds only the bright particles. No external/CDN HDRI is fetched, so the app stays
 * offline/PWA-friendly. The PMREM is generated once per renderer and disposed on unmount.
 *
 * WebGPU notes:
 *  - The PMREMGenerator exported from `three/webgpu` is the renderer-common one; `fromScene()`
 *    runs synchronously here because SimulationCanvas awaits `renderer.init()` before mounting
 *    the scene, so the backend is already initialised (no async/`fromSceneAsync` path needed).
 *  - `MeshStandardNodeMaterial` reads `scene.environment` automatically on both the WebGPU and
 *    WebGL2 backends, so IBL works identically in the `?forceWebGL` fallback.
 *
 * Ground plane: a large, dark, matte plane at the container floor that receives shadows so the
 * bodies look grounded instead of floating. It does not cast (nothing is below it) and is styled
 * to the dark theme so it reads as a soft surface, not a bright slab.
 */
export function SceneEnvironment({ containerSize }: { containerSize: number }) {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)

  // Build the prefiltered environment map once per renderer. Assigning it to scene.environment
  // (not scene.background) keeps it lighting-only. Regenerated only if the renderer changes.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = buildEnvironmentScene()
    // sigma > 0 blurs the prefilter so reflections read as soft sheen, not mirrored panels.
    // Keep the whole render target (not just its texture) so cleanup frees it completely.
    const renderTarget = pmrem.fromScene(env.scene, 0.5)
    const envTexture = renderTarget.texture

    const previous = scene.environment
    const previousIntensity = scene.environmentIntensity
    scene.environment = envTexture
    // On the node-material path, scene.environmentIntensity (not per-material envMapIntensity)
    // is the lever that scales scene.environment IBL — see ENV_MAP_INTENSITY's note.
    scene.environmentIntensity = ENV_MAP_INTENSITY

    env.dispose()
    pmrem.dispose()

    return () => {
      // Only clear if we still own it (a later mount may have replaced it).
      if (scene.environment === envTexture) {
        scene.environment = previous
        scene.environmentIntensity = previousIntensity
      }
      renderTarget.dispose() // frees the prefiltered env map (its texture included)
    }
  }, [gl, scene])

  // Ground sits at the container floor, scaled well beyond the box so it reads as an infinite
  // floor (not a tile) and its edges never poke through the wireframe. Rotated to face up,
  // matte and dark per the theme. R3F owns the geometry/material lifecycle (declarative JSX,
  // matching the container box) so there's no manual dispose to race with StrictMode.
  const floorY = -containerSize / 2
  const groundExtent = containerSize * 12

  return (
    <mesh
      position={[0, floorY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      // The ground is decor, not part of the simulation bounds.
      frustumCulled={false}
    >
      <planeGeometry args={[groundExtent, groundExtent]} />
      {/* Node material so it lights identically on WebGPU and the WebGL2 fallback. */}
      <meshStandardNodeMaterial color={theme.canvasGround} roughness={0.95} metalness={0} />
    </mesh>
  )
}
