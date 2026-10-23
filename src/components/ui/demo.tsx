"use client"

import {   
  HeroCarousel,
  type HeroCarouselItem,
} from "@/components/ui/hero-carousel"

// Placeholder art served straight off the crafterui CDN so the demo works the
// moment it is installed - no assets to copy into your public/. Swap the names
// for your own art direction; each item's `accent` is the hue the whole
// backdrop grades to when that card takes focus.
const ART = (name: string) =>
  `https://pub-45c4a3d9611041d08fe82d52599b72b0.r2.dev/primary-showcase-assets/${name}.jpg`

const LOOKS: HeroCarouselItem[] = [
  {
    title: "Titanium\nSmartwatch",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200&auto=format&fit=crop",
    credit: "BY SMILEY N TRADERS.",
    meta: ["AMOLED 120HZ", "TITANIUM CASE", "48H BATTERY"],
    accent: "#C99738",
  },
  {
    title: "Acoustic\nPrecision",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200&auto=format&fit=crop",
    credit: "BY STUDIO MASTER.",
    meta: ["LOSSLESS AUDIO", "ACTIVE NC", "40H PLAYTIME"],
    accent: "#b88424",
  },
  {
    title: "Pure\nWireless",
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=1200&auto=format&fit=crop",
    credit: "BY SONIC LAB.",
    meta: ["SPATIAL AUDIO", "TOUCH CONTROLS", "IPX7"],
    accent: "#00c8ff",
  },
  {
    title: "Cyber\nOptics",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1200&auto=format&fit=crop",
    credit: "BY FLAGSHIP LABS.",
    meta: ["OLED CINEMA", "108MP PRO", "5G SPEED"],
    accent: "#e5231b",
  },
  {
    title: "Immersive\nReality",
    image: "https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?q=80&w=1200&auto=format&fit=crop",
    credit: "BY HORIZON LABS.",
    meta: ["4K HDR", "120 FPS", "SPATIAL TRACK"],
    accent: "#7c3aed",
  },
  {
    title: "Monolith\nBass",
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?q=80&w=1200&auto=format&fit=crop",
    credit: "BY ATELIER SOUND.",
    meta: ["DOLBY ATMOS", "360 SOUND", "CAST AUDIO"],
    accent: "#dfac46",
  },
]

// ONLY DEFAULT EXPORT WILL BE TREATED AS A DEMO
export default function DemoOne() {
  return (
    <HeroCarousel
      items={LOOKS}
      defaultIndex={0}
      brand="SMILEY N TRADERS"
      onBack={() => {}}
      onMenu={() => {}}
      autoplay={true}
      autoplayDelay={4500}
    />
  )
}
