"use client"

import { useRef, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { Mesh, Group } from "three"
import { Vector3, Euler, Quaternion } from "three"

interface PlaneProps {
  onPositionChange?: (position: Vector3) => void
  onStatusChange?: (speed: number, mouseControls: boolean) => void
}

// Plane component
export function Plane({ onPositionChange, onStatusChange }: PlaneProps) {
  const groupRef = useRef<Group>(null)
  const planeRef = useRef<Mesh>(null)
  const propellerRef = useRef<Group>(null)
  const { camera } = useThree()

  // Arcade physics state
  const speed = useRef(20) // Current speed
  const targetSpeed = useRef(20) // Target speed for smooth acceleration
  const turnSpeed = useRef(0) // Current turn rate
  const pitchSpeed = useRef(0) // Current pitch rate
  const visualRoll = useRef(0) // Visual banking for turns

  // Smooth camera following
  const cameraPositionTarget = useRef(new Vector3())
  const cameraLookAtTarget = useRef(new Vector3())

  const [keys, setKeys] = useState({
    a: false,
    d: false,
    w: false,
    s: false,
    arrowUp: false,
    arrowDown: false,
    arrowLeft: false,
    arrowRight: false,
    space: false,
    shift: false,
  })

  // Mouse controls state
  const [mouseControls, setMouseControls] = useState(false)
  const mousePosition = useRef({ x: 0, y: 0 })

  // Notify status changes
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(speed.current, mouseControls)
    }
  }, [mouseControls, onStatusChange])

  useEffect(() => {
    // Key mapping for cleaner keyboard handling
    const keyMap: Record<string, keyof typeof keys> = {
      'a': 'a',
      'd': 'd',
      'w': 'w',
      's': 's',
      'arrowup': 'arrowUp',
      'arrowdown': 'arrowDown',
      'arrowleft': 'arrowLeft',
      'arrowright': 'arrowRight',
      ' ': 'space',
      'shift': 'shift'
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const mappedKey = keyMap[key]
      if (mappedKey) {
        setKeys((prev) => ({ ...prev, [mappedKey]: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const mappedKey = keyMap[key]
      if (mappedKey) {
        setKeys((prev) => ({ ...prev, [mappedKey]: false }))
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseControls) return
      // Normalize mouse position to -1 to 1
      mousePosition.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mousePosition.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right click to toggle mouse controls
        setMouseControls((prev) => !prev)
        e.preventDefault()
      }
    }

    const handleContextMenu = (e: Event) => {
      e.preventDefault() // Prevent context menu on right click
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("contextmenu", handleContextMenu)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [mouseControls])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    const plane = groupRef.current

    // === ARCADE CONTROLS ===

    // Speed Control - More responsive with boost and brake
    const normalSpeed = 20
    const boostSpeed = 35
    const brakeSpeed = 10

    if (keys.space) {
      // Boost!
      targetSpeed.current = boostSpeed
    } else if (keys.shift) {
      // Brake!
      targetSpeed.current = brakeSpeed
    } else if (keys.w) {
      // Speed up
      targetSpeed.current = Math.min(targetSpeed.current + 15 * delta, 30)
    } else if (keys.s) {
      // Slow down
      targetSpeed.current = Math.max(targetSpeed.current - 15 * delta, 12)
    } else {
      // Return to normal speed
      targetSpeed.current = normalSpeed
    }

    // Smooth speed transitions
    speed.current += (targetSpeed.current - speed.current) * 5 * delta

    // Turning Control - Direct and responsive
    let targetTurnSpeed = 0

    // Keyboard turning
    if (keys.a || keys.arrowLeft) {
      targetTurnSpeed = 2.5 // Turn left
    } else if (keys.d || keys.arrowRight) {
      targetTurnSpeed = -2.5 // Turn right
    }

    // Mouse turning (if enabled)
    if (mouseControls) {
      targetTurnSpeed = -mousePosition.current.x * 3
    }

    // Smooth turning
    turnSpeed.current += (targetTurnSpeed - turnSpeed.current) * 8 * delta
    plane.rotation.y += turnSpeed.current * delta

    // Visual banking when turning (makes it look cooler)
    const targetRoll = -turnSpeed.current * 0.3 // Bank into turns
    visualRoll.current += (targetRoll - visualRoll.current) * 5 * delta
    plane.rotation.z = visualRoll.current

    // Pitch Control - More responsive for altitude changes
    let targetPitchSpeed = 0

    if (keys.arrowUp) {
      targetPitchSpeed = 2.2 // Pitch up - increased from 1.5
    } else if (keys.arrowDown) {
      targetPitchSpeed = -2.2 // Pitch down - increased from 1.5
    }

    // Mouse pitch (if enabled)
    if (mouseControls) {
      targetPitchSpeed = mousePosition.current.y * 3 // Increased from 2
    }

    // Smooth pitching - faster response
    pitchSpeed.current += (targetPitchSpeed - pitchSpeed.current) * 8 * delta

    // Limit pitch to prevent flipping
    const maxPitch = Math.PI / 2.5 // Allow steeper pitch angles
    plane.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, plane.rotation.x + pitchSpeed.current * delta))

    // Gentler auto-level when not actively pitching
    if (!keys.arrowUp && !keys.arrowDown && !mouseControls) {
      plane.rotation.x *= 0.98 // Slower return to level
    }

    // === SIMPLIFIED PHYSICS ===

    // Calculate forward direction
    const forward = new Vector3(0, 0, -1)
    forward.applyQuaternion(plane.quaternion)

    // Apply movement with some vertical influence from pitch
    const movement = forward.multiplyScalar(speed.current * delta)

    // Much stronger vertical influence from pitch for responsive altitude control
    const verticalInfluence = plane.rotation.x * speed.current * 2.5 // Increased from 0.8
    movement.y += verticalInfluence * delta

    // Very gentle gravity for arcade feel
    movement.y -= 0.5 * delta // Reduced from 2

    // Only apply gentle altitude assistance at very low altitude
    if (plane.position.y < 3 && !keys.arrowDown && plane.rotation.x >= 0) {
      // Only help maintain altitude if not diving and very close to ground
      movement.y += (3 - plane.position.y) * 0.2 * delta
    }

    // Apply movement
    plane.position.add(movement)

    // Ground collision - bounce up
    if (plane.position.y < 1.5) {
      plane.position.y = 1.5
      // Auto pull-up near ground
      if (plane.rotation.x < 0) {
        plane.rotation.x *= 0.8
      }
    }

    // Ceiling limit (for fun)
    if (plane.position.y > 200) {
      plane.position.y = 200
    }

    // === ENHANCED CAMERA ===

    // Dynamic camera distance based on speed
    const cameraDistance = 12 + (speed.current - 20) * 0.3
    const cameraHeight = 4 + Math.abs(plane.rotation.x) * 2

    // Calculate target camera position
    const cameraOffset = new Vector3(0, cameraHeight, cameraDistance)
    cameraOffset.applyQuaternion(plane.quaternion)
    cameraPositionTarget.current.copy(plane.position).add(cameraOffset)

    // Smooth camera movement
    camera.position.lerp(cameraPositionTarget.current, 5 * delta)

    // Look ahead of the plane
    const lookAheadDistance = 15 + speed.current * 0.5
    const lookAtOffset = new Vector3(0, 0, -lookAheadDistance)
    lookAtOffset.applyQuaternion(plane.quaternion)
    cameraLookAtTarget.current.copy(plane.position).add(lookAtOffset)

    // Smooth camera look at
    const currentLookAt = new Vector3()
    camera.getWorldDirection(currentLookAt)
    const targetDirection = cameraLookAtTarget.current.clone().sub(camera.position).normalize()
    currentLookAt.lerp(targetDirection, 5 * delta)
    camera.lookAt(camera.position.clone().add(currentLookAt))

    // === VISUAL EFFECTS ===

    // Gentle bobbing for visual interest
    if (planeRef.current) {
      planeRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05
      // Subtle roll animation during flight
      planeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.5) * 0.02
    }

    // Propeller speed based on throttle
    if (propellerRef.current) {
      const propSpeed = (speed.current / 20) * 40
      propellerRef.current.rotation.z += propSpeed * delta
    }

    // Notify position change
    if (onPositionChange) {
      onPositionChange(plane.position.clone())
    }

    // Notify status change
    if (onStatusChange) {
      onStatusChange(speed.current, mouseControls)
    }
  })

  return (
    <group ref={groupRef} position={[0, 10, 0]}>
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

        {/* Boost effect indicator */}
          {keys.space && (
          <>
            {/* Engine glow */}
          <mesh position={[0.15, -0.15, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 0.3, 8]} />
            <meshStandardMaterial
                  color="#ff6600"
                  emissive="#ff3300"
                  emissiveIntensity={2}
                  transparent
                  opacity={0.8}
                />
          </mesh>
          <mesh position={[-0.15, -0.15, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 0.3, 8]} />
            <meshStandardMaterial
                  color="#ff6600"
                  emissive="#ff3300"
                  emissiveIntensity={2}
                  transparent
                  opacity={0.8}
                />
          </mesh>
          </>
          )}
        </group>
      </group>
  )
}