"use client"

import { useState, useRef, useEffect } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { Sky, Cloud } from "@react-three/drei"
import { Input } from "@/components/ui/input"
import { PlaneIcon } from "lucide-react"
import { Plane } from "@/components/plane"
import { VideoRestyling } from "@/components/video-restyling-vanilla"
import { Terrain } from "@/components/terrain"
import { Vector3 } from "three"

function RenderController() {
  useEffect(() => {
    console.log("[v0] Canvas running in continuous mode at 25 FPS")
    return () => {
      console.log("[v0] Stopped render loop")
    }
  }, [])

  return null
}

export function FlightSimulator() {
  const [apiKey, setApiKey] = useState("")
  const [prompt, setPrompt] = useState("Cyberpunk city at night")
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [planePosition, setPlanePosition] = useState(new Vector3(0, 0, 0))

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto">
          <div className="flex items-center gap-3 text-white">
            <PlaneIcon className="w-6 h-6" />
            <h1 className="text-2xl font-bold">3D Flight Simulator</h1>
          </div>
          <div className="w-80">
            <Input
              type="password"
              placeholder="Enter Decart API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 backdrop-blur"
            />
          </div>
        </div>
      </div>

      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 2, 8], fov: 75 }}
          frameloop="always"
          gl={{
            preserveDrawingBuffer: true,
          }}
          dpr={1}
          style={{ width: "100%", height: "100%" }}
          onCreated={({ gl, size, clock }) => {
            gl.setSize(1280, 704, false)
            console.log("[v0] Canvas set to required resolution: 1280x704")
            setCanvasElement(gl.domElement)
          }}
        >
          <RenderController />

          <Sky sunPosition={[100, 20, 100]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          <Cloud position={[-4, 2, -10]} speed={0.2} opacity={0.5} />
          <Cloud position={[4, 1, -8]} speed={0.3} opacity={0.4} />
          <Cloud position={[0, 3, -15]} speed={0.25} opacity={0.6} />

          <Plane onPositionChange={setPlanePosition} />

          <Terrain planePosition={planePosition} />
        </Canvas>
      </div>

      <VideoRestyling apiKey={apiKey} canvasElement={canvasElement} prompt={prompt} onPromptChange={setPrompt} />
    </div>
  )
}
