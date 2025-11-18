"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Play,
  Square,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { createDecartClient, models } from "@decartai/sdk";
import { debug, validateAndSetError } from "@/lib/debug";

interface VideoRestylingProps {
  apiKey: string;
  canvasElement: HTMLCanvasElement | null;
  prompt: string;
  model?: string;
  onPromptChange: (prompt: string) => void;
}

export function VideoRestylingSDK({
  apiKey,
  canvasElement,
  prompt,
  model = "mirage",
  onPromptChange,
}: VideoRestylingProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionTime, setConnectionTime] = useState<number>(0);
  const [draftPrompt, setDraftPrompt] = useState(prompt);

  const videoOutputRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<any>(null);
  const realtimeClientRef = useRef<any>(null);
  const isManualDisconnectRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const connectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debugIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRestyling = async () => {
    debug.log(`Starting SDK-based restyling with ${model}...`);
    debug.log("API Key present:", !!apiKey);
    debug.log("Canvas element present:", !!canvasElement);
    debug.log("Video element present:", !!videoOutputRef.current);
    debug.log("Selected model:", model);

    if (!validateAndSetError(apiKey, "Please enter your Decart API key", setError)) {
      return;
    }

    if (!validateAndSetError(canvasElement, "Canvas not ready. Please wait for the scene to load.", setError)) {
      return;
    }

    if (!validateAndSetError(videoOutputRef.current, "Video element not ready", setError)) {
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      isManualDisconnectRef.current = false;
      setConnectionState("connecting");

      debug.log(
        "[v0] Canvas dimensions:",
        canvasElement.width,
        "x",
        canvasElement.height,
      );

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Get the model configuration based on selected model
      const modelConfig = models.realtime(model);
      debug.log("[v0] Model config:", modelConfig);
      debug.log("[v0] Using model:", model);

      // Capture canvas stream
      // Note: Some browsers might not support specifying frame rate, so we'll try with and without
      debug.log(`[v0] Capturing canvas stream...`);
      let canvasStream;
      try {
        canvasStream = canvasElement.captureStream(modelConfig.fps);
      } catch (e) {
        debug.log("[v0] Failed to capture with FPS, trying without...");
        canvasStream = canvasElement.captureStream();
      }

      // Get video track and check settings
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== "live") {
        throw new Error("Canvas stream is not active");
      }

      debug.log("[v0] Video track state:", videoTrack.readyState);
      const settings = videoTrack.getSettings();
      debug.log(
        "[v0] Video track settings:",
        settings.width,
        "x",
        settings.height,
        "@",
        settings.frameRate,
        "fps",
      );

      // For now, let's try using just the canvas stream without audio
      // The working example uses camera+mic, but canvas might work differently
      const stream = canvasStream;

      debug.log(`[v0] Stream tracks: ${stream.getVideoTracks().length} video, ${stream.getAudioTracks().length} audio`);
      debug.log("[v0] Video track constraints:", videoTrack.getConstraints());
      debug.log("[v0] Video track capabilities:", videoTrack.getCapabilities ? videoTrack.getCapabilities() : "Not available");

      // Monitor canvas content before sending
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, 1, 1);
        debug.log("[v0] Canvas sample pixel (top-left):", {
          r: imageData.data[0],
          g: imageData.data[1],
          b: imageData.data[2],
          a: imageData.data[3],
          isEmpty: imageData.data[0] === 0 && imageData.data[1] === 0 && imageData.data[2] === 0
        });
      }

      streamRef.current = stream;

      // Create Decart client
      debug.log("[v0] Creating Decart client...");
      clientRef.current = createDecartClient({ apiKey });

      // Connect to realtime service
      debug.log(`[v0] Connecting to ${model}...`);
      debug.log("[v0] Stream info before connect:", {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        model: model,
        modelConfig: modelConfig,
      });

      try {
        // Start connection timer
        setConnectionTime(0);
        connectionTimerRef.current = setInterval(() => {
          setConnectionTime(prev => prev + 1);
        }, 1000);

        realtimeClientRef.current = await clientRef.current.realtime.connect(stream, {
          model: modelConfig,
          onRemoteStream: (transformedStream: MediaStream) => {
            debug.log("[v0] 🎥 RECEIVED TRANSFORMED STREAM!");
            debug.log("[v0] Transformed stream tracks:", {
              video: transformedStream.getVideoTracks().length,
              audio: transformedStream.getAudioTracks().length,
              active: transformedStream.active,
              id: transformedStream.id
            });

            const videoTracks = transformedStream.getVideoTracks();
            if (videoTracks.length > 0) {
              const track = videoTracks[0];
              debug.log("[v0] Video track info:", {
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                label: track.label,
                settings: track.getSettings()
              });
            }

            if (videoOutputRef.current) {
              // Add event listeners before setting srcObject
              const video = videoOutputRef.current;

              video.onloadedmetadata = () => {
                debug.log("[v0] ✅ Video metadata loaded!", {
                  width: video.videoWidth,
                  height: video.videoHeight,
                  duration: video.duration,
                  readyState: video.readyState
                });
              };

              video.onloadeddata = () => {
                debug.log("[v0] ✅ Video data loaded!");
              };

              video.oncanplay = () => {
                debug.log("[v0] ✅ Video can play!");
              };

              video.onplay = () => {
                debug.log("[v0] ✅ Video started playing!");
              };

              video.onerror = (e) => {
                debug.error("[v0] ❌ Video error:", e);
              };

              video.onwaiting = () => {
                debug.log("[v0] ⏳ Video waiting for data...");
              };

              video.onstalled = () => {
                debug.log("[v0] ⚠️ Video stalled!");
              };

              videoOutputRef.current.srcObject = transformedStream;
              debug.log("[v0] Set transformed stream to video element");

              // Try to play
              video.play().then(() => {
                debug.log("[v0] ✅ Video play() succeeded");
              }).catch(err => {
                debug.error("[v0] ❌ Video play() failed:", err);
              });

              // Start debug interval to monitor video state
              if (debugIntervalRef.current) clearInterval(debugIntervalRef.current);
              debugIntervalRef.current = setInterval(() => {
                if (video && video.srcObject) {
                  const stream = video.srcObject as MediaStream;
                  const videoTrack = stream.getVideoTracks()[0];
                  debug.log("[v0] 📊 Video status check:", {
                    currentTime: video.currentTime,
                    paused: video.paused,
                    readyState: video.readyState,
                    networkState: video.networkState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    trackEnabled: videoTrack?.enabled,
                    trackReadyState: videoTrack?.readyState,
                    streamActive: stream.active
                  });
                }
              }, 5000); // Check every 5 seconds
            }
            setIsConnected(true);
            setIsConnecting(false);
            setConnectionState("connected");
          },
          onError: (err: any) => {
            debug.error("[v0] Realtime client error:", err);
            debug.error("[v0] Error details:", JSON.stringify(err, null, 2));
            setError(err.message || "Connection failed");
            setIsConnected(false);
            setIsConnecting(false);
            setConnectionState("disconnected");
          },
        });
      } catch (connectError: any) {
        debug.error("[v0] Connection error caught:", connectError);
        debug.error("[v0] Connection error details:", JSON.stringify(connectError, null, 2));
        throw connectError;
      }

      // Send initial prompt after connection is established
      if (realtimeClientRef.current && prompt) {
        debug.log("[v0] Sending initial prompt:", prompt);
        try {
          await realtimeClientRef.current.setPrompt(prompt, { should_enrich: true });
          debug.log("[v0] Initial prompt sent successfully");
        } catch (err) {
          debug.error("[v0] Failed to set initial prompt:", err);
        }
      }

      debug.log("[v0] SDK-based setup complete");
    } catch (err: any) {
      debug.error("[v0] Failed to start restyling:", err);
      debug.error("[v0] Error details:", err.message, err.stack);
      setError(err.message || "Failed to connect");
      setIsConnecting(false);
      setIsConnected(false);
      setConnectionState("disconnected");
    }
  };

  const stopRestyling = () => {
    debug.log("[v0] Stopping restyling...");
    isManualDisconnectRef.current = true;

    // Clear timers
    if (connectionTimerRef.current) {
      clearInterval(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
    if (debugIntervalRef.current) {
      clearInterval(debugIntervalRef.current);
      debugIntervalRef.current = null;
    }
    setConnectionTime(0);

    if (realtimeClientRef.current) {
      try {
        realtimeClientRef.current.disconnect();
      } catch (e) {
        debug.error("[v0] Error disconnecting:", e);
      }
      realtimeClientRef.current = null;
    }

    if (clientRef.current) {
      clientRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clean up audio context and oscillator if they exist
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        debug.log("[v0] Oscillator already stopped");
      }
      oscillatorRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        debug.log("[v0] AudioContext close error:", e);
      }
      audioContextRef.current = null;
    }

    if (videoOutputRef.current) {
      // Remove event listeners
      videoOutputRef.current.onloadedmetadata = null;
      videoOutputRef.current.onloadeddata = null;
      videoOutputRef.current.oncanplay = null;
      videoOutputRef.current.onplay = null;
      videoOutputRef.current.onerror = null;
      videoOutputRef.current.onwaiting = null;
      videoOutputRef.current.onstalled = null;
      videoOutputRef.current.srcObject = null;
    }

    setIsConnected(false);
    setConnectionState("disconnected");
    setError(null);
    debug.log("[v0] Restyling stopped");
  };

  const updatePrompt = async () => {
    debug.log("[v0] Updating prompt to:", prompt);
    if (realtimeClientRef.current && isConnected) {
      try {
        await realtimeClientRef.current.setPrompt(prompt, { should_enrich: true });
        debug.log("[v0] Prompt updated successfully");
      } catch (err) {
        debug.error("[v0] Failed to update prompt:", err);
      }
    } else {
      debug.log("[v0] Cannot update prompt - not connected");
    }
  };

  const commitDraftPrompt = async () => {
    debug.log("[v0] Committing draft prompt:", draftPrompt);
    // Update the parent component's prompt state
    onPromptChange(draftPrompt);
    // If connected, also send to API immediately
    if (realtimeClientRef.current && isConnected) {
      try {
        await realtimeClientRef.current.setPrompt(draftPrompt, { should_enrich: true });
        debug.log("[v0] Draft prompt committed and sent to API");
      } catch (err) {
        debug.error("[v0] Failed to commit draft prompt:", err);
      }
    }
  };

  // Sync draft with prompt when it changes from external sources (portals)
  useEffect(() => {
    // Only update draft if the prompt changed from outside (not from our input)
    if (prompt !== draftPrompt) {
      setDraftPrompt(prompt);
      // If connected, also update the API with the new prompt from portal
      if (isConnected && prompt && realtimeClientRef.current) {
        debug.log("[v0] Prompt changed via portal, updating...");
        updatePrompt();
      }
    }
  }, [prompt]);

  useEffect(() => {
    return () => {
      debug.log("[v0] Component unmounting, cleaning up...");
      stopRestyling();
    };
  }, []);

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
        <div
          className={`relative ${isFullscreen ? "w-full h-full" : "aspect-video"}`}
        >
          <video
            ref={videoOutputRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            onLoadedMetadata={() => {
              debug.log("[v0] Video metadata loaded");
              if (videoOutputRef.current) {
                debug.log(
                  "[v0] Video dimensions:",
                  videoOutputRef.current.videoWidth,
                  "x",
                  videoOutputRef.current.videoHeight,
                );
              }
            }}
            onPlay={() => debug.log("[v0] Video playing event fired")}
            onError={(e) => debug.error("[v0] Video error event:", e)}
          />
          {isConnected && (
            <>
              {/* Live indicator */}
              <div
                className={`absolute ${isFullscreen ? "top-24 left-4" : "top-2 right-2"} px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded flex items-center gap-1`}
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              {/* Toggle fullscreen button */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`absolute ${isFullscreen ? "top-24 right-4" : "top-2 left-2"} p-2 bg-black/50 hover:bg-black/70 text-white rounded transition-colors`}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              {/* Prompt display - only show in non-fullscreen */}
              {!isFullscreen && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs font-medium truncate">
                    {prompt}
                  </p>
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
              {/* Prompt Input */}
              <div className="flex gap-2">
                {/* Prompt Input */}
                <div className="flex-1">
                  <Input
                    placeholder="Enter style prompt (e.g., 'Cyberpunk city', 'Watercolor painting')"
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && isConnected) {
                        commitDraftPrompt();
                      }
                    }}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                {isConnected && (
                  <Button
                    onClick={commitDraftPrompt}
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
                  <span className="text-white/80 capitalize">
                    {connectionState}
                  </span>
                  {isConnecting && connectionTime > 0 && (
                    <span className="text-yellow-400 text-xs ml-2">
                      Connecting... {connectionTime}s (may take up to 30s for first frames)
                    </span>
                  )}
                </div>
                {error && <span className="text-red-400 text-xs">{error}</span>}
              </div>

              <div className="text-white/60 text-xs text-center">
                ↑/↓: Climb/Dive | A/D or ←/→: Turn | W/S: Speed | Space: Boost
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}