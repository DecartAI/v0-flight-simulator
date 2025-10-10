"use client"

import { useRef, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { Mesh, Group } from "three"
import { Vector3, Euler } from "three"

interface PlaneProps {
  onPositionChange?: (position: Vector3) => void
}

export function Plane({ onPositionChange }: PlaneProps) {
  const groupRef = useRef<Group>(null)
  const planeRef = useRef<Mesh>(null)
  const propellerRef = useRef<Group>(null)
  const { camera } = useThree()

  // Physics state
  const velocity = useRef(new Vector3(0, 0, -15)) // Initial forward velocity
  const throttle = useRef(15) // Current speed/throttle

  const [keys, setKeys] = useState({
    a: false,
    d: false,
    w: false,
    s: false,
    arrowUp: false,
    arrowDown: false,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "a") setKeys((prev) => ({ ...prev, a: true }))
      if (key === "d") setKeys((prev) => ({ ...prev, d: true }))
      if (key === "w") setKeys((prev) => ({ ...prev, w: true }))
      if (key === "s") setKeys((prev) => ({ ...prev, s: true }))
      if (key === "arrowup") setKeys((prev) => ({ ...prev, arrowUp: true }))
      if (key === "arrowdown") setKeys((prev) => ({ ...prev, arrowDown: true }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "a") setKeys((prev) => ({ ...prev, a: false }))
      if (key === "d") setKeys((prev) => ({ ...prev, d: false }))
      if (key === "w") setKeys((prev) => ({ ...prev, w: false }))
      if (key === "s") setKeys((prev) => ({ ...prev, s: false }))
      if (key === "arrowup") setKeys((prev) => ({ ...prev, arrowUp: false }))
      if (key === "arrowdown") setKeys((prev) => ({ ...prev, arrowDown: false }))
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const plane = groupRef.current

    // === CONTROLS ===

    // Throttle control (W/S) - Speed up/slow down
    const throttleSpeed = 20
    const minThrottle = 10
    const maxThrottle = 30

    if (keys.w) {
      throttle.current = Math.min(throttle.current + throttleSpeed * delta, maxThrottle)
    }
    if (keys.s) {
      throttle.current = Math.max(throttle.current - throttleSpeed * delta, minThrottle)
    }

    // Roll control (A/D) - Bank left/right
    const rollSpeed = 3.5
    const maxRoll = Math.PI / 2.5 // 72 degrees max bank

    if (keys.a) {
      plane.rotation.z = Math.min(plane.rotation.z + rollSpeed * delta, maxRoll)
    } else if (keys.d) {
      plane.rotation.z = Math.max(plane.rotation.z - rollSpeed * delta, -maxRoll)
    } else {
      // Return to level flight - smoother
      plane.rotation.z *= 0.92
    }

    // Pitch control (Arrow Up/Down) - Nose up/down
    const pitchSpeed = 2.2
    const maxPitch = Math.PI / 3 // 60 degrees max pitch

    if (keys.arrowUp) {
      plane.rotation.x = Math.min(plane.rotation.x + pitchSpeed * delta, maxPitch)
    } else if (keys.arrowDown) {
      plane.rotation.x = Math.max(plane.rotation.x - pitchSpeed * delta, -maxPitch)
    } else {
      // Gradually return to neutral pitch - smoother
      plane.rotation.x *= 0.96
    }

    // === PHYSICS ===

    // Gravity (glider feel)
    const gravity = -4
    velocity.current.y += gravity * delta

    // Lift (based on speed and pitch angle) - gliding mechanics
    const baseLift = (throttle.current / 20) * 2.5 // More speed = more lift (reduced)
    // Pitch affects lift: nose up = more lift, nose down = less/negative lift
    const pitchFactor = plane.rotation.x * 4 // Positive rotation.x (nose up) = positive lift
    const liftForce = baseLift + pitchFactor
    velocity.current.y += liftForce * delta

    // Forward thrust (in the direction the plane is pointing)
    const forward = new Vector3(0, 0, -1)
    forward.applyEuler(new Euler(plane.rotation.x, plane.rotation.y, 0, 'XYZ'))
    forward.multiplyScalar(throttle.current)

    // Apply forward velocity
    velocity.current.x = forward.x
    velocity.current.z = forward.z

    // Banking creates turning (roll affects yaw) - more responsive
    const turnRate = -plane.rotation.z * 1.2 // More bank = sharper turn
    plane.rotation.y += turnRate * delta

    // Drag/air resistance (reduced for smoother movement)
    velocity.current.multiplyScalar(0.995)

    // Apply velocity to position
    plane.position.add(velocity.current.clone().multiplyScalar(delta))

    // Ground collision (gentle bounce)
    if (plane.position.y < 1) {
      plane.position.y = 1
      velocity.current.y = Math.max(0.5, velocity.current.y) // Gentle bounce
    }

    // === CAMERA ===
    const cameraOffset = new Vector3(0, 4, 12)
    cameraOffset.applyQuaternion(plane.quaternion)
    camera.position.copy(plane.position).add(cameraOffset)

    const lookAtOffset = new Vector3(0, 0, -10)
    lookAtOffset.applyQuaternion(plane.quaternion)
    camera.lookAt(plane.position.clone().add(lookAtOffset))

    // Gentle bobbing motion for visual feedback
    if (planeRef.current) {
      planeRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.08
    }

    // Rotate propeller based on speed
    if (propellerRef.current) {
      const propellerSpeed = (throttle.current / 10) * 50 // Scale throttle to rotation speed
      propellerRef.current.rotation.z += propellerSpeed * delta
    }

    if (onPositionChange) {
      onPositionChange(plane.position.clone())
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={planeRef} rotation={[0, Math.PI, 0]}>
        {/* Engine cowling - front of plane */}
        <mesh position={[0, 0, 1.6]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.35, 0.8, 16]} />
          <meshStandardMaterial color="#2d3436" metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Propeller (spinner + blades) */}
        <group ref={propellerRef} position={[0, 0, 2.1]}>
          {/* Propeller spinner */}
          <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[0.2, 0.5, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.6} />
          </mesh>

          {/* Propeller blades */}
          <mesh rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[2.5, 0.15, 0.08]} />
            <meshStandardMaterial color="#3d3d3d" metalness={0.2} roughness={0.8} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]} castShadow>
            <boxGeometry args={[2.5, 0.15, 0.08]} />
            <meshStandardMaterial color="#3d3d3d" metalness={0.2} roughness={0.8} />
          </mesh>
        </group>

        {/* Main Fuselage - olive drab green */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.32, 3, 16]} />
          <meshStandardMaterial color="#4a5c3e" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Rear fuselage taper */}
        <mesh position={[0, 0, -1.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.2, 0.8, 16]} />
          <meshStandardMaterial color="#4a5c3e" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Cockpit canopy - traditional bubble style */}
        <mesh position={[0, 0.3, 0.5]} castShadow>
          <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#87ceeb"
            metalness={0.3}
            roughness={0.2}
            transparent
            opacity={0.5}
          />
        </mesh>

        {/* Cockpit frame */}
        <mesh position={[0, 0.25, 0.5]} castShadow>
          <boxGeometry args={[0.02, 0.4, 0.6]} />
          <meshStandardMaterial color="#2d3436" metalness={0.2} roughness={0.8} />
        </mesh>

        {/* Main Wings - straight classic design */}
        <mesh position={[0, -0.1, 0.1]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[6.5, 0.15, 1.2]} />
          <meshStandardMaterial color="#4a5c3e" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Wing roundels - military markings */}
        <mesh position={[2.2, -0.02, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 32]} />
          <meshStandardMaterial color="#dc2626" metalness={0.1} roughness={0.9} />
        </mesh>
        <mesh position={[2.2, -0.02, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 32]} />
          <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.9} />
        </mesh>
        <mesh position={[-2.2, -0.02, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 32]} />
          <meshStandardMaterial color="#dc2626" metalness={0.1} roughness={0.9} />
        </mesh>
        <mesh position={[-2.2, -0.02, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 32]} />
          <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.9} />
        </mesh>

        {/* Aileron details */}
        <mesh position={[2.8, -0.05, -0.2]} castShadow>
          <boxGeometry args={[1, 0.12, 0.5]} />
          <meshStandardMaterial color="#3d4a34" metalness={0.1} roughness={0.8} />
        </mesh>
        <mesh position={[-2.8, -0.05, -0.2]} castShadow>
          <boxGeometry args={[1, 0.12, 0.5]} />
          <meshStandardMaterial color="#3d4a34" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Horizontal stabilizer (tail wing) */}
        <mesh position={[0, 0, -1.65]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[2, 0.12, 0.65]} />
          <meshStandardMaterial color="#4a5c3e" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Vertical stabilizer (tail fin) */}
        <mesh position={[0, 0.5, -1.65]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.12, 1, 0.7]} />
          <meshStandardMaterial color="#4a5c3e" metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Tail rudder stripe */}
        <mesh position={[0, 0.7, -1.85]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.13, 0.4, 0.25]} />
          <meshStandardMaterial color="#dc2626" metalness={0.1} roughness={0.9} />
        </mesh>

        {/* Exhaust pipes */}
        <mesh position={[0.15, -0.15, 1.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[-0.15, -0.15, 1.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Landing gear struts (simplified) */}
        <mesh position={[0.8, -0.45, 0.3]} castShadow>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color="#2d3436" metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[-0.8, -0.45, 0.3]} castShadow>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color="#2d3436" metalness={0.2} roughness={0.8} />
        </mesh>

        {/* Wheels */}
        <mesh position={[0.8, -0.7, 0.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.9} />
        </mesh>
        <mesh position={[-0.8, -0.7, 0.3]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.9} />
        </mesh>

        {/* Tail wheel */}
        <mesh position={[0, -0.35, -1.5]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.08, 12]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.9} />
        </mesh>
      </group>
    </group>
  )
}
