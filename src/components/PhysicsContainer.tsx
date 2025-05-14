import { useRef, useState, useEffect, useMemo } from 'react'
import * as Rapier from '@react-three/rapier'
import * as THREE from 'three'
import * as Fiber from '@react-three/fiber'

// Use components from namespaces
const { RigidBody, CuboidCollider, BallCollider } = Rapier
const { useFrame } = Fiber

// Define RapierRigidBody interface with required methods
interface RapierRigidBody {
  translation(): { x: number, y: number, z: number };
  linvel(): { x: number, y: number, z: number };
  setLinvel(vel: { x: number, y: number, z: number }, wake: boolean): void;
  isSleeping(): boolean;
}

// Define particle colors
const PARTICLE_COLORS = {
  default: new THREE.Color("#3888ff"), // Blue
  collision: new THREE.Color("#8a0000"), // Dark red
}

// Define collision status for each particle
type ParticleCollisionStatus = {
  isColliding: boolean,     // Is currently colliding
  collisionTime: number,    // When collision started (timestamp)
  lastUpdateTime: number,   // Last time this status was checked
}

// Define collision detection parameters
const COLLISION_DETECTION = {
  speedChangeThreshold: 0.2,  // How much speed should change to detect collision
  proximityThreshold: 0.05,   // How close particles should be to be considered colliding
  wallProximityThreshold: 0.02 // How close to wall to detect wall collision
}

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
  collisionFadeDuration?: number
  onActiveParticlesChange?: (count: number) => void
  onSpeedUpdate?: (speed: number) => void
  onCollisionCountUpdate?: (count: number) => void // New callback for collision count
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
  
  log: (msg: string, ...args: unknown[]) => {
    if (DEBUG.logCount < DEBUG.maxLogs) {
      console.log(msg, ...args)
      DEBUG.logCount++
    }
  },
  
  logIssue: (issueType: string, details: Record<string, unknown>) => {
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
  collisionFadeDuration = 1.0, // seconds
  onActiveParticlesChange,
  onSpeedUpdate,
  onCollisionCountUpdate
}) => {
  // Use counter to force re-render on reset
  const [resetCounter, setResetCounter] = useState(0)
  
  // Track particle materials for color fading
  const particleMaterials = useRef<THREE.MeshStandardMaterial[]>([])
  
  // Track collision status for each particle with the new format
  const particleCollisionStatus = useRef<Map<number, ParticleCollisionStatus>>(new Map())
  
  // Track particle positions for proximity detection
  const particlePositions = useRef<Map<number, THREE.Vector3>>(new Map())
  
  // Track potential collisions this frame
  const potentialCollisions = useRef<Set<number>>(new Set())
  
  // Constants for color transition
  const COLOR_FADE_DURATION = collisionFadeDuration
  
  // Generate particles
  const { particles, radius } = useMemo(() => 
    generateParticles(
      particleCount, 
      particleSize, 
      initialVelocity,
      CONTAINER_SIZE
    ), 
    // resetCounter is included to force re-calculation when the simulation resets
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resetCounter, particleCount, particleSize, initialVelocity]
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
    // Clear previous velocities
    previousVelocities.current.clear()
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
    particleCollisionStatus.current.clear()
    particleMaterials.current = []
    
    particles.forEach((particle, index) => {
      const v = particle.velocity
      const speed = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
      particleSpeeds.current.set(index, speed)
      particleCollisionStatus.current.set(index, {
        isColliding: false,
        collisionTime: 0,
        lastUpdateTime: 0
      })
    })
  }, [particles])
  
  // Helper function to handle particle collision
  const handleParticleCollision = (particleId: number) => {
    // Get the current time
    const currentTime = Date.now() / 1000;
    
    // Check if this is a new collision or an existing one
    const existingStatus = particleCollisionStatus.current.get(particleId);
    const isNewCollision = !existingStatus?.isColliding || 
      (existingStatus.isColliding && currentTime - existingStatus.collisionTime > collisionFadeDuration);
    
    // Only count as a new collision if it wasn't already colliding recently
    if (isNewCollision) {
      // Increment collision counter
      collisionCounter.current += 1;
    }
    
    // Simple approach: always register a new collision and force color to red
    // This guarantees that collisions are always visually indicated
    particleCollisionStatus.current.set(particleId, {
      isColliding: true,
      collisionTime: currentTime,
      lastUpdateTime: currentTime
    });
    
    // Set material to collision color immediately
    const material = particleMaterials.current[particleId];
    if (material) {
      // Always set to full red on collision, regardless of previous state
      material.color.copy(PARTICLE_COLORS.collision);
    }
    
    // Remove from stuck particles if it was marked
    stuckParticleCheck.current.stuckParticles.delete(particleId);
  }
  
  // Track previous velocities for wall collision detection
  const previousVelocities = useRef<Map<number, {x: number, y: number, z: number}>>(new Map());
  
  // Helper function to check if particle is colliding with a wall
  const isCollidingWithWall = (
    position: THREE.Vector3, 
    velocity: { x: number, y: number, z: number },
    previousVelocity: { x: number, y: number, z: number } | undefined,
    radius: number
  ): boolean => {
    // Wall positions (considering container size and radius)
    const wallThreshold = HALF_SIZE - radius - COLLISION_DETECTION.wallProximityThreshold;
    
    // Method 1: Check proximity to walls while moving toward them
    // Check X walls
    if ((Math.abs(position.x) > wallThreshold) && 
        (Math.sign(position.x) === Math.sign(velocity.x))) {
      return true;
    }
    
    // Check Y walls
    if ((Math.abs(position.y) > wallThreshold) && 
        (Math.sign(position.y) === Math.sign(velocity.y))) {
      return true;
    }
    
    // Check Z walls
    if ((Math.abs(position.z) > wallThreshold) && 
        (Math.sign(position.z) === Math.sign(velocity.z))) {
      return true;
    }
    
    // Method 2: Check for sudden velocity direction changes near walls
    if (previousVelocity) {
      // Check for X velocity direction change near X walls
      if (Math.abs(position.x) > wallThreshold * 0.9 && 
          Math.sign(velocity.x) !== Math.sign(previousVelocity.x) &&
          Math.abs(velocity.x) > 0.1) {
        return true;
      }
      
      // Check for Y velocity direction change near Y walls
      if (Math.abs(position.y) > wallThreshold * 0.9 && 
          Math.sign(velocity.y) !== Math.sign(previousVelocity.y) &&
          Math.abs(velocity.y) > 0.1) {
        return true;
      }
      
      // Check for Z velocity direction change near Z walls
      if (Math.abs(position.z) > wallThreshold * 0.9 && 
          Math.sign(velocity.z) !== Math.sign(previousVelocity.z) &&
          Math.abs(velocity.z) > 0.1) {
        return true;
      }
    }
    
    return false;
  }
  
  // Helper function to find nearby particles that might be colliding
  const findCollidingPairs = (particleId: number, threshold: number) => {
    const position = particlePositions.current.get(particleId)
    if (!position) return []
    
    const collidingPairs: number[] = []
    
    // Check all other particles for proximity
    particlePositions.current.forEach((otherPos, otherId) => {
      if (otherId !== particleId && position.distanceTo(otherPos) < threshold) {
        collidingPairs.push(otherId)
      }
    })
    
    return collidingPairs
  }
  
  // Track potentially stuck particles and last reset time
  const stuckParticleCheck = useRef<{
    lastResetTime: number,
    stuckParticles: Set<number>
  }>({
    lastResetTime: 0,
    stuckParticles: new Set()
  });
  
  // Helper function to reset a stuck particle
  const resetStuckParticle = (particleId: number) => {
    const material = particleMaterials.current[particleId];
    if (material) {
      material.color.copy(PARTICLE_COLORS.default);
    }
    particleCollisionStatus.current.set(particleId, {
      isColliding: false,
      collisionTime: 0,
      lastUpdateTime: 0
    });
    stuckParticleCheck.current.stuckParticles.delete(particleId);
  };
  
  // Frame counter to control frequency of checks
  const frameCounter = useRef(0)
  
  // Track collision counts for the graph
  const collisionCounter = useRef(0)
  const lastReportedCollisionTime = useRef(0)
  
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
                } catch (err) {
        allValid = false
        DEBUG.logIssue('INITIAL_VELOCITY_CHECK_ERROR', {
          particleIndex: index,
          error: String(err)
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
            } catch (err) {
              // Ignore errors but log if necessary
              if (DEBUG.issues.size < 5) console.error("Movement check error:", err);
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
              } catch (err) {
                // Ignore errors but log if necessary
                if (DEBUG.issues.size < 5) console.error("Velocity reset error:", err);
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
    
    // Get current time for color transitions
    const currentTime = Date.now() / 1000
    
    // Clear potential collisions from previous frame
    potentialCollisions.current.clear()
    
    // Count active (non-sleeping) particles and check velocities
    let activeCount = 0
    let totalVelocityMagnitude = 0
    let particlesChecked = 0
    
    // First pass: track positions and detect speed changes
    particleRefs.current.forEach((body, index) => {
      if (!body) return
      
      try {
        // Get position and store it for proximity detection
        const pos = body.translation()
        const position = new THREE.Vector3(pos.x, pos.y, pos.z)
        particlePositions.current.set(index, position)
        
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
          
          // Trigger collision effect for invalid velocities
          handleParticleCollision(index)
          
          return
        }
        
        // Check for collision based on velocity change
        const originalSpeed = particleSpeeds.current.get(index) || 0.5
        const speedChange = Math.abs(currentSpeed - originalSpeed) / (originalSpeed || 0.1)
        
        // Significant speed change indicates potential collision
        if (speedChange > COLLISION_DETECTION.speedChangeThreshold && currentSpeed > 0.5) {
          potentialCollisions.current.add(index)
        }
        
        // Check for wall collisions
        if (isCollidingWithWall(position, vel, previousVelocities.current.get(index), radius)) {
          // Mark as wall collision
          handleParticleCollision(index)
        }
        
        // Store current velocity for next frame comparison
        previousVelocities.current.set(index, { ...vel });
      } catch (err) {
        // Silently catch errors but log if necessary
        if (DEBUG.issues.size < 5) console.error("Position tracking error:", err);
      }
    })
    
    // Second pass: apply collision effects to particles and their collision partners
    potentialCollisions.current.forEach(particleId => {
      // Find all particles that are close enough to be collision partners
      const collisionPartners = findCollidingPairs(
        particleId, 
        COLLISION_DETECTION.proximityThreshold + particleSize * 2
      )
      
      // Mark particle as colliding
      handleParticleCollision(particleId)
      
      // Mark all collision partners as colliding too
      collisionPartners.forEach(partnerId => {
        handleParticleCollision(partnerId)
      })
    })
    
    // Third pass: update colors and apply physics corrections
    particleRefs.current.forEach((body, index) => {
      if (!body) return
      
      try {
        const vel = body.linvel()
        const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z)
        const originalSpeed = particleSpeeds.current.get(index) || 0.5
        
        // Update particle color based on collision state
        const material = particleMaterials.current[index];
        const collisionTime = particleCollisionStatus.current.get(index)?.collisionTime || 0;
        
        if (material && collisionTime > 0) {
          // Calculate fade progress (0 to 1, where 1 means fully back to normal)
          const timeSinceCollision = currentTime - collisionTime;
          const fadeProgress = Math.min(timeSinceCollision / COLOR_FADE_DURATION, 1.0);
          
          if (fadeProgress < 1.0) {
            // Interpolate between collision and default color
            material.color.copy(PARTICLE_COLORS.collision).lerp(
              PARTICLE_COLORS.default, fadeProgress
            );
          } else {
            // Reset to default color and collision state when fade complete
            material.color.copy(PARTICLE_COLORS.default);
            // IMPORTANT: Only reset the collision state to 0 if it's from this specific collision
            // This prevents resetting when multiple collisions happen during a fade
            particleCollisionStatus.current.set(index, {
              isColliding: false,
              collisionTime: 0,
              lastUpdateTime: 0
            });
          }
        } else if (material) {
          // Safety check: ensure particles with no collision state are blue
          material.color.copy(PARTICLE_COLORS.default);
        }
        
        // Special handling for zero-friction mode
        if (!particleParticleFriction && !particleWallFriction) {
          // If speed is almost zero, give it a small push
          if (currentSpeed < 0.05) {
            const safeOriginalSpeed = Math.min(originalSpeed, 1.0)
            const phi = Math.random() * Math.PI * 2
            const theta = Math.random() * Math.PI
            
            const vx = safeOriginalSpeed * Math.sin(theta) * Math.cos(phi)
            const vy = safeOriginalSpeed * Math.sin(theta) * Math.sin(phi)
            const vz = safeOriginalSpeed * Math.cos(theta)
            
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
          if (Math.abs(currentSpeed - originalSpeed) / originalSpeed > 0.15 &&
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
          if (currentSpeed < originalSpeed * 0.5 && // Only boost if lost 50% of speed
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
      } catch (err) {
        // Silently catch errors to prevent simulation interruption
        if (DEBUG.issues.size < 5) console.error("Physics correction error:", err);
      }
    })
    
    // Calculate average velocity
    const averageSpeed = particlesChecked > 0 ? totalVelocityMagnitude / particlesChecked : 0;
    
    // Report the average speed to parent component - ensure it's always reported
    if (onSpeedUpdate) {
      onSpeedUpdate(Math.max(0, averageSpeed)); // Ensure we don't report negative values
    }
    
    // Report collision count data - only twice per second to match the speed update interval
    // This makes it easier to correlate speed and collision data
    const now = Date.now() / 1000;
    if (onCollisionCountUpdate && (now - lastReportedCollisionTime.current >= 0.5)) {
      onCollisionCountUpdate(collisionCounter.current);
      // Reset counter for next interval
      collisionCounter.current = 0;
      lastReportedCollisionTime.current = now;
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
      
      // Check for stuck particles (particles that have been in collision state for too long)
      const now = Date.now() / 1000;
      
      // Check for stuck particles more frequently (every second)
      if (now - stuckParticleCheck.current.lastResetTime > 1.0) {
        stuckParticleCheck.current.lastResetTime = now;
        
        particleCollisionStatus.current.forEach((collisionStatus, particleId) => {
          // If a particle has been in collision state for longer than 2x the fade duration, it's likely stuck
          if (collisionStatus.isColliding && now - collisionStatus.collisionTime > COLOR_FADE_DURATION * 2) {
            stuckParticleCheck.current.stuckParticles.add(particleId);
            // Reset the stuck particle
            resetStuckParticle(particleId);
          }
        });
      }
      
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
        } catch (err) {
          // Ignore errors but log if necessary
          if (DEBUG.issues.size < 5) console.error("Status check error:", err);
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
              <meshStandardMaterial 
                ref={(material) => {
                  if (material) {
                    // Store a reference to this material
                    particleMaterials.current[particle.id] = material;
                  }
                }}
                color={PARTICLE_COLORS.default}
              />
            </mesh>
          </RigidBody>
        ))}
      </group>
    </>
  )
}

export default PhysicsContainer 