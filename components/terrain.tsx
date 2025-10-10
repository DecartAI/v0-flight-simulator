"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type { Group } from "three"
import type { Vector3 } from "three"

interface TerrainFeature {
  id: string
  type: "building" | "tower" | "mountain" | "trees"
  position: [number, number, number]
  size: [number, number, number]
  color: string
}

interface GroundChunk {
  id: string
  position: [number, number, number]
  color: string
}

interface TerrainProps {
  planePosition: Vector3
}

// Seeded random number generator for consistent world generation
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function Terrain({ planePosition }: TerrainProps) {
  const featuresRef = useRef<Group>(null)
  const chunksGenerated = useRef(new Set<string>())
  const features = useRef<Map<string, TerrainFeature>>(new Map())
  const groundChunks = useRef<Map<string, GroundChunk>>(new Map())

  const chunkSize = 150 // Larger chunks for efficiency
  const renderDistance = 400 // Balanced distance for performance

  // Generate a chunk key from coordinates
  const getChunkKey = (x: number, z: number): string => {
    const chunkX = Math.floor(x / chunkSize)
    const chunkZ = Math.floor(z / chunkSize)
    return `${chunkX},${chunkZ}`
  }

  // Generate features for a chunk based on its position
  const generateChunk = (chunkX: number, chunkZ: number) => {
    const chunkKey = `${chunkX},${chunkZ}`
    if (chunksGenerated.current.has(chunkKey)) return

    chunksGenerated.current.add(chunkKey)

    const centerX = chunkX * chunkSize
    const centerZ = chunkZ * chunkSize
    const seed = chunkX * 73856093 + chunkZ * 19349663 // Hash for consistent seeding

    // Ground chunk with varied colors
    const groundColors = ["#4ade80", "#22c55e", "#16a34a", "#86efac", "#bbf7d0"]
    const colorIndex = Math.floor(seededRandom(seed) * groundColors.length)
    groundChunks.current.set(chunkKey, {
      id: chunkKey,
      position: [centerX, -2, centerZ],
      color: groundColors[colorIndex],
    })

    // Determine feature density based on chunk location
    const density = seededRandom(seed + 1)

    if (density < 0.5) {
      // Empty/sparse area - no features for performance
      return
    } else if (density < 0.65) {
      // Forest area - reduced count
      const treeCount = 3 + Math.floor(seededRandom(seed + 2) * 4) // 3-6 trees
      for (let i = 0; i < treeCount; i++) {
        const x = centerX + (seededRandom(seed + i * 3) - 0.5) * chunkSize * 0.8
        const z = centerZ + (seededRandom(seed + i * 3 + 1) - 0.5) * chunkSize * 0.8
        const height = 10 + seededRandom(seed + i * 3 + 2) * 15

        const featureId = `${chunkKey}-tree-${i}`
        features.current.set(featureId, {
          id: featureId,
          type: "trees",
          position: [x, height / 2 - 2, z],
          size: [4, height, 4],
          color: seededRandom(seed + i) > 0.5 ? "#22c55e" : "#16a34a",
        })
      }
    } else if (density < 0.85) {
      // City/building area - reduced count
      const buildingCount = 4 + Math.floor(seededRandom(seed + 3) * 5) // 4-8 buildings
      for (let i = 0; i < buildingCount; i++) {
        const x = centerX + (seededRandom(seed + i * 4) - 0.5) * chunkSize * 0.9
        const z = centerZ + (seededRandom(seed + i * 4 + 1) - 0.5) * chunkSize * 0.9
        const width = 4 + seededRandom(seed + i * 4 + 2) * 6
        const height = 10 + seededRandom(seed + i * 4 + 3) * 30
        const depth = 4 + seededRandom(seed + i * 4 + 4) * 6

        const colors = ["#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#71717a"]
        const colorIndex = Math.floor(seededRandom(seed + i * 5) * colors.length)

        const featureId = `${chunkKey}-building-${i}`
        features.current.set(featureId, {
          id: featureId,
          type: "building",
          position: [x, height / 2 - 2, z],
          size: [width, height, depth],
          color: colors[colorIndex],
        })
      }
    } else {
      // Landmark area - tall towers or mountains (1-2 per chunk)
      const landmarkType = seededRandom(seed + 4) > 0.5 ? "tower" : "mountain"
      const count = 1 + Math.floor(seededRandom(seed + 5) * 2) // 1-2 landmarks

      for (let i = 0; i < count; i++) {
        const x = centerX + (seededRandom(seed + i * 6) - 0.5) * chunkSize * 0.7
        const z = centerZ + (seededRandom(seed + i * 6 + 1) - 0.5) * chunkSize * 0.7

        if (landmarkType === "tower") {
          const height = 50 + seededRandom(seed + i * 6 + 2) * 100
          const featureId = `${chunkKey}-tower-${i}`
          features.current.set(featureId, {
            id: featureId,
            type: "tower",
            position: [x, height / 2 - 2, z],
            size: [8, height, 8],
            color: "#ef4444",
          })
        } else {
          const height = 40 + seededRandom(seed + i * 6 + 2) * 80
          const baseSize = 25 + seededRandom(seed + i * 6 + 3) * 40
          const featureId = `${chunkKey}-mountain-${i}`
          features.current.set(featureId, {
            id: featureId,
            type: "mountain",
            position: [x, height / 2 - 2, z],
            size: [baseSize, height, baseSize],
            color: seededRandom(seed + i) > 0.6 ? "#78716c" : "#57534e",
          })
        }
      }
    }
  }

  // Clean up chunks that are too far away
  const cleanupDistantChunks = (planeX: number, planeZ: number) => {
    const cleanupDistance = renderDistance * 1.2 // More aggressive cleanup

    // Filter features
    features.current.forEach((feature, id) => {
      const dx = feature.position[0] - planeX
      const dz = feature.position[2] - planeZ
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance >= cleanupDistance) {
        features.current.delete(id)
      }
    })

    // Filter ground chunks
    groundChunks.current.forEach((chunk, id) => {
      const dx = chunk.position[0] - planeX
      const dz = chunk.position[2] - planeZ
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance >= cleanupDistance) {
        groundChunks.current.delete(id)
      }
    })

    // Clean up chunk registry
    const chunksToRemove: string[] = []
    chunksGenerated.current.forEach((chunkKey) => {
      const [chunkX, chunkZ] = chunkKey.split(",").map(Number)
      const centerX = chunkX * chunkSize
      const centerZ = chunkZ * chunkSize
      const dx = centerX - planeX
      const dz = centerZ - planeZ
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance > cleanupDistance) {
        chunksToRemove.push(chunkKey)
      }
    })
    chunksToRemove.forEach((key) => chunksGenerated.current.delete(key))
  }

  useFrame(() => {
    const planeX = planePosition.x
    const planeZ = planePosition.z

    // Generate chunks in a grid around the plane
    const gridRadius = Math.ceil(renderDistance / chunkSize)
    const planeChunkX = Math.floor(planeX / chunkSize)
    const planeChunkZ = Math.floor(planeZ / chunkSize)

    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      for (let dz = -gridRadius; dz <= gridRadius; dz++) {
        const chunkX = planeChunkX + dx
        const chunkZ = planeChunkZ + dz

        // Only generate chunks within render distance
        const centerX = chunkX * chunkSize
        const centerZ = chunkZ * chunkSize
        const distance = Math.sqrt(
          (centerX - planeX) ** 2 + (centerZ - planeZ) ** 2
        )

        if (distance < renderDistance) {
          generateChunk(chunkX, chunkZ)
        }
      }
    }

    // Cleanup distant chunks regularly for performance
    cleanupDistantChunks(planeX, planeZ)
  })

  return (
    <>
      {/* Ground chunks */}
      {Array.from(groundChunks.current.values()).map((chunk) => (
        <mesh
          key={chunk.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={chunk.position}
          receiveShadow
        >
          <planeGeometry args={[chunkSize, chunkSize]} />
          <meshStandardMaterial color={chunk.color} />
        </mesh>
      ))}

      {/* Terrain features */}
      <group ref={featuresRef}>
        {Array.from(features.current.values()).map((feature) => {
          if (feature.type === "mountain") {
            // Cone shape for mountains
            return (
              <mesh key={feature.id} position={feature.position} castShadow receiveShadow>
                <coneGeometry args={[feature.size[0] / 2, feature.size[1], 8]} />
                <meshStandardMaterial color={feature.color} metalness={0.2} roughness={0.9} />
              </mesh>
            )
          } else {
            // Box shape for buildings, towers, trees
            return (
              <mesh key={feature.id} position={feature.position} castShadow receiveShadow>
                <boxGeometry args={feature.size} />
                <meshStandardMaterial
                  color={feature.color}
                  metalness={feature.type === "trees" ? 0.1 : 0.3}
                  roughness={feature.type === "trees" ? 0.95 : 0.7}
                />
              </mesh>
            )
          }
        })}
      </group>
    </>
  )
}
