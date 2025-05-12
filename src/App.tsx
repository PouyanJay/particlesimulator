import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { OrbitControls } from '@react-three/drei'
import './App.css'
import PhysicsContainer from './components/PhysicsContainer'
import ControlPanel from './components/ControlPanel'
import Logo from './components/Logo'

function App() {
  // Physics simulation states
  const [particleParticleFriction, setParticleParticleFriction] = useState(true)
  const [particleWallFriction, setParticleWallFriction] = useState(false)
  const [gravity, setGravity] = useState(false)
  const [deltaTime, setDeltaTime] = useState(0.5) // Default deltaTime
  const [isPlaying, setIsPlaying] = useState(true)
  
  // New parameters
  const [restitution, setRestitution] = useState(0.999) // Default restitution
  const [particleCount, setParticleCount] = useState(100) // Default particle count
  const [particleSize, setParticleSize] = useState(0.08) // Default particle size
  const [initialVelocity, setInitialVelocity] = useState(1.0) // Default initial velocity
  
  // Add key to force physics container to re-render on reset
  const [resetKey, setResetKey] = useState(0)
  const [physicsKey, setPhysicsKey] = useState(0)

  // Active particle count for status display
  const [activeParticles, setActiveParticles] = useState(0)

  const handleReset = () => {
    // Increment reset key to force re-render
    setResetKey((prev: number) => prev + 1)
    setPhysicsKey((prev: number) => prev + 1)
    
    // Pause and then resume the simulation
    setIsPlaying(false)
    setTimeout(() => setIsPlaying(true), 100)
  }

  // Reset physics when simulation parameters change
  useEffect(() => {
    setPhysicsKey((prev: number) => prev + 1)
  }, [gravity, particleParticleFriction, particleWallFriction, deltaTime])
  
  // Reset simulation when particle parameters change
  useEffect(() => {
    handleReset()
  }, [particleCount, particleSize, initialVelocity])

  // Determine proper physics settings based on friction state and deltaTime
  const baseTimeStep = (!particleParticleFriction && !particleWallFriction) 
    ? 1/240  // Use smaller timestep for zero-friction case for better stability
    : 1/60   // Regular timestep for normal cases
  
  // Scale timeStep by deltaTime (clamped to ensure stability)
  const timeStep = baseTimeStep * Math.max(0.1, Math.min(2.0, deltaTime))

  return (
    <div className="app-container">
      <div className="control-panel">
        <div className="control-section-blur">
          <Logo />
        </div>
        <div className="control-panel-inner">
          <ControlPanel
            particleParticleFriction={particleParticleFriction}
            setParticleParticleFriction={setParticleParticleFriction}
            particleWallFriction={particleWallFriction}
            setParticleWallFriction={setParticleWallFriction}
            gravity={gravity}
            setGravity={setGravity}
            deltaTime={deltaTime}
            setDeltaTime={setDeltaTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onReset={handleReset}
            restitution={restitution}
            setRestitution={setRestitution}
            particleCount={particleCount}
            setParticleCount={setParticleCount}
            particleSize={particleSize}
            setParticleSize={setParticleSize}
            initialVelocity={initialVelocity}
            setInitialVelocity={setInitialVelocity}
          />
        </div>
      </div>
      <div className="simulation-container">
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[10, 10, 10]} intensity={1.2} />
          <Physics
            key={physicsKey}
            gravity={gravity ? [0, -9.81, 0] : [0, 0, 0]}
            timeStep={timeStep}
            paused={!isPlaying}
            interpolate={true}
            colliders={false}
            debug={false}
            substeps={3} // Add substeps for better stability
          >
            <PhysicsContainer
              key={resetKey}
              particleParticleFriction={particleParticleFriction}
              particleWallFriction={particleWallFriction}
              gravity={gravity}
              restitution={restitution}
              particleCount={particleCount}
              particleSize={particleSize}
              initialVelocity={initialVelocity}
              onActiveParticlesChange={setActiveParticles}
            />
          </Physics>
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
        
        <div className="simulation-status">
          {isPlaying ? "Running" : "Paused"} • {activeParticles} active particles • Restitution: {restitution.toFixed(3)}
        </div>
      </div>
    </div>
  )
}

export default App
