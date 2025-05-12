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
  const [frictionCoefficient, setFrictionCoefficient] = useState(0.1) // Default friction coefficient
  
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
  }, [gravity, particleParticleFriction, particleWallFriction, frictionCoefficient])
  
  // Handle deltaTime changes separately to avoid unnecessary full resets
  useEffect(() => {
    // Ensure deltaTime is never zero
    if (deltaTime <= 0) {
      setDeltaTime(0.01);
      return;
    }
    
    // No need to fully reset, just update the physics key
    setPhysicsKey((prev: number) => prev + 1);
  }, [deltaTime]);

  // Reset simulation when particle parameters change
  useEffect(() => {
    handleReset()
  }, [particleCount, particleSize, initialVelocity])

  // Determine proper physics settings based on friction state and deltaTime
  const baseTimeStep = (!particleParticleFriction && !particleWallFriction) 
    ? 1/180  // Less extreme difference (changed from 1/240)
    : 1/90   // More precision for normal cases (changed from 1/60)
  
  // Scale timeStep by deltaTime with a wider range of effect (0.01 to 5.0)
  // Using a non-linear scale for better control at lower values
  // For values over 1.0, we use a different scaling to prevent extreme instability
  const scaledDeltaTime = deltaTime <= 1.0 
    ? Math.pow(deltaTime, 1.5) * 2.0  // Original scaling for 0.01-1.0
    : 2.0 + Math.pow(deltaTime - 1.0, 0.75) * 1.5;  // Gentler scaling for 1.0-5.0

  // Ensure it's never zero or extremely small with Math.max
  const timeStep = Math.max(0.0001, baseTimeStep * scaledDeltaTime);

  // Add a warning for high deltaTime values
  const isHighDeltaTime = deltaTime > 3.0;

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
            frictionCoefficient={frictionCoefficient}
            setFrictionCoefficient={setFrictionCoefficient}
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
              frictionCoefficient={frictionCoefficient}
              onActiveParticlesChange={setActiveParticles}
            />
          </Physics>
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
        
        <div className="simulation-status">
          {isPlaying ? "Running" : "Paused"} • {activeParticles} active particles • Restitution: {restitution.toFixed(3)} • Friction: {frictionCoefficient.toFixed(3)}
          {isHighDeltaTime && <span style={{ color: 'orange', marginLeft: '8px' }}> ⚠️ High simulation speed may cause instability</span>}
        </div>
      </div>
    </div>
  )
}

export default App
