import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { OrbitControls } from '@react-three/drei'
import './App.css'
import PhysicsContainer from './components/PhysicsContainer'
import ControlPanel from './components/ControlPanel'
import SpeedGraph from './components/SpeedGraph'
import CollisionGraph from './components/CollisionGraph'
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
  const [collisionFadeDuration, setCollisionFadeDuration] = useState(0.5) // Default collision fade duration
  
  // Add key to force physics container to re-render on reset
  const [resetKey, setResetKey] = useState(0)
  const [physicsKey, setPhysicsKey] = useState(0)

  // Active particle count for status display
  const [activeParticles, setActiveParticles] = useState(0)
  
  // Speed tracking for graph
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [speedHistory, setSpeedHistory] = useState<number[]>([0, 0]) // Initialize with placeholder data
  const speedUpdateInterval = useRef<number | null>(null)
  const elapsedTimeRef = useRef<number>(0) // Track elapsed simulation time
  
  // Collision tracking for graph
  const [currentCollisionCount, setCurrentCollisionCount] = useState(0)
  const [collisionHistory, setCollisionHistory] = useState<number[]>([0, 0]) // Initialize with placeholder data
  const collisionUpdateInterval = useRef<number | null>(null)
  
  // Graph visibility states for coordinating positions
  const [speedGraphVisible, setSpeedGraphVisible] = useState(true)
  const [collisionGraphVisible, setCollisionGraphVisible] = useState(true)
  
  // Function to handle receiving speed data from PhysicsContainer
  const handleSpeedUpdate = (speed: number) => {
    setCurrentSpeed(speed);
  };
  
  // Function to handle receiving collision count data from PhysicsContainer
  const handleCollisionUpdate = (collisions: number) => {
    setCurrentCollisionCount(collisions);
  };

  // Update speed history at a controlled rate (twice per second)
  useEffect(() => {
    // Clean up any existing interval
    if (speedUpdateInterval.current) {
      clearInterval(speedUpdateInterval.current);
      speedUpdateInterval.current = null;
    }
    
    // Only set up the interval if we're playing
    if (isPlaying) {
      // Function to update speed history
      const updateSpeedHistory = () => {
        setSpeedHistory(prevHistory => {
          const newHistory = [...prevHistory, currentSpeed];
          return newHistory.length > 100 ? newHistory.slice(-100) : newHistory;
        });
      };
      
      // Start with current speed value
      updateSpeedHistory();
      
      // Set interval to update regularly
      speedUpdateInterval.current = window.setInterval(updateSpeedHistory, 500);
    }
    
    // Clean up on unmount
    return () => {
      if (speedUpdateInterval.current) {
        clearInterval(speedUpdateInterval.current);
        speedUpdateInterval.current = null;
      }
    };
  }, [isPlaying, currentSpeed]);
  
  // Update collision history at a controlled rate (twice per second)
  useEffect(() => {
    // Clean up any existing interval
    if (collisionUpdateInterval.current) {
      clearInterval(collisionUpdateInterval.current);
      collisionUpdateInterval.current = null;
    }
    
    // Only set up the interval if we're playing
    if (isPlaying) {
      // Function to update collision history
      const updateCollisionHistory = () => {
        setCollisionHistory(prevHistory => {
          const newHistory = [...prevHistory, currentCollisionCount];
          return newHistory.length > 100 ? newHistory.slice(-100) : newHistory;
        });
      };
      
      // Start with current collision count
      updateCollisionHistory();
      
      // Set interval to update regularly (same as speed updates)
      collisionUpdateInterval.current = window.setInterval(updateCollisionHistory, 500);
    }
    
    // Clean up on unmount
    return () => {
      if (collisionUpdateInterval.current) {
        clearInterval(collisionUpdateInterval.current);
        collisionUpdateInterval.current = null;
      }
    };
  }, [isPlaying, currentCollisionCount]);

  // Reset graphs when simulation is reset
  useEffect(() => {
    // Reset to initial state with placeholder data points
    setSpeedHistory([0, 0]);
    setCollisionHistory([0, 0]);
    elapsedTimeRef.current = 0; // Reset elapsed time on simulation reset
  }, [resetKey]);

  const handleReset = () => {
    // Increment reset key to force re-render
    setResetKey((prev: number) => prev + 1)
    setPhysicsKey((prev: number) => prev + 1)
    
    // Reset speed history and elapsed time
    setSpeedHistory([0, 0])
    elapsedTimeRef.current = 0;
    
    // Pause and then resume the simulation
    setIsPlaying(false)
    setTimeout(() => setIsPlaying(true), 100)
  }

  // Reset physics when simulation parameters change
  useEffect(() => {
    // When there is no friction, set default values for friction-related properties
    if (!particleParticleFriction && !particleWallFriction) {
      setRestitution(1.0); // Perfect elasticity when no friction
      setFrictionCoefficient(0.0); // Zero friction coefficient
    }
    
    setPhysicsKey((prev: number) => prev + 1);
  }, [gravity, particleParticleFriction, particleWallFriction, frictionCoefficient]);
  
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
            collisionFadeDuration={collisionFadeDuration}
            setCollisionFadeDuration={setCollisionFadeDuration}
          />
        </div>
      </div>
      <div className="simulation-container">
        <Canvas camera={{ position: [6, 6, 6], fov: 45 }}>
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
              collisionFadeDuration={collisionFadeDuration}
              onActiveParticlesChange={setActiveParticles}
              onSpeedUpdate={handleSpeedUpdate}
              onCollisionCountUpdate={handleCollisionUpdate}
            />
          </Physics>
          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            minDistance={5} 
            maxDistance={15}
            target={[0, 0, 0]}
          />
        </Canvas>
        
        {/* Speed Graph - positioned through CSS */}
        <SpeedGraph 
          data={speedHistory} 
          currentSpeed={currentSpeed} 
          initialVelocity={initialVelocity}
          isVisible={speedGraphVisible}
          onVisibilityChange={setSpeedGraphVisible}
        />
        
        {/* Collision Graph - positioned through CSS */}
        <CollisionGraph
          data={collisionHistory}
          currentCollisionCount={currentCollisionCount}
          initialVelocity={initialVelocity}
          isVisible={collisionGraphVisible}
          onVisibilityChange={setCollisionGraphVisible}
          speedGraphVisible={speedGraphVisible}
        />
        
        <div className="simulation-status">
          {isPlaying ? "Running" : "Paused"} • {activeParticles} active particles • Restitution: {restitution.toFixed(3)} • Friction: {frictionCoefficient.toFixed(3)}
          {isHighDeltaTime && <span style={{ color: 'orange', marginLeft: '8px' }}> ⚠️ High simulation speed may cause instability</span>}
        </div>
      </div>
    </div>
  )
}

export default App
