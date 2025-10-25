# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a 3D flight simulator built with Next.js, React Three Fiber, and the Decart AI SDK. The application renders a 3D scene with a controllable plane and uses real-time AI video restyling to transform the visual output with different artistic styles through interactive portals.

## Development Commands

```bash
# Development
pnpm dev              # Start development server (default: http://localhost:3000)

# Build & Production
pnpm build            # Build for production
pnpm start            # Start production server

# Linting
pnpm lint             # Run ESLint
```

## Architecture

### Core Components Structure

The app follows a Next.js App Router structure with a component-based 3D rendering architecture:

```
app/page.tsx (Entry point)
    └── components/flight-simulator.tsx (Main orchestrator)
        ├── Canvas (Three.js @ 1280x704, 25 FPS)
        │   ├── Sky, Cloud (Drei components)
        │   ├── Lighting (Ambient + Directional)
        │   ├── Plane (Controllable aircraft)
        │   ├── Terrain (Procedural chunk-based)
        │   └── PromptPortals[] (Style triggers)
        ├── VideoRestylingSDK (Decart AI integration)
        └── UI Controls (Header, HUD, Bottom panel)
```

### Key Technical Details

**3D Rendering Pipeline:**
- Canvas is configured with `frameloop="always"` and renders at 25 FPS
- Canvas resolution is hardcoded to 1280x704 to match Decart AI API requirements (flight-simulator.tsx:136)
- The canvas stream is captured at 25 FPS using `canvasElement.captureStream(25)`
- `preserveDrawingBuffer: true` is set for canvas capture compatibility

**Plane Controls & Physics:**
- Keyboard state management using React hooks for WASD and Arrow keys
- Space for boost (speed 35), Shift for brake (speed 10), default speed 20
- Camera follows plane with dynamic distance based on speed (12 + (speed-20)*0.3)
- Plane physics include automatic roll/pitch dampening when keys released
- Ground collision detection at y=1.5 with auto-pull-up assist
- Ceiling limit at y=200

**Terrain System:**
- Chunk-based generation (150 unit chunks) with 400 unit render distance
- Procedural terrain types based on chunk density:
  - 0-50%: Empty (performance optimization)
  - 50-65%: Forest (3-6 trees)
  - 65-85%: City (4-8 buildings)
  - 85-100%: Landmarks (towers/mountains)
- Automatic cleanup of chunks beyond 480 units
- Uses seeded random generation for world consistency

**Portal System:**
- 8 predefined portals with unique art styles (Watercolor, Synthwave, Anime, Van Gogh, Minecraft, Tim Burton, Studio Ghibli, Cyberpunk)
- Trigger radius: 5 units from portal center
- 3-second cooldown between automatic portal triggers
- Visual effects: rotating torus with pulsing glow based on proximity

**Video Restyling Integration:**
- Uses the Decart AI SDK (@decartai/sdk v0.0.6) with "mirage" and "mirage_v2" models
- Captures the Three.js canvas as a MediaStream
- Sends stream to Decart API with text prompts for real-time style transformation
- Displays transformed video in a floating overlay when connected
- Includes automatic reconnection logic on unexpected disconnects
- SDK-based implementation in video-restyling-sdk.tsx (active)
- WebRTC reference implementation in video-restyling-vanilla.tsx (not currently used)

### State Flow

1. User input (keyboard/mouse) → Plane component updates position and rotation
2. Plane emits position updates via `onPositionChange` callback
3. FlightSimulator receives position and updates:
   - Terrain system for chunk generation/cleanup
   - Portal system for distance-based triggering
4. Canvas element captured as MediaStream at 25 FPS
5. Stream sent to Decart API with current prompt
6. Transformed video displayed in overlay

## Important Constraints

- **Canvas Resolution**: Must be exactly 1280x704 (Decart API requirement)
- **Frame Rate**: 25 FPS for video capture (hardcoded in stream capture)
- **Build Configuration**: TypeScript and ESLint checks disabled (`ignoreBuildErrors: true`, `ignoreDuringBuilds: true`)
- **Deployment**: Auto-syncs with v0.app, deployed on Vercel
- **Package Manager**: Uses pnpm exclusively

## Key Dependencies

- **@decartai/sdk v0.0.6**: Real-time AI video transformation
- **@react-three/fiber & three**: 3D rendering with React
- **@react-three/drei**: Reusable Three.js components (Sky, Cloud, Text)
- **@radix-ui/react-select**: Accessible UI components for model selector
- **lucide-react**: Icon library for UI elements
- **Next.js 15.2.4 with React 19**: Framework and UI library