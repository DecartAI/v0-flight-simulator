# ✈️ 3D Flight Simulator with AI Style Transfer

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/ethanp/v0-3-d-flight-simulator)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/A0Jvrxor06O)

## 🎮 Overview

A real-time 3D flight simulator built with Next.js and React Three Fiber that features AI-powered video style transformation. Fly through a procedurally generated world and pass through magical portals that transform the entire visual experience using Decart's AI video restyling technology.

![Flight Simulator Demo](https://img.shields.io/badge/Status-Live-green)

## ✨ Features

- **🕹️ Arcade Flight Physics** - Easy-to-control airplane with keyboard and optional mouse controls
- **🌍 Procedural Terrain Generation** - Infinite world with forests, cities, and landmarks
- **🎨 AI Style Transfer** - Real-time video transformation using Decart AI SDK
- **🌀 Interactive Style Portals** - 8 magical portals that trigger different art styles:
  - Watercolor painting
  - 80s Synthwave
  - Anime cel-shaded
  - Van Gogh oil painting
  - Minecraft blocky world
  - Tim Burton gothic
  - Studio Ghibli landscapes
  - Cyberpunk city
- **☁️ Atmospheric Effects** - Dynamic sky, clouds, and lighting
- **📺 25 FPS Optimized Rendering** - Smooth performance at 1280x704 resolution

## 🛠️ Tech Stack

- **Framework:** Next.js 15.2.4 with React 19
- **3D Graphics:** React Three Fiber + Three.js
- **3D Components:** React Three Drei (Sky, Clouds, Text)
- **AI Integration:** Decart AI SDK v0.0.6
- **Styling:** Tailwind CSS 4.1.9
- **Icons:** Lucide React
- **TypeScript:** Full type safety

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Decart API key (get one at [decart.ai](https://decart.ai))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/v0-flight-simulator.git
cd v0-flight-simulator

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start flying!

### Production Build

```bash
npm run build
npm start
```

## 🎮 Controls

### Keyboard Controls
- **W/S** or **Up/Down Arrow** - Pitch up/down
- **A/D** or **Left/Right Arrow** - Turn left/right
- **Space** - Boost (speed 35)
- **Shift** - Brake (speed 10)
- **Right Click** - Toggle mouse controls

### Flight Mechanics
- Default speed: 20 units/frame
- Auto-level when not pitching
- Ground collision bounce at y=1.5
- Ceiling limit at y=200
- Smooth banking on turns

## 🏗️ Architecture

```
app/
├── page.tsx                          # Entry point
components/
├── flight-simulator.tsx              # Main orchestrator
├── plane.tsx                         # Aircraft model & physics
├── terrain.tsx                       # Procedural world generation
├── prompt-portal.tsx                 # Style portal triggers
└── video-restyling-sdk.tsx          # Decart AI integration
lib/
├── debug.ts                          # Debug utility
└── utils.ts                          # Utility functions
```

### Key Components

- **FlightSimulator** - Manages canvas, state, and coordinates all components
- **Plane** - Handles aircraft rendering, physics, and camera following
- **Terrain** - Chunk-based procedural generation with automatic cleanup
- **PromptPortal** - Interactive style triggers with visual effects
- **VideoRestylingSDK** - Decart AI stream processing and display

## ⚙️ Configuration

### Canvas Settings
- Resolution: **1280x704** (required by Decart API)
- Frame rate: **25 FPS**
- Rendering: Continuous mode with preserveDrawingBuffer

### Terrain Generation
- Chunk size: 150 units
- Render distance: 400 units
- Cleanup distance: 480 units
- Terrain types by density:
  - 0-50%: Empty
  - 50-65%: Forest
  - 65-85%: City
  - 85-100%: Landmarks

## 📄 License

This project is part of the v0.app ecosystem.

## 🙏 Acknowledgments

- Built with [v0.app](https://v0.app) by Vercel
- AI video transformation powered by [Decart AI](https://decart.ai)
- 3D graphics powered by [Three.js](https://threejs.org) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
