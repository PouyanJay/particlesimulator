import { useRef, useState, useEffect, useMemo } from 'react'
import * as Rapier from '@react-three/rapier'
import * as THREE from 'three'
import * as Fiber from '@react-three/fiber'

// Use components from namespaces
const { RigidBody, CuboidCollider, BallCollider } = Rapier
const { useFrame } = Fiber

// Define RapierRigidBody type
type RapierRigidBody = any

interface PhysicsContainerProps {
  particleParticleFriction: boolean
  particleWallFriction: boolean
  gravity?: boolean
  // New parameters
  restitution?: number
  particleCount?: number
  particleSize?: number
  initialVelocity?: number
  frictionCoefficient?: number
  onActiveParticlesChange?: (count: number) => void
  onSpeedUpdate?: (speed: number) => void
}

// Container dimensions
const CONTAINER_SIZE = 2.5
const HALF_SIZE = CONTAINER_SIZE / 2
const WALL_THICKNESS = 0.05

// Define the particle instance type
interface Particle {
  id: number
  position: [number, number, number]
  velocity: [number, number, number]
}

// Create a debug object for logging (to avoid console spam)
const DEBUG = {
  logCount: 0,
  maxLogs: 10,
  issues: new Set<string>(),
  
  log: (msg: string, ...args: any[]) => {
    if (DEBUG.logCount < DEBUG.maxLogs) {
      console.log(msg, ...args)
      DEBUG.logCount++
    }
  },
  
  logIssue: (issueType: string, details: any) => {
    const key = `${issueType}-${JSON.stringify(details)}`
    if (!DEBUG.issues.has(key)) {
      console.warn(`PHYSICS ISSUE DETECTED [${issueType}]:`, details)
      DEBUG.issues.add(key)
    }
  }
}

// Function to generate initial particles data
const generateParticles = (
  count: number, 
  size: number, 
  maxVelocity: number,
  containerSize: number
): { 
  particles: Particle[], 
  radius: number 
} => {
  const particles: Particle[] = []
  const radius = size
  const halfSize = containerSize / 2
  const padding = radius * 2
  
  for (let i = 0; i < count; i++) {
    // Random position inside container with padding
    const x = (Math.random() * (containerSize - padding * 2) - halfSize + padding)
    const y = (Math.random() * (containerSize - padding * 2) - halfSize + padding)
    const z = (Math.random() * (containerSize - padding * 2) - halfSize + padding)
    
    // Random velocity with speed based on initialVelocity parameter
    const speed = (0.5 + Math.random() * 0.5) * maxVelocity
    const phi = Math.random() * Math.PI * 2
    const theta = Math.random() * Math.PI
    
    // Convert from spherical to cartesian coordinates for uniform direction distribution
    const vx = speed * Math.sin(theta) * Math.cos(phi)
    const vy = speed * Math.sin(theta) * Math.sin(phi)
    const vz = speed * Math.cos(theta)
    
    particles.push({
      id: i,
      position: [x, y, z] as [number, number, number],
      velocity: [vx, vy, vz] as [number, number, number],
    })
  }
  
  return { particles, radius }
}

// Function to check if a velocity has invalid values
const hasInvalidVelocity = (vel: { x: number, y: number, z: number }) => {
  return isNaN(vel.x) || isNaN(vel.y) || isNaN(vel.z) ||
         !isFinite(vel.x) || !isFinite(vel.y) || !isFinite(vel.z) ||
         Math.abs(vel.x) > 100 || Math.abs(vel.y) > 100 || Math.abs(vel.z) > 100 // Lower threshold
}

const PhysicsContainer: React.FC<PhysicsContainerProps> = ({
  particleParticleFriction,
  particleWallFriction,
  gravity = false,
  // New parameters with defaults
  restitution = 0.999,
  particleCount = 100,
  particleSize = 0.08,
  initialVelocity = 1.0,
  frictionCoefficient = 0.1,
  onActiveParticlesChange,
  onSpeedUpdate
}) => {
  // Use counter to force re-render on reset
  const [resetCounter, setResetCounter] = useState(0)
  
  // Generate particles
  const { particles, radius } = useMemo(() => 
    generateParticles(
      particleCount, 
      particleSize, 
      initialVelocity,
      CONTAINER_SIZE
    ), 
    [resetCounter, particleCount, particleSize, initialVelocity, CONTAINER_SIZE]
  )
  
  // Store references to rigid bodies to monitor/correct velocities
  const particleRefs = useRef<RapierRigidBody[]>([])
  
  // Reset counter for checking status
  const statusCheckCounter = useRef(0)
  
  // Debug state to track issues
  const [hasDetectedIssue, setHasDetectedIssue] = useState(false)
  
  // Simulation active state
  const [simulationActive, setSimulationActive] = useState(true)
  
  // Keep track of last activity time to detect stalls
  const lastActivityTime = useRef(Date.now())
  
  // Calculate effective damping based on friction coefficient - NEW
  const effectiveDamping = useMemo(() => {
    // Only apply damping when friction is enabled
    if (!particleParticleFriction && !particleWallFriction) return 0;
    
    // Scale damping with friction coefficient (less damping at low friction)
    return Math.pow(frictionCoefficient, 1.5) * 0.1;
  }, [frictionCoefficient, particleParticleFriction, particleWallFriction]);
  
  // For restitution, ensure perfect elasticity when no friction
  const effectiveRestitution = useMemo(() => {
    return (!particleParticleFriction && !particleWallFriction) ? 1.0 : restitution;
  }, [restitution, particleParticleFriction, particleWallFriction]);
  
  // For friction coefficient, ensure zero when no friction
  const effectiveFrictionCoefficient = useMemo(() => {
    return (!particleParticleFriction && !particleWallFriction) ? 0.0 : frictionCoefficient;
  }, [frictionCoefficient, particleParticleFriction, particleWallFriction]);
  
  // Force container re-render when frictions or gravity change
  useEffect(() => {
    setResetCounter(prev => prev + 1)
    // Clean up refs when we reset
    particleRefs.current = []
    // Reset debug state
    DEBUG.logCount = 0
    DEBUG.issues.clear()
    setHasDetectedIssue(false)
    setSimulationActive(true)
    lastActivityTime.current = Date.now()
  }, [particleParticleFriction, particleWallFriction, gravity, particleCount, particleSize, initialVelocity, restitution])

  // Rotate the container for an isometric view
  const groupRef = useRef<THREE.Group>(null)
  useEffect(() => {
    if (groupRef.current) {
      // Set rotation for true isometric view (approx. 35.264° around Y, then 45° around Z)
      groupRef.current.rotation.y = Math.PI / 4;     // 45 degrees around Y axis
      groupRef.current.rotation.x = Math.atan(1/Math.sqrt(2));  // ~35.264 degrees for isometric view
    }
  }, [])
  
  // Store original speeds of particles to maintain constant speed
  const particleSpeeds = useRef<Map<number, number>>(new Map())
  
  // Initialize particle speeds
  useEffect(() => {
    particleSpeeds.current.clear()
    particles.forEach((particle, index) => {
      const v = particle.velocity
      const speed = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
      particleSpeeds.current.set(index, speed)
    })
  }, [particles])
  
  // Frame counter to control frequency of checks
  const frameCounter = useRef(0)
  
  // Check velocities after initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      let allValid = true
      particleRefs.current.forEach((body, index) => {
        if (body) {
          try {
            const vel = body.linvel()
            if (hasInvalidVelocity(vel)) {
              allValid = false
              DEBUG.logIssue('INITIAL_INVALID_VELOCITY', {
                particleIndex: index,
                velocity: vel
              })
            }
          } catch (error) {
            allValid = false
            DEBUG.logIssue('INITIAL_VELOCITY_CHECK_ERROR', {
              particleIndex: index,
              error: String(error)
            })
          }
        }
      })
      
      if (allValid) {
        DEBUG.log('All particles have valid initial velocities')
      }
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [resetCounter])
  
  // Set up periodic check to ensure simulation is still running
  useEffect(() => {
    const stallCheckInterval = setInterval(() => {
      // Only reset if truly stalled - increased from 3 to 5 seconds and lowered the activity threshold
      if (Date.now() - lastActivityTime.current > 5000 && simulationActive) {
        console.log('Simulation appears stalled, resetting particle velocities...')
        
        // Check if there's any movement at all before resetting
        let hasMovement = false;
        particleRefs.current.forEach((body) => {
          if (body) {
            try {
              const vel = body.linvel();
              const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
              if (speed > 0.005) { // Very low threshold to detect any movement
                hasMovement = true;
              }
            } catch (error) {
              // Ignore errors
            }
          }
        });
        
        // Only reset if there's really no movement
        if (!hasMovement) {
          // Reset velocities for all particles
          particleRefs.current.forEach((body, index) => {
            if (body) {
              try {
                const originalSpeed = particleSpeeds.current.get(index) || initialVelocity
                const safeSpeed = Math.min(originalSpeed, 2.0)
                
                const phi = Math.random() * Math.PI * 2
                const theta = Math.random() * Math.PI
                
                const vx = safeSpeed * Math.sin(theta) * Math.cos(phi)
                const vy = safeSpeed * Math.sin(theta) * Math.sin(phi)
                const vz = safeSpeed * Math.cos(theta)
                
                body.setLinvel({ x: vx, y: vy, z: vz }, true)
              } catch (error) {
                // Ignore errors
              }
            }
          });
          
          lastActivityTime.current = Date.now();
        }
      }
    }, 1000);
    
    return () => clearInterval(stallCheckInterval);
  }, [simulationActive, initialVelocity]);
  
  // Report active particles count
  useEffect(() => {
    if (onActiveParticlesChange) {
      onActiveParticlesChange(particleCount);
    }
  }, [particleCount, onActiveParticlesChange]);
  
  // Use a more conservative approach to handle the zero-friction case
  useFrame(() => {
    // Only check every 2nd frame - frequent enough to catch issues but not every frame
    frameCounter.current = (frameCounter.current + 1) % 2
    if (frameCounter.current !== 0) return
    
    // Count active (non-sleeping) particles and check velocities
    let activeCount = 0
    let totalVelocityMagnitude = 0
    let particlesChecked = 0
    
    particleRefs.current.forEach((body, index) => {
      if (!body) return
      
      try {
        const vel = body.linvel()
        particlesChecked++
        
        // Calculate current velocity magnitude
        const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z)
        totalVelocityMagnitude += currentSpeed
        
        // Check if the particle is moving (not sleeping)
        const isActive = !body.isSleeping() && currentSpeed > 0.01
        if (isActive) {
          activeCount++
        }
        
        // For all particles (not just zero-friction mode), apply basic corrections
        // Skip if velocity contains invalid values and reset it
        if (hasInvalidVelocity(vel)) {
          // Reset to a safe random velocity with the original speed
          const originalSpeed = particleSpeeds.current.get(index) || 0.5
          const safeSpeed = Math.min(originalSpeed, 2.0) // Cap the speed to prevent instability
          
          const phi = Math.random() * Math.PI * 2
          const theta = Math.random() * Math.PI
          
          const vx = safeSpeed * Math.sin(theta) * Math.cos(phi)
          const vy = safeSpeed * Math.sin(theta) * Math.sin(phi)
          const vz = safeSpeed * Math.cos(theta)
          
          body.setLinvel({ x: vx, y: vy, z: vz }, true)
          lastActivityTime.current = Date.now()
          return
        }
        
        // Special handling for zero-friction mode
        if (!particleParticleFriction && !particleWallFriction) {
          // If speed is almost zero, give it a small push
          if (currentSpeed < 0.05) {
            const originalSpeed = Math.min(particleSpeeds.current.get(index) || 0.5, 1.0)
            const phi = Math.random() * Math.PI * 2
            const theta = Math.random() * Math.PI
            
            const vx = originalSpeed * Math.sin(theta) * Math.cos(phi)
            const vy = originalSpeed * Math.sin(theta) * Math.sin(phi)
            const vz = originalSpeed * Math.cos(theta)
            
            body.setLinvel({ x: vx, y: vy, z: vz }, true)
            lastActivityTime.current = Date.now()
            return
          }
          
          // If speed is too high, cap it to prevent instability
          if (currentSpeed > 10.0) {
            const scale = 10.0 / currentSpeed
            body.setLinvel({ 
              x: vel.x * scale, 
              y: vel.y * scale, 
              z: vel.z * scale 
            }, true)
            lastActivityTime.current = Date.now()
            return
          }
          
          // Conservative speed correction
          // Only apply for deviations > 15% and cap max speed at 5.0
          const originalSpeed = particleSpeeds.current.get(index)
          if (originalSpeed && 
              Math.abs(currentSpeed - originalSpeed) / originalSpeed > 0.15 &&
              currentSpeed < originalSpeed * 0.85) { // Only boost if significantly slower than expected
            
            // Normalize current velocity and scale by original speed (with cap)
            const safeSpeed = Math.min(originalSpeed, 5.0)
            const scale = safeSpeed / currentSpeed
            
            body.setLinvel({ 
              x: vel.x * scale, 
              y: vel.y * scale, 
              z: vel.z * scale 
            }, true)
            lastActivityTime.current = Date.now()
          }
        } else if (frictionCoefficient < 0.05) {
          // For very low friction modes, still do some minimal corrections to prevent energy loss
          // Only correct if the speed has dropped significantly compared to original
          const originalSpeed = particleSpeeds.current.get(index)
          if (originalSpeed && 
              currentSpeed < originalSpeed * 0.5 && // Only boost if lost 50% of speed
              currentSpeed < 0.1) { // And speed is very low
            
            // Apply a gentler correction proportional to friction coefficient
            // Lower friction = more correction (inverse relationship)
            const correctionFactor = 1.0 - Math.min(frictionCoefficient * 10, 0.9); // Map 0.001 to ~0.99, 0.05 to ~0.5
            const boostSpeed = originalSpeed * correctionFactor * 0.5; // Reduced boost
            
            if (boostSpeed > currentSpeed) {
              const scale = boostSpeed / currentSpeed;
              body.setLinvel({ 
                x: vel.x * scale, 
                y: vel.y * scale, 
                z: vel.z * scale 
              }, true)
              lastActivityTime.current = Date.now()
            }
          }
        }
      } catch (error) {
        // Silently catch errors to prevent simulation interruption
      }
    })
    
    // Calculate average velocity
    const averageSpeed = particlesChecked > 0 ? totalVelocityMagnitude / particlesChecked : 0;
    
    // Report the average speed to parent component - ensure it's always reported
    if (onSpeedUpdate) {
      onSpeedUpdate(Math.max(0, averageSpeed)); // Ensure we don't report negative values
    }
    
    // Update lastActivityTime if there's significant movement
    if (averageSpeed > 0.01) { // Reduced threshold from 0.1 to 0.01
      lastActivityTime.current = Date.now();
    }
    
    // Update active particles count
    if (onActiveParticlesChange && particlesChecked > 0) {
      onActiveParticlesChange(activeCount)
    }
    
    // Periodically check system status (every ~60 frames or 1 second at 60fps)
    statusCheckCounter.current += 1
    if (statusCheckCounter.current % 30 === 0) {
      let anyNaN = false
      let anyInfinite = false
      
      particleRefs.current.forEach((body) => {
        if (!body) return
        
        try {
          const vel = body.linvel()
          
          // Simple check for critical issues that would cause crashes
          if (isNaN(vel.x) || isNaN(vel.y) || isNaN(vel.z)) {
            anyNaN = true
          } else if (!isFinite(vel.x) || !isFinite(vel.y) || !isFinite(vel.z)) {
            anyInfinite = true
          }
        } catch (error) {
          // Ignore errors
        }
      })
      
      // If critical issues detected, flag it
      if (anyNaN || anyInfinite) {
        setHasDetectedIssue(true)
      }
      
      // Check if simulation appears to be stalled
      setSimulationActive(activeCount > 0)
    }
  })

  // Collect a reference when a rigid body is created
  const addBodyRef = (body: RapierRigidBody) => {
    if (body && !particleRefs.current.includes(body)) {
      particleRefs.current.push(body)
    }
  }

  return (
    <>
      {/* Container */}
      <group ref={groupRef} key={resetCounter}>
        {/* Walls of the container - rendered as transparent wireframe */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[CONTAINER_SIZE, CONTAINER_SIZE, CONTAINER_SIZE]} />
          <meshStandardMaterial wireframe color="white" transparent opacity={0.3} />
        </mesh>

        {/* Warning indicator for detected issues */}
        {hasDetectedIssue && (
          <mesh position={[0, -HALF_SIZE - 0.5, 0]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="red" />
          </mesh>
        )}

        {/* Invisible walls with physics colliders */}
        <RigidBody 
          type="fixed" 
          position={[0, 0, 0]} 
          restitution={effectiveRestitution} // Use the configured restitution
          friction={effectiveFrictionCoefficient} // Use friction coefficient
          linearDamping={0} // Fixed objects don't need damping
          angularDamping={0} // Fixed objects don't need damping
        >
          {/* Bottom */}
          <CuboidCollider
            args={[HALF_SIZE, WALL_THICKNESS, HALF_SIZE]}
            position={[0, -HALF_SIZE, 0]}
            restitution={effectiveRestitution}
            friction={effectiveFrictionCoefficient} // Use friction coefficient
          />
          {/* Top */}
          <CuboidCollider
            args={[HALF_SIZE, WALL_THICKNESS, HALF_SIZE]}
            position={[0, HALF_SIZE, 0]}
            restitution={effectiveRestitution}
            friction={effectiveFrictionCoefficient} // Use friction coefficient
          />
          {/* Left */}
          <CuboidCollider
            args={[WALL_THICKNESS, HALF_SIZE, HALF_SIZE]}
            position={[-HALF_SIZE, 0, 0]}
            restitution={effectiveRestitution}
            friction={effectiveFrictionCoefficient} // Use friction coefficient
          />
          {/* Right */}
          <CuboidCollider
            args={[WALL_THICKNESS, HALF_SIZE, HALF_SIZE]}
            position={[HALF_SIZE, 0, 0]}
            restitution={effectiveRestitution}
            friction={effectiveFrictionCoefficient} // Use friction coefficient
          />
          {/* Front */}
          <CuboidCollider
            args={[HALF_SIZE, HALF_SIZE, WALL_THICKNESS]}
            position={[0, 0, -HALF_SIZE]}
            restitution={effectiveRestitution}
            friction={effectiveFrictionCoefficient} // Use friction coefficient
          />
          {/* Back */}
          <CuboidCollider
            args={[HALF_SIZE, HALF_SIZE, WALL_THICKNESS]}
            position={[0, 0, HALF_SIZE]}
            restitution={effectiveRestitution}
            friction={effectiveFrictionCoefficient} // Use friction coefficient
          />
        </RigidBody>

        {/* Particles */}
        {particles.map((particle) => (
          <RigidBody
            key={particle.id}
            ref={addBodyRef}
            position={particle.position}
            linearVelocity={particle.velocity}
            restitution={effectiveRestitution} // Use the configured restitution
            friction={effectiveFrictionCoefficient} // Use friction coefficient
            linearDamping={effectiveDamping} // Use calculated damping
            angularDamping={effectiveDamping} // Use calculated damping
            ccd={true} // Enable CCD for better collision detection
            canSleep={false} // Prevent particles from sleeping
            colliders={false}
            mass={1}
            gravityScale={gravity ? 1 : 0}
          >
            <BallCollider 
              args={[radius]} // Use the calculated radius
              restitution={effectiveRestitution}
              friction={effectiveFrictionCoefficient} // Use friction coefficient
              density={1}
            />
            <mesh>
              <sphereGeometry args={[radius, 16, 16]} />
              <meshStandardMaterial color={0xfe8c8c} />
            </mesh>
          </RigidBody>
        ))}
      </group>
    </>
  )
}

export default PhysicsContainer 