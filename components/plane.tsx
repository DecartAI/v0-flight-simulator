"use client"

import { useRef, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import type { Mesh, Group } from "three"
import { Vector3 } from "three"

interface PlaneProps {
  onPositionChange?: (position: Vector3) => void
}

export function Plane({ onPositionChange }: PlaneProps) {
  const groupRef = useRef<Group>(null)
  const planeRef = useRef<Mesh>(null)
  const { camera } = useThree()

  const [keys, setKeys] = useState({
    a: false,
    d: false,
    w: false,
    s: false,
    arrowLeft: false,
    arrowRight: false,
    arrowUp: false,
    arrowDown: false,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "a" || key === "arrowleft") setKeys((prev) => ({ ...prev, a: true, arrowLeft: true }))
      if (key === "d" || key === "arrowright") setKeys((prev) => ({ ...prev, d: true, arrowRight: true }))
      if (key === "w" || key === "arrowup") setKeys((prev) => ({ ...prev, w: true, arrowUp: true }))
      if (key === "s" || key === "arrowdown") setKeys((prev) => ({ ...prev, s: true, arrowDown: true }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === "a" || key === "arrowleft") setKeys((prev) => ({ ...prev, a: false, arrowLeft: false }))
      if (key === "d" || key === "arrowright") setKeys((prev) => ({ ...prev, d: false, arrowRight: false }))
      if (key === "w" || key === "arrowup") setKeys((prev) => ({ ...prev, w: false, arrowUp: false }))
      if (key === "s" || key === "arrowdown") setKeys((prev) => ({ ...prev, s: false, arrowDown: false }))
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      const forwardSpeed = 8
      groupRef.current.position.z -= forwardSpeed * delta

      const turnSpeed = 1.5
      const pitchSpeed = 1.2

      if (keys.a || keys.arrowLeft) {
        groupRef.current.rotation.y += turnSpeed * delta
        groupRef.current.rotation.z = Math.min(groupRef.current.rotation.z + 1.5 * delta, 0.4)
      } else if (keys.d || keys.arrowRight) {
        groupRef.current.rotation.y -= turnSpeed * delta
        groupRef.current.rotation.z = Math.max(groupRef.current.rotation.z - 1.5 * delta, -0.4)
      } else {
        // Return to neutral roll when no keys pressed
        groupRef.current.rotation.z *= 0.9
      }

      if (keys.w || keys.arrowUp) {
        groupRef.current.rotation.x = Math.min(groupRef.current.rotation.x + pitchSpeed * delta, 0.5)
        groupRef.current.position.y += 3 * delta
      } else if (keys.s || keys.arrowDown) {
        groupRef.current.rotation.x = Math.max(groupRef.current.rotation.x - pitchSpeed * delta, -0.5)
        groupRef.current.position.y -= 3 * delta
      } else {
        // Return to neutral pitch when no keys pressed
        groupRef.current.rotation.x *= 0.9
      }

      const cameraOffset = new Vector3(0, 2, 8)
      cameraOffset.applyQuaternion(groupRef.current.quaternion)
      camera.position.copy(groupRef.current.position).add(cameraOffset)

      const lookAtOffset = new Vector3(0, 0, -5)
      lookAtOffset.applyQuaternion(groupRef.current.quaternion)
      camera.lookAt(groupRef.current.position.clone().add(lookAtOffset))

      // Gentle bobbing motion
      if (planeRef.current) {
        planeRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1
      }

      if (onPositionChange) {
        onPositionChange(groupRef.current.position.clone())
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={planeRef}>
        {/* Fuselage */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 3, 8]} />
          <meshStandardMaterial color="#e11d48" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Nose cone */}
        <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshStandardMaterial color="#dc2626" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Wings */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[6, 0.1, 1]} />
          <meshStandardMaterial color="#f43f5e" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Tail wing */}
        <mesh position={[0, 0, -1.3]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[2, 0.1, 0.6]} />
          <meshStandardMaterial color="#f43f5e" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Vertical stabilizer */}
        <mesh position={[0, 0.5, -1.3]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 1, 0.6]} />
          <meshStandardMaterial color="#f43f5e" metalness={0.5} roughness={0.5} />
        </mesh>

        {/* Cockpit window */}
        <mesh position={[0, 0.2, 0.8]} castShadow>
          <sphereGeometry args={[0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#0ea5e9" metalness={0.9} roughness={0.1} transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  )
}
