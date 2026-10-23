"use client"

import * as React from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion"

import { cn } from "@/lib/utils"

/* Ratios lifted from the reference layout, all relative to the stage box. */
const CARD_H = 0.264 // active card height ÷ stage height
const CARD_AR = 0.75 // active card is 3:4
const GAP = 0.038 // gap ÷ card width
const STRIP_TOP = 0.5 // strip's shared top edge, down the stage
const TITLE = 0.067 // headline cap size ÷ stage height
const LABEL = 0.0103 // small mono label ÷ stage height
const PAD = 0.017 // page gutter ÷ stage width
const RAIL = 0.2 // progress rail width ÷ stage width

/** Wheel distance that commits to a step, and the lockout after one. */
const WHEEL_THRESHOLD = 60
const WHEEL_COOLDOWN = 420

/* Film grain, as a self-contained SVG so the component carries no assets. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const clamp = (n, min, max) =>
  Math.min(max, Math.max(min, n))

export function HeroCarousel({
  items,
  index: controlled,
  defaultIndex = 0,
  onIndexChange,
  brand,
  onBack,
  onMenu,
  onShopNow,
  autoplay = true,
  autoplayDelay = 4000,
  className,
}) {
  const stageRef = React.useRef(null)
  const [box, setBox] = React.useState({ w: 0, h: 0 })
  const [uncontrolled, setUncontrolled] = React.useState(defaultIndex)
  const [dragging, setDragging] = React.useState(false)
  const [paused, setPaused] = React.useState(false)
  const reduced = useReducedMotion()

  const last = items.length - 1
  const index = clamp(controlled ?? uncontrolled, 0, Math.max(0, last))

  const go = React.useCallback(
    (next) => {
      const clamped = clamp(next, 0, Math.max(0, last))
      if (controlled === undefined) setUncontrolled(clamped)
      if (clamped !== index) onIndexChange?.(clamped)
    },
    [controlled, index, last, onIndexChange]
  )

  // One observer feeds every measurement below.
  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const read = () =>
      setBox({ w: stage.clientWidth, h: stage.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  const fullH = clamp(box.h * CARD_H, 96, 360)
  const halfH = fullH / 2
  const cardW = fullH * CARD_AR
  const gap = Math.max(4, Math.round(cardW * GAP))
  const step = cardW + gap
  const pad = Math.max(16, Math.round(box.w * PAD))
  const label = Math.max(9, Math.round(box.h * LABEL))

  // Centre the focused card: the track slides, the card never moves itself.
  const xFor = React.useCallback(
    (i) => box.w / 2 - (i * step + cardW / 2),
    [box.w, step, cardW]
  )
  const x = useMotionValue(0)
  const target = xFor(index)

  const swing = reduced
    ? { duration: 0 }
    : { duration: 0.7, ease: "easeOut" }
  const spring = reduced
    ? { duration: 0 }
    : { type: "spring", stiffness: 260, damping: 34, mass: 0.9 }

  React.useEffect(() => {
    if (dragging) return
    const run = animate(x, target, spring)
    return () => run.stop()
  }, [target, dragging, reduced, x]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autoplay: moves automatically without scroll interference
  React.useEffect(() => {
    if (!autoplay || dragging || items.length < 2) return
    const id = window.setTimeout(
      () => go(index === last ? 0 : index + 1),
      autoplayDelay
    )
    return () => window.clearTimeout(id)
  }, [autoplay, autoplayDelay, dragging, go, index, items.length, last])

  const active = items[index]
  if (!active) return null

  const lines = active.title.split("\n")
  const accent = active.accent ?? "#8a8a8a"

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label="Featured looks"
      onKeyDown={(e) => {
        const keys = {
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          Home: 0,
          End: last,
        }
        if (!(e.key in keys)) return
        e.preventDefault()
        go(keys[e.key])
      }}
      className={cn(
        "relative h-[100dvh] min-h-[580px] w-full overflow-hidden bg-black text-white select-none",
        "outline-none focus-visible:ring-1 focus-visible:ring-white/40 focus-visible:ring-inset",
        className
      )}
    >
      {/* ── Background: the focused photo, blown up and re-hued to its accent ── */}
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={swing}
        >
          <motion.img
            src={active.image}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ scale: reduced ? 1.28 : 1.42 }}
            animate={{ scale: 1.28 }}
            transition={reduced ? { duration: 0 } : { duration: 6, ease: "linear" }}
          />
          {/* Keep the photo's luminance, take the accent's hue. */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: accent, mixBlendMode: "color" }}
          />
          <div
            className="absolute inset-0 opacity-55"
            style={{ backgroundColor: accent, mixBlendMode: "multiply" }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Legibility wash + grain, above the swap so they never flicker. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/45 pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
      />

      {/* ── Headline block, sitting just above the strip's top edge ── */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col justify-end z-20 pointer-events-none"
        style={{
          height: `${STRIP_TOP * 100}%`,
          paddingBottom: Math.round(box.h * 0.028),
        }}
      >
        <div className="container w-full pointer-events-auto">
          <div className="flex flex-col items-start gap-2.5 sm:gap-3.5 max-w-2xl">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.h2
                key={index}
                className="font-semibold leading-[0.92] tracking-[-0.03em] drop-shadow-md"
                style={{ fontSize: Math.max(26, Math.round(box.h * TITLE)) }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.18 } }}
              >
                {lines.map((line, i) => (
                  <span key={i} className="block overflow-hidden">
                    <motion.span
                      className="block"
                      initial={{ y: "110%" }}
                      animate={{ y: 0 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { duration: 0.62, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </motion.h2>
            </AnimatePresence>

            {/* Pricing & Review Stars */}
            <motion.div
              key={`meta-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="flex flex-col items-start gap-2 sm:gap-2.5"
            >
              {/* Review Stars (above rate) */}
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
                <div className="flex items-center gap-0.5 text-[#F9D949]">
                  {[...Array(5)].map((_, starI) => (
                    <svg
                      key={starI}
                      className="w-3.5 h-3.5 fill-[#F9D949]"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-bold text-white ml-0.5">
                  {active.rating || "4.9"}
                </span>
                <span className="text-[11px] sm:text-xs text-white/60">
                  ({active.reviews || "2.4k+"})
                </span>
              </div>

              {/* Price Tag (Rate below stars) */}
              <div className="flex items-baseline gap-2 sm:gap-2.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  {active.price || "₹3,499"}
                </span>
                {active.originalPrice && (
                  <span className="text-sm sm:text-base text-white/50 line-through">
                    {active.originalPrice}
                  </span>
                )}
                {active.discount && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#059669] text-white shadow-sm tracking-wide">
                    {active.discount}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── The strip: one shared top edge, the focused card twice as tall ── */}
      <div
        className="absolute inset-x-0 z-20"
        style={{ top: `${STRIP_TOP * 100}%`, height: fullH }}
      >
        <motion.div
          className="flex items-start"
          style={{ gap, x, cursor: dragging ? "grabbing" : "grab" }}
          drag="x"
          dragMomentum={false}
          dragElastic={0.08}
          dragConstraints={{ left: xFor(last), right: xFor(0) }}
          onDragStart={() => setDragging(true)}
          onDragEnd={(_, info) => {
            setDragging(false)
            const thrown = x.get() + info.velocity.x * 0.12
            go(Math.round((box.w / 2 - thrown - cardW / 2) / step))
          }}
        >
          {items.map((item, i) => (
            <motion.button
              key={item.id ?? i}
              type="button"
              aria-label={item.title.replace(/\n/g, " ")}
              aria-current={i === index}
              onClick={() => go(i)}
              className="relative shrink-0 overflow-hidden rounded-none bg-white/5 cursor-pointer shadow-lg"
              style={{ width: cardW }}
              animate={{ height: i === index ? fullH : halfH }}
              transition={spring}
            >
              <img
                src={item.image}
                alt=""
                draggable={false}
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 26%" }}
              />
              <motion.span
                aria-hidden
                className="absolute inset-0 bg-black"
                animate={{ opacity: i === index ? 0 : 0.12 }}
                transition={spring}
              />
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* ── Bottom Bar: Position rail & Shop Now CTA Button ── */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 pointer-events-none"
        style={{ paddingBottom: Math.max(14, box.h * 0.022) }}
      >
        <div className="container w-full flex items-end justify-between">
          {/* Position rail */}
          <div
            className="pointer-events-auto"
            style={{ width: clamp(box.w * RAIL, 140, 240) }}
          >
            <div
              className="flex justify-between font-mono tabular-nums opacity-80"
              style={{ fontSize: label }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{String(items.length).padStart(2, "0")}</span>
            </div>
            <div className="relative mt-2 h-px w-full bg-white/25">
              <motion.div
                className="absolute inset-y-0 bg-[#F9D949]"
                style={{ width: `${100 / items.length}%` }}
                animate={{ left: `${(index / items.length) * 100}%` }}
                transition={spring}
              />
            </div>
          </div>

          {/* Bottom Right: Shop Now CTA Button */}
          <div className="pointer-events-auto">
            <motion.button
              key={`shop-now-${index}`}
              type="button"
              onClick={() => onShopNow ? onShopNow(active, index) : (window.location.href = '/products')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center gap-3.5 pl-6 pr-2 py-2 rounded-full font-semibold shadow-sm transition-all duration-300 cursor-pointer select-none text-white border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/15 hover:border-[#F9D949]/70 hover:shadow-[0_0_25px_rgba(249,217,73,0.35)]"
            >
              <span className="font-bold text-xs sm:text-sm tracking-wider uppercase text-white transition-colors duration-300">Shop Now</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 border border-white/20 text-white flex items-center justify-center transition-all duration-300 group-hover:bg-[#F9D949] group-hover:border-[#F9D949] group-hover:text-black shadow-sm group-hover:shadow-[0_0_15px_rgba(249,217,73,0.65)]">
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
