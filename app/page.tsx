"use client"

import { FlightSimulator } from "@/components/flight-simulator"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-400 to-sky-200">
      <FlightSimulator />
    </main>
  )
}
