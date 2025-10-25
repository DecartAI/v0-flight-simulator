"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Text } from "@react-three/drei"

interface PromptPortalProps {
  index: number
  position: [number, number, number]
  prompt: string
  color?: string
  onTrigger: (prompt: string, index: number) => void
  planePosition: THREE.Vector3
}

export function PromptPortal({
  index,
  position,
  prompt,
  color = "#00ff88",
  onTrigger,
  planePosition
}: PromptPortalProps) {
  const portalRef = useRef<THREE.Mesh>(null)
  const [triggered, setTriggered] = useState(false)
  const [opacity, setOpacity] = useState(0.6)
  const wasInsideRef = useRef(false)

  // Reset trigger after plane moves far enough away
  useEffect(() => {
    const distance = planePosition.distanceTo(new THREE.Vector3(...position))
    // Reset when plane is far enough away
    if (distance > 15 && triggered) {
      setTriggered(false)
      wasInsideRef.current = false
    }
  }, [planePosition, position, triggered])

  useFrame((state) => {
    if (!portalRef.current) return

    // Rotate portal
    portalRef.current.rotation.z += 0.01

    // Calculate distance to plane
    const portalPos = new THREE.Vector3(...position)
    const distance = planePosition.distanceTo(portalPos)

    // Use a larger trigger radius for more reliable detection
    const triggerRadius = 5 // Increased from 3
    const isInside = distance < triggerRadius

    // Detect when plane enters the portal (wasn't inside before, now is)
    if (isInside && !wasInsideRef.current && !triggered) {
      console.log(`[v0] Portal ${index} triggered! Distance: ${distance.toFixed(2)}`)
      setTriggered(true)
      wasInsideRef.current = true
      onTrigger(prompt, index)
      console.log(`[v0] New prompt: ${prompt}`)
    } else if (!isInside && wasInsideRef.current) {
      // Plane has left the portal area
      wasInsideRef.current = false
    }

    // Pulsing effect based on distance
    const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.9
    const proximityGlow = Math.max(0, 1 - distance / 30) * 0.4
    setOpacity(0.3 + proximityGlow + (triggered ? pulse * 0.3 : 0))
  })

  return (
    <group position={position}>
      {/* Portal ring - made larger to match trigger radius */}
      <mesh ref={portalRef}>
        <torusGeometry args={[4, 0.4, 16, 100]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={opacity}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <torusGeometry args={[3.5, 0.15, 8, 50]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={opacity * 1.5}
          transparent
          opacity={opacity * 0.5}
        />
      </mesh>

      {/* Trigger zone indicator - subtle visual of actual trigger area */}
      {triggered && (
        <mesh>
          <sphereGeometry args={[5, 16, 16]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.2}
            emissive={color}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}

      {/* Portal label */}
      <Text
        position={[0, 5.5, 0]}
        fontSize={0.7}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="black"
      >
        {prompt.substring(0, 20)}...
      </Text>

    </group>
  )
}