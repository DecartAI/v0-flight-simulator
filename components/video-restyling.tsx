"use client"

import { useState, useEffect, useRef } from "react"
import { createDecartClient, models } from "@decartai/sdk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Play, Square, Sparkles } from "lucide-react"

interface VideoRestylingProps {
  apiKey: string
  canvasElement: HTMLCanvasElement | null
  prompt: string
  onPromptChange: (prompt: string) => void
}

export function VideoRestyling({ apiKey, canvasElement, prompt, onPromptChange }: VideoRestylingProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<string>("disconnected")

  const videoOutputRef = useRef<HTMLVideoElement>(null)
  const realtimeClientRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isManualDisconnectRef = useRef(false)

  const startRestyling = async () => {
    console.log("[v0] Starting restyling process...")
    console.log("[v0] API Key present:", !!apiKey)
    console.log("[v0] Canvas element present:", !!canvasElement)
    console.log("[v0] Video element present:", !!videoOutputRef.current)

    if (!apiKey) {
      const errorMsg = "Please enter your Decart API key"
      console.log("[v0] Error:", errorMsg)
      setError(errorMsg)
      return
    }

    if (!canvasElement) {
      const errorMsg = "Canvas not ready. Please wait for the scene to load."
      console.log("[v0] Error:", errorMsg)
      setError(errorMsg)
      return
    }

    if (!videoOutputRef.current) {
      const errorMsg = "Video element not ready"
      console.log("[v0] Error:", errorMsg)
      setError(errorMsg)
      return
    }

    try {
      setIsConnecting(true)
      setError(null)
      isManualDisconnectRef.current = false

      console.log("[v0] Canvas dimensions:", canvasElement.width, "x", canvasElement.height)

      if (canvasElement.width !== 1280 || canvasElement.height !== 704) {
        throw new Error(
          `Canvas resolution mismatch: ${canvasElement.width}x${canvasElement.height}. Expected 1280x704. Please wait for canvas to initialize.`,
        )
      }

      console.log("[v0] Capturing canvas stream at 25 FPS...")
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      const stream = canvasElement.captureStream(25)
      console.log("[v0] Stream captured with", stream.getVideoTracks().length, "video tracks")

      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack || videoTrack.readyState !== "live") {
        throw new Error("Canvas stream is not active")
      }
      console.log("[v0] Video track state:", videoTrack.readyState)
      const settings = videoTrack.getSettings()
      console.log("[v0] Video track settings:", settings.width, "x", settings.height, "@", settings.frameRate, "fps")

      if (settings.width !== 1280 || settings.height !== 704) {
        throw new Error(
          `Stream resolution mismatch: ${settings.width}x${settings.height}. Expected 1280x704 for API compatibility.`,
        )
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log("[v0] Waited for frame generation to stabilize")

      streamRef.current = stream

      console.log("[v0] Creating Decart client...")
      const client = createDecartClient({
        apiKey: apiKey,
      })

      const model = models.realtime("mirage")
      console.log("[v0] Using model:", model.name, "- Expected:", model.width, "x", model.height, "@", model.fps, "fps")

      console.log("[v0] Connecting to realtime API...")
      const realtimeClient = await client.realtime.connect(stream, {
        model,
        onRemoteStream: (transformedStream) => {
          console.log("[v0] Received transformed stream with", transformedStream.getVideoTracks().length, "tracks")
          const transformedTrack = transformedStream.getVideoTracks()[0]
          if (transformedTrack) {
            console.log("[v0] Transformed track state:", transformedTrack.readyState)
            const transformedSettings = transformedTrack.getSettings()
            console.log(
              "[v0] Transformed track settings:",
              transformedSettings.width,
              "x",
              transformedSettings.height,
              "@",
              transformedSettings.frameRate,
              "fps",
            )

            if (transformedSettings.width === 0 || transformedSettings.height === 0) {
              console.log("[v0] Note: Transformed stream dimensions are 0x0 initially, waiting for metadata to load...")
            }
          }

          if (videoOutputRef.current) {
            videoOutputRef.current.srcObject = transformedStream
            console.log("[v0] Set transformed stream to video element")

            videoOutputRef.current
              .play()
              .then(() => {
                console.log("[v0] Video playback started successfully")
              })
              .catch((err) => {
                console.error("[v0] Video playback failed:", err)
                setError("Video playback failed: " + err.message)
              })
          } else {
            console.error("[v0] Video output ref is null!")
          }
        },
      })

      console.log("[v0] Realtime client connected")
      realtimeClientRef.current = realtimeClient

      console.log("[v0] Setting initial prompt:", prompt)
      realtimeClient.setPrompt(prompt)

      realtimeClient.on("connectionChange", (state: string) => {
        console.log("[v0] Connection state changed:", state)
        setConnectionState(state)
        setIsConnected(state === "connected")

        if (state === "disconnected" && !isManualDisconnectRef.current) {
          console.log("[v0] Unexpected disconnect detected, attempting reconnect in 3s...")
          setError("Connection lost, reconnecting...")
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[v0] Attempting automatic reconnection...")
            startRestyling()
          }, 3000)
        } else if (state === "disconnected") {
          setIsConnecting(false)
        }
      })

      realtimeClient.on("error", (error: any) => {
        console.error("[v0] SDK error:", error)
        setError(error.message || "An error occurred")
        setIsConnecting(false)
        setIsConnected(false)
      })

      setIsConnecting(false)
      setIsConnected(true)
      console.log("[v0] Restyling started successfully")
    } catch (err: any) {
      console.error("[v0] Failed to start restyling:", err)
      console.error("[v0] Error details:", err.message, err.stack)
      setError(err.message || "Failed to connect")
      setIsConnecting(false)
      setIsConnected(false)
    }
  }

  const stopRestyling = () => {
    console.log("[v0] Stopping restyling...")
    isManualDisconnectRef.current = true

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (realtimeClientRef.current) {
      realtimeClientRef.current.disconnect()
      realtimeClientRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoOutputRef.current) {
      videoOutputRef.current.srcObject = null
    }
    setIsConnected(false)
    setConnectionState("disconnected")
    setError(null)
    console.log("[v0] Restyling stopped")
  }

  const updatePrompt = () => {
    console.log("[v0] Updating prompt to:", prompt)
    if (realtimeClientRef.current && isConnected) {
      realtimeClientRef.current.setPrompt(prompt)
      console.log("[v0] Prompt updated successfully")
    } else {
      console.log("[v0] Cannot update prompt - not connected")
    }
  }

  useEffect(() => {
    return () => {
      console.log("[v0] Component unmounting, cleaning up...")
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      stopRestyling()
    }
  }, [])

  return (
    <>
      <div
        className={`absolute top-20 right-4 z-20 w-96 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 transition-opacity duration-300 ${
          isConnected ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="relative aspect-video bg-black">
          <video
            ref={videoOutputRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            onLoadedMetadata={() => {
              console.log("[v0] Video metadata loaded")
              if (videoOutputRef.current) {
                console.log(
                  "[v0] Video dimensions:",
                  videoOutputRef.current.videoWidth,
                  "x",
                  videoOutputRef.current.videoHeight,
                )
              }
            }}
            onPlay={() => console.log("[v0] Video playing event fired")}
            onError={(e) => console.error("[v0] Video error event:", e)}
          />
          {isConnected && (
            <>
              <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded flex items-center gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white text-xs font-medium truncate">{prompt}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        <div className="max-w-7xl mx-auto pointer-events-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 border border-white/20">
            <div className="space-y-3">
              {/* Prompt Input and Controls */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Enter style prompt (e.g., 'Cyberpunk city', 'Watercolor painting')"
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && isConnected) {
                        updatePrompt()
                      }
                    }}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                {isConnected && (
                  <Button
                    onClick={updatePrompt}
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Apply Style
                  </Button>
                )}
                {!isConnected ? (
                  <Button
                    onClick={startRestyling}
                    disabled={isConnecting || !apiKey || !canvasElement}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/20"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Restyling
                      </>
                    )}
                  </Button>
                ) : (
                  <Button onClick={stopRestyling} variant="destructive">
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>

              {/* Status and Error Messages */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectionState === "connected"
                        ? "bg-green-500"
                        : connectionState === "connecting"
                          ? "bg-yellow-500 animate-pulse"
                          : "bg-gray-400"
                    }`}
                  />
                  <span className="text-white/80 capitalize">{connectionState}</span>
                </div>
                {error && <span className="text-red-400 text-xs">{error}</span>}
              </div>

              <div className="text-white/60 text-xs text-center">Use WASD or Arrow Keys to fly the plane</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
