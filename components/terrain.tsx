"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group } from "three"
import type { Vector3 } from "three"

interface Building {
  id: string
  position: [number, number, number]
  size: [number, number, number]
  color: string
}

interface TerrainProps {
  planePosition: Vector3
}

export function Terrain({ planePosition }: TerrainProps) {
  const buildingsRef = useRef<Group>(null)
  const chunksGenerated = useRef(new Set<number>())
  const buildings = useRef<Building[]>([])

  const chunkSize = 50
  const viewDistance = 150

  // Generate buildings for a chunk
  const generateChunk = (chunkZ: number) => {
    const chunkKey = Math.floor(chunkZ / chunkSize)
    if (chunksGenerated.current.has(chunkKey)) return

    chunksGenerated.current.add(chunkKey)

    const buildingCount = 8 + Math.floor(Math.random() * 5)
    const colors = ["#64748b", "#475569", "#334155", "#1e293b", "#0f172a"]

    for (let i = 0; i < buildingCount; i++) {
      const x = (Math.random() - 0.5) * 40
      const z = chunkKey * chunkSize + (Math.random() - 0.5) * chunkSize
      const width = 2 + Math.random() * 3
      const height = 5 + Math.random() * 15
      const depth = 2 + Math.random() * 3

      buildings.current.push({
        id: `${chunkKey}-${i}`,
        position: [x, height / 2 - 2, z],
        size: [width, height, depth],
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
  }

  // Clean up buildings that are far behind the plane
  const cleanupOldBuildings = (planeZ: number) => {
    buildings.current = buildings.current.filter((building) => {
      const distanceBehind = planeZ - building.position[2]
      return distanceBehind < 100
    })

    // Clean up old chunks
    const currentChunk = Math.floor(planeZ / chunkSize)
    chunksGenerated.current.forEach((chunk) => {
      if (currentChunk - chunk > 3) {
        chunksGenerated.current.delete(chunk)
      }
    })
  }

  useFrame(() => {
    const planeZ = planePosition.z

    // Generate chunks ahead of the plane
    for (let i = -1; i < 4; i++) {
      const targetZ = planeZ + i * chunkSize
      generateChunk(targetZ)
    }

    // Cleanup old buildings
    cleanupOldBuildings(planeZ)
  })

  return (
    <>
      {/* Infinite ground plane that follows the player */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, planePosition.z]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#4ade80" />
      </mesh>

      {/* Buildings */}
      <group ref={buildingsRef}>
        {buildings.current.map((building) => (
          <mesh key={building.id} position={building.position} castShadow receiveShadow>
            <boxGeometry args={building.size} />
            <meshStandardMaterial color={building.color} metalness={0.3} roughness={0.7} />
          </mesh>
        ))}
      </group>
    </>
  )
}
