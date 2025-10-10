"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Play, Square, Sparkles, Maximize2, Minimize2 } from "lucide-react"

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
  const [isFullscreen, setIsFullscreen] = useState(false)

  const videoOutputRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isManualDisconnectRef = useRef(false)

  const startRestyling = async () => {
    console.log("[v0] Starting vanilla WebRTC restyling process...")
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

      // Create WebSocket connection
      const wsUrl = `wss://api3.decart.ai/v1/stream?api_key=${encodeURIComponent(apiKey)}&model=mirage`
      console.log("[v0] Connecting to WebSocket...")
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[v0] WebSocket connected")
        setConnectionState("connecting")
      }

      ws.onerror = (event) => {
        console.error("[v0] WebSocket error:", event)
        setError("WebSocket connection failed")
        setIsConnecting(false)
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log("[v0] WebSocket closed")
        if (!isManualDisconnectRef.current) {
          console.log("[v0] Unexpected WebSocket close, attempting reconnect in 3s...")
          setConnectionState("disconnected")
          setIsConnected(false)
          setError("Connection lost, reconnecting...")
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[v0] Attempting automatic reconnection...")
            startRestyling()
          }, 3000)
        } else {
          setConnectionState("disconnected")
          setIsConnected(false)
        }
      }

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data)
        console.log("[v0] WebSocket message type:", message.type)

        if (message.type === "answer" && peerConnectionRef.current) {
          console.log("[v0] Received SDP answer from server")
          await peerConnectionRef.current.setRemoteDescription({
            type: "answer",
            sdp: message.sdp,
          })
          console.log("[v0] Remote description set")
          setIsConnected(true)
          setIsConnecting(false)
          setConnectionState("connected")
        }
      }

      // Wait for WebSocket to be ready
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval)
            resolve()
          } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            clearInterval(checkInterval)
            reject(new Error("WebSocket failed to connect"))
          }
        }, 100)
      })

      // Create peer connection with multiple reliable ICE servers
      console.log("[v0] Creating RTCPeerConnection with ICE servers...")
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          // Google STUN servers
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          // Twilio STUN
          { urls: "stun:global.stun.twilio.com:3478" },
          // Free TURN servers with better reliability
          {
            urls: [
              "turn:numb.viagenie.ca",
              "turns:numb.viagenie.ca"
            ],
            username: "webrtc@live.com",
            credential: "muazkh",
          },
          {
            urls: [
              "turn:turn.anyfirewall.com:443?transport=tcp",
            ],
            username: "webrtc",
            credential: "webrtc",
          },
        ],
        iceTransportPolicy: "all",
        iceCandidatePoolSize: 10,
      })
      peerConnectionRef.current = peerConnection

      console.log("[v0] ICE servers configured with STUN + TURN (multiple providers)")

      // Send ICE candidates to server
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          console.log("[v0] Sending ICE candidate to server, type:", event.candidate.type)
          ws.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
            }),
          )
        }
      }

      // Monitor connection states
      peerConnection.oniceconnectionstatechange = () => {
        console.log("[v0] ICE connection state:", peerConnection.iceConnectionState)
        if (peerConnection.iceConnectionState === "failed") {
          console.error("[v0] ICE connection failed!")
          setError("ICE connection failed - network connectivity issue")
        }
      }

      peerConnection.onicegatheringstatechange = () => {
        console.log("[v0] ICE gathering state:", peerConnection.iceGatheringState)
      }

      peerConnection.onconnectionstatechange = () => {
        console.log("[v0] Peer connection state:", peerConnection.connectionState)
      }

      // Receive transformed video stream
      peerConnection.ontrack = (event) => {
        console.log("[v0] Received remote track, streams:", event.streams.length)
        if (videoOutputRef.current && event.streams[0]) {
          videoOutputRef.current.srcObject = event.streams[0]
          console.log("[v0] Set transformed stream to video element")
        }
      }

      // Add local stream tracks to peer connection
      console.log("[v0] Adding local stream tracks to peer connection...")
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream)
        console.log("[v0] Added track:", track.kind, track.id)
      })

      // Create and send offer
      console.log("[v0] Creating WebRTC offer...")
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      console.log("[v0] Local description set, sending offer to server...")

      ws.send(
        JSON.stringify({
          type: "offer",
          sdp: offer.sdp,
        }),
      )

      // Send initial prompt
      console.log("[v0] Sending initial prompt:", prompt)
      ws.send(
        JSON.stringify({
          type: "prompt",
          prompt: prompt,
        }),
      )

      console.log("[v0] Vanilla WebRTC setup complete")
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

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isConnected) {
      wsRef.current.send(
        JSON.stringify({
          type: "prompt",
          prompt: prompt,
        }),
      )
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
      {/* Video Container - Fullscreen or Overlay */}
      <div
        className={`absolute transition-all duration-300 ${
          isFullscreen
            ? "inset-0 z-10" // Fullscreen - covers entire viewport, below controls
            : "top-20 right-4 z-20 w-96 rounded-lg shadow-2xl border-2 border-white/20" // Overlay - top right corner
        } ${
          isConnected ? "opacity-100" : "opacity-0 pointer-events-none"
        } overflow-hidden bg-black`}
      >
        <div className={`relative ${isFullscreen ? "w-full h-full" : "aspect-video"}`}>
          <video
            ref={videoOutputRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
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
              {/* Live indicator */}
              <div className={`absolute ${isFullscreen ? "top-24 left-4" : "top-2 right-2"} px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded flex items-center gap-1`}>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              {/* Toggle fullscreen button */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`absolute ${isFullscreen ? "top-24 right-4" : "top-2 left-2"} p-2 bg-black/50 hover:bg-black/70 text-white rounded transition-colors`}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              {/* Prompt display - only show in non-fullscreen */}
              {!isFullscreen && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs font-medium truncate">{prompt}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls - always on top */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
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

              <div className="text-white/60 text-xs text-center">
                W/S: Throttle | A/D: Roll (Bank) | ↑/↓: Pitch (Nose)
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
