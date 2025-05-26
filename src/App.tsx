import { useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { OrbitControls } from '@react-three/drei'
import './App.css'
import PhysicsContainer, { calculateMaxAllowableParticles } from './components/PhysicsContainer'
import ControlPanel from './components/ControlPanel'
import SpeedGraph from './components/SpeedGraph'
import CollisionGraph from './components/CollisionGraph'
import Logo from './components/Logo'

// Define type for density warning data
type DensityWarningData = {
  packingRatio: number;
  warningLevel: 'none' | 'warning' | 'critical';
  particlesPerAxis: number;
  averageSpacing: number;
  maxAllowableParticles: number;
  exceedsMaximum: boolean;
};

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
  const [dynamicContainerSize, setDynamicContainerSize] = useState(false) // Default to fixed container size
  
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
  
  // Density warning state
  const [densityWarning, setDensityWarning] = useState<DensityWarningData>({
    packingRatio: 0,
    warningLevel: 'none',
    particlesPerAxis: 0,
    averageSpacing: 0,
    maxAllowableParticles: 0,
    exceedsMaximum: false
  });
  
  // Track if we're currently enforcing a particle count adjustment
  const [enforcingParticleLimit, setEnforcingParticleLimit] = useState(false);
  
  // UI state
  const [controlPanelVisible, setControlPanelVisible] = useState(true) // Control panel visibility state
  const [isCompactMode, setIsCompactMode] = useState(false) // Compact mode state
  
  // Window size tracking for responsive layout
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  
  // Detect screen size on mount and window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 768);
    };
    
    // Call once on mount
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Function to handle receiving speed data from PhysicsContainer
  const handleSpeedUpdate = (speed: number) => {
    setCurrentSpeed(speed);
  };
  
  // Function to handle receiving collision count data from PhysicsContainer
  const handleCollisionUpdate = (collisions: number) => {
    setCurrentCollisionCount(collisions);
  };

  // Handle density warning from PhysicsContainer
  const handleDensityWarning = (warning: DensityWarningData) => {
    setDensityWarning(warning);
    
    // If particle count exceeds maximum and we're not already enforcing a limit
    if (warning.exceedsMaximum && !enforcingParticleLimit) {
      setEnforcingParticleLimit(true);
      
      // Set particle count to the maximum allowed value
      setParticleCount(warning.maxAllowableParticles);
      
      // Reset the enforcement flag after a delay
      setTimeout(() => setEnforcingParticleLimit(false), 100);
    }
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
    // Don't automatically change restitution and friction coefficient
    // Let the user control these parameters independently
    
    // Don't update physicsKey for friction changes - let the PhysicsContainer handle this
  }, [gravity, particleParticleFriction, particleWallFriction, frictionCoefficient]);
  
  // Handle deltaTime changes separately to avoid unnecessary full resets
  useEffect(() => {
    // Ensure deltaTime is never zero
    if (deltaTime <= 0) {
      setDeltaTime(0.01);
      return;
    }
    
    // Only update physics key for deltaTime changes since this affects the Physics world timeStep
    setPhysicsKey((prev: number) => prev + 1);
  }, [deltaTime]);
  
  // Update physics when particle parameters change without full reset
  useEffect(() => {
    // Don't update physicsKey for these parameters - let the PhysicsContainer handle this
  }, [particleCount, particleSize, initialVelocity, dynamicContainerSize])

  // Determine proper physics settings based on deltaTime only (not friction)
  const baseTimeStep = 1/90   // Use consistent timeStep regardless of friction
  
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

  // Calculate max allowable particles for display in the UI
  const maxAllowableParticles = calculateMaxAllowableParticles(
    particleSize, 
    dynamicContainerSize ? getContainerSize(particleCount) : 2.5 // Use same logic as PhysicsContainer
  );
  
  // Function to get container size (duplicated from PhysicsContainer for UI calculation)
  function getContainerSize(count: number): number {
    const scaleFactor = Math.pow(count / 100, 1/3);
    const boundedScaleFactor = Math.max(0.8, Math.min(2.0, scaleFactor));
    return 2.5 * boundedScaleFactor;
  }

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Space to toggle play/pause
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setIsPlaying(prev => !prev);
      }
      
      // R to reset
      if (event.code === 'KeyR' && !event.repeat) {
        event.preventDefault();
        handleReset();
      }
      
      // C to toggle compact mode
      if (event.code === 'KeyC' && !event.repeat && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setIsCompactMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="app-container">
      {/* Toggle button for control panel on mobile */}
      <button 
        className="control-panel-toggle"
        onClick={() => setControlPanelVisible(!controlPanelVisible)}
        aria-label={controlPanelVisible ? "Hide controls" : "Show controls"}
      >
        {controlPanelVisible ? "×" : "≡"}
      </button>
      
      <div className={`control-panel ${controlPanelVisible ? 'visible' : 'hidden'} ${isCompactMode ? 'compact' : ''}`}>
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
            dynamicContainerSize={dynamicContainerSize}
            setDynamicContainerSize={setDynamicContainerSize}
            maxParticleCount={Math.min(500, maxAllowableParticles)}
            isCompactMode={isCompactMode}
          />
        </div>
      </div>
      <div className={`simulation-container ${isMobileView ? 'simulation-container-mobile' : ''}`}>
        {/* Mobile view - graphs container at the top */}
        {isMobileView && (
          <div className="mobile-graphs-container">
            {speedGraphVisible && (
              <SpeedGraph 
                data={speedHistory} 
                currentSpeed={currentSpeed} 
                initialVelocity={initialVelocity}
                isVisible={speedGraphVisible}
                onVisibilityChange={setSpeedGraphVisible}
                isMobileView={isMobileView}
              />
            )}
            
            {collisionGraphVisible && (
              <CollisionGraph
                data={collisionHistory}
                currentCollisionCount={currentCollisionCount}
                initialVelocity={initialVelocity}
                isVisible={collisionGraphVisible}
                onVisibilityChange={setCollisionGraphVisible}
                speedGraphVisible={speedGraphVisible}
                isMobileView={isMobileView}
              />
            )}
          </div>
        )}
        
        {/* Canvas - particle simulation */}
        <Canvas camera={{ position: [6, 6, 6], fov: 45 }}>
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[10, 10, 10]} intensity={1.2} />
          <Physics
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
              dynamicContainerSize={dynamicContainerSize}
              onActiveParticlesChange={setActiveParticles}
              onSpeedUpdate={handleSpeedUpdate}
              onCollisionCountUpdate={handleCollisionUpdate}
              onDensityWarning={handleDensityWarning}
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
        
        {/* Desktop view - floating graphs */}
        {!isMobileView && (
          <>
            <SpeedGraph 
              data={speedHistory} 
              currentSpeed={currentSpeed} 
              initialVelocity={initialVelocity}
              isVisible={speedGraphVisible}
              onVisibilityChange={setSpeedGraphVisible}
            />
            
            <CollisionGraph
              data={collisionHistory}
              currentCollisionCount={currentCollisionCount}
              initialVelocity={initialVelocity}
              isVisible={collisionGraphVisible}
              onVisibilityChange={setCollisionGraphVisible}
              speedGraphVisible={speedGraphVisible}
            />
          </>
        )}
        
        <div className="simulation-status">
          {isPlaying ? "Running" : "Paused"} • {activeParticles} active particles • Restitution: {restitution.toFixed(3)} • Friction: {frictionCoefficient.toFixed(3)} • Max Particles: {maxAllowableParticles}
          {isHighDeltaTime && <span style={{ color: 'orange', marginLeft: '8px' }}> ⚠️ High simulation speed may cause instability</span>}
        </div>
        
        {/* Particle Limit Exceeded Warning */}
        {particleCount >= maxAllowableParticles && (
          <div className="density-warning density-warning-critical" style={{ bottom: '60px' }}>
            <span className="warning-icon">⚠️</span>
            <div className="warning-content">
              <h3>Maximum Particle Limit Reached</h3>
              <p>
                The number of particles has been capped at {maxAllowableParticles} based on current settings.
              </p>
              <p className="warning-explanation">
                This limit is calculated based on the container size ({dynamicContainerSize ? getContainerSize(particleCount).toFixed(2) : '2.5'} units) and 
                particle size ({particleSize} units) to maintain simulation stability.
              </p>
              <p className="warning-suggestion">
                To add more particles, try decreasing particle size or enabling dynamic container scaling.
              </p>
            </div>
          </div>
        )}
        
        {densityWarning.warningLevel !== 'none' && (
          <div className={`density-warning density-warning-${densityWarning.warningLevel}`}>
            <span className="warning-icon">
              {densityWarning.warningLevel === 'critical' ? '⛔' : '⚠️'}
            </span>
            <div className="warning-content">
              <h3>{densityWarning.warningLevel === 'critical' ? 'Critical Density Warning' : 'Density Warning'}</h3>
              <p>
                {densityWarning.warningLevel === 'critical' 
                  ? 'Extremely high particle density detected. Collision detection accuracy is significantly reduced.'
                  : 'High particle density detected. Collision detection may be less accurate.'}
              </p>
              <ul className="warning-details">
                <li><strong>Packing ratio:</strong> {(densityWarning.packingRatio * 100).toFixed(1)}%</li>
                <li><strong>Particles per axis:</strong> ~{densityWarning.particlesPerAxis.toFixed(1)}</li>
                <li><strong>Average spacing:</strong> {densityWarning.averageSpacing.toFixed(2)}× particle diameter</li>
              </ul>
              <p className="warning-explanation">
                {densityWarning.warningLevel === 'critical'
                  ? `The current configuration exceeds 60% of the theoretical packing limit for spheres. 
                     At this density, particles have insufficient space to move freely, causing the physics engine 
                     to miss or incorrectly calculate collisions.`
                  : `The current configuration exceeds 40% of the theoretical packing limit for spheres.
                     As particles become more densely packed, collision detection becomes less accurate 
                     due to limited space for particle movement.`}
              </p>
              <p className="warning-suggestion">
                Try reducing particle count, decreasing particle size, or enabling "Scale Container with Particle Count"
                to improve simulation accuracy.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
