"use client"

import { useState, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { Sky, Cloud } from "@react-three/drei"
import { Input } from "@/components/ui/input"
import { PlaneIcon } from "lucide-react"
import { Plane } from "@/components/plane"
import { VideoRestylingSDK } from "@/components/video-restyling-sdk"
import { Terrain } from "@/components/terrain"
import { PromptPortal } from "@/components/prompt-portal"
import { Vector3 } from "three"
import { debug } from "@/lib/debug"

// Portal configurations
const PORTALS = [
  { position: [30, 10, -50] as [number, number, number], prompt: "Watercolor painting style", color: "#00aaff" },
  { position: [-40, 15, -80] as [number, number, number], prompt: "80s retro synthwave neon", color: "#ff00ff" },
  { position: [60, 8, -120] as [number, number, number], prompt: "Japanese anime cel shaded", color: "#ff6600" },
  { position: [-30, 20, -180] as [number, number, number], prompt: "Van Gogh starry night oil painting", color: "#ffff00" },
  { position: [0, 25, -250] as [number, number, number], prompt: "Minecraft blocky voxel world", color: "#00ff00" },
  { position: [50, 12, -320] as [number, number, number], prompt: "Tim Burton dark gothic style", color: "#9900ff" },
  { position: [-60, 18, -400] as [number, number, number], prompt: "Studio Ghibli dreamy landscape", color: "#00ffff" },
  { position: [40, 30, -500] as [number, number, number], prompt: "Cyberpunk city at night", color: "#ff0088" },
]

export function FlightSimulator() {
  const [apiKey, setApiKey] = useState("")
  const [prompt, setPrompt] = useState("Cyberpunk city at night")
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const [planePosition, setPlanePosition] = useState(new Vector3(0, 0, 0))
  const [portalMessage, setPortalMessage] = useState("")
  const [manualPromptCooldown, setManualPromptCooldown] = useState(false)
  const [planeSpeed, setPlaneSpeed] = useState(20)
  const [mouseControlsEnabled, setMouseControlsEnabled] = useState(false)
  const [selectedModel, setSelectedModel] = useState<"mirage" | "mirage_v2">("mirage_v2")

  // Log canvas lifecycle
  useEffect(() => {
    debug.log("Canvas running in continuous mode at 25 FPS")
    return () => {
      debug.log("Stopped render loop")
    }
  }, [])

  const handlePortalTrigger = (newPrompt: string, portalIndex: number) => {
    // Don't trigger if user just manually changed the prompt
    if (manualPromptCooldown) return

    setPrompt(newPrompt)
    setPortalMessage(`Portal activated: ${newPrompt}`)

    // Clear message after 3 seconds
    setTimeout(() => setPortalMessage(""), 3000)
  }

  const handleManualPromptChange = (newPrompt: string) => {
    setPrompt(newPrompt)
    // Set cooldown to prevent portals from immediately overriding
    setManualPromptCooldown(true)
    setTimeout(() => setManualPromptCooldown(false), 3000) // 3 second cooldown
  }

  const handlePlaneStatusChange = (speed: number, mouseControls: boolean) => {
    setPlaneSpeed(speed)
    setMouseControlsEnabled(mouseControls)
  }

  const planeAltitude = Math.round(planePosition.y)

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto">
          <div className="flex items-center gap-3 text-white">
            <PlaneIcon className="w-6 h-6" />
            <h1 className="text-2xl font-bold">3D Flight Simulator</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://platform.decart.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white text-sm underline transition-colors"
            >
              Get API Key Here →
            </a>
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
      </div>

      {/* HUD/Controls indicator */}
      <div className="fixed top-20 left-4 z-20 text-white bg-black/50 backdrop-blur-sm rounded-lg p-3 text-sm">
        <div className="font-bold mb-2">Flight Controls</div>
        <div>↑/↓: Climb/Dive</div>
        <div>A/D or ←/→: Turn</div>
        <div>W/S: Speed Up/Down</div>
        <div>Space: Boost</div>
        <div>Shift: Brake</div>
        <div className="mt-2 text-xs opacity-70">
          {mouseControlsEnabled ? "🖱️ Mouse Control ON" : "Right-click: Mouse Control"}
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between">
            <span>Speed:</span>
            <span className="font-mono">{Math.round(planeSpeed)}</span>
          </div>
          <div className="flex justify-between">
            <span>Altitude:</span>
            <span className="font-mono">{planeAltitude}</span>
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
            debug.log("[v0] Canvas set to required resolution: 1280x704")
            setCanvasElement(gl.domElement)
          }}
        >

          <Sky sunPosition={[100, 20, 100]} />
          <Cloud position={[-4, 2, -10]} speed={0.2} opacity={0.5} />
          <Cloud position={[4, 1, -8]} speed={0.3} opacity={0.4} />
          <Cloud position={[0, 3, -15]} speed={0.25} opacity={0.6} />

          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          <Plane onPositionChange={setPlanePosition} onStatusChange={handlePlaneStatusChange} />
          <Terrain planePosition={planePosition} />

          {/* Prompt Portals */}
          {PORTALS.map((portal, index) => (
            <PromptPortal
              key={index}
              index={index}
              position={portal.position}
              prompt={portal.prompt}
              color={portal.color}
              onTrigger={handlePortalTrigger}
              planePosition={planePosition}
            />
          ))}
        </Canvas>
      </div>

      {/* Portal Message Notification */}
      {portalMessage && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-30 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-2xl animate-bounce">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-semibold">{portalMessage}</span>
          </div>
        </div>
      )}

      <VideoRestylingSDK
        apiKey={apiKey}
        canvasElement={canvasElement}
        prompt={prompt}
        onPromptChange={handleManualPromptChange}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  )
}
