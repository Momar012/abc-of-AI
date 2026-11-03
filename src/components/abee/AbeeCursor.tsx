'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useAbeeStore } from '@/store/useAbeeStore'
import { resolveTarget } from '@/lib/abee/targets'
import { outputLevel } from '@/lib/abee/realtime'

/** Where the dot rests relative to the mouse pointer */
const OFFSET = 18
/** How long a hint pointer lingers after Abee stops talking (demo pointers stay until the next move) */
const POINT_MS = 2500
/** How long a "drag from here to there" path lingers after Abee stops talking */
const PATH_MS = 3000
/** Safety limit while Abee is still talking, in case its status gets stuck */
const MAX_HINT_MS = 20_000
/** The dot rests on the path's start this long before travelling to its end */
const PATH_START_MS = 700

/**
 * Abee's presence on screen: a small glowing dot that trails the cursor while
 * Abee is on. It ripples while listening, spins while thinking, breathes with
 * the voice while speaking, and flies off to point at things.
 */
export default function AbeeCursor() {
  const active = useAbeeStore((s) => s.active)
  const status = useAbeeStore((s) => s.status)
  const connection = useAbeeStore((s) => s.connection)
  const laser = useAbeeStore((s) => s.laser)
  const laserPath = useAbeeStore((s) => s.laserPath)
  const clearLaser = useAbeeStore((s) => s.clearLaser)

  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 260, damping: 28, mass: 0.7 })
  const sy = useSpring(y, { stiffness: 260, damping: 28, mass: 0.7 })
  const level = useMotionValue(1)

  const mouse = useRef<{ x: number; y: number } | null>(null)
  const pointing = useRef(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [path, setPath] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [seen, setSeen] = useState(false)

  // Rest by the cursor, or by Abee's switch on touchscreens where there's no cursor
  const restPosition = () => {
    if (mouse.current) return { x: mouse.current.x + OFFSET, y: mouse.current.y + OFFSET }
    const orb = document.querySelector('[data-abee="abee"]')?.getBoundingClientRect()
    return orb ? { x: orb.left + orb.width / 2, y: orb.top - 14 } : { x: window.innerWidth - 40, y: window.innerHeight - 60 }
  }

  useEffect(() => {
    if (!active) return
    const p = restPosition()
    x.jump(p.x); y.jump(p.y)
    setSeen(true)
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      mouse.current = { x: e.clientX, y: e.clientY }
      if (!pointing.current) { x.set(e.clientX + OFFSET); y.set(e.clientY + OFFSET) }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Fly to whatever Abee is pointing at, and keep tracking it as the canvas moves
  useEffect(() => {
    if (!laser && laserPath) {
      // Show a drag: rest on the start, then glide to the end, tracking both as the canvas moves
      pointing.current = true
      setTargetRect(null)
      const startedAt = performance.now()
      let raf = 0
      const tick = () => {
        const a = resolveTarget(laserPath.from)
        const b = resolveTarget(laserPath.to)
        if (a && b) {
          const p = { x1: a.left + a.width / 2, y1: a.top + a.height / 2, x2: b.left + b.width / 2, y2: b.top + b.height / 2 }
          setPath((prev) => (prev && prev.x1 === p.x1 && prev.y1 === p.y1 && prev.x2 === p.x2 && prev.y2 === p.y2 ? prev : p))
          const atEnd = performance.now() - startedAt > PATH_START_MS
          x.set(atEnd ? p.x2 : p.x1)
          y.set(atEnd ? p.y2 : p.y1)
        }
        raf = requestAnimationFrame(tick)
      }
      tick()
      return () => { cancelAnimationFrame(raf); setPath(null) }
    }
    if (!laser) {
      pointing.current = false
      setTargetRect(null)
      const p = restPosition()
      x.set(p.x); y.set(p.y)
      return
    }
    pointing.current = true
    let raf = 0
    const tick = () => {
      const r = resolveTarget(laser.target)
      if (r) {
        x.set(r.left + r.width / 2)
        y.set(r.top + r.height / 2)
      }
      setTargetRect((prev) =>
        prev && r && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r,
      )
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laser, laserPath])

  // Hints stay up while Abee is still explaining them, then linger a moment
  // after it stops talking — so the pointer is there when Abee says "this one"
  const explaining = status === 'thinking' || status === 'speaking'

  useEffect(() => {
    if (!laserPath) return
    const nonce = laserPath.nonce
    const clear = () => { if (useAbeeStore.getState().laserPath?.nonce === nonce) clearLaser() }
    const t = setTimeout(clear, explaining ? MAX_HINT_MS : PATH_MS)
    return () => clearTimeout(t)
  }, [laserPath, explaining, clearLaser])

  useEffect(() => {
    if (!laser || laser.sticky) return
    const nonce = laser.nonce
    const clear = () => { if (useAbeeStore.getState().laser?.nonce === nonce) clearLaser() }
    const t = setTimeout(clear, explaining ? MAX_HINT_MS : POINT_MS)
    return () => clearTimeout(t)
  }, [laser, explaining, clearLaser])

  // Breathe with Abee's voice
  useEffect(() => {
    if (status !== 'speaking') { level.set(1); return }
    let raf = 0
    const tick = () => {
      level.set(1 + outputLevel() * 0.9)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [status, level])

  const thinking = status === 'thinking' || connection === 'connecting'
  const errored = connection === 'error' && status === 'idle'
  const show = active && seen

  return (
    <div className="fixed inset-0 pointer-events-none z-[10003]" aria-hidden>
      {/* Dotted laser line: "drag from here to there" (a CSS fade; framer's SVG fade stayed at 0) */}
      {show && laserPath && path && (
        <svg key={laserPath.nonce} className="absolute inset-0 w-full h-full overflow-visible animate-fade-in">
          {/* Glow as a faint wide line underneath — Chrome doesn't reliably paint CSS filters on SVG lines */}
          <line
            x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2}
            stroke="rgba(103,232,249,0.22)" strokeWidth={7} strokeLinecap="round"
          />
          <line
            x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2}
            stroke="rgba(165,243,252,0.95)" strokeWidth={2} strokeDasharray="4 6" strokeLinecap="round"
          />
          <circle cx={path.x1} cy={path.y1} r={11} fill="none" stroke="rgba(103,232,249,0.85)" strokeWidth={1.5} />
          <circle cx={path.x2} cy={path.y2} r={11} fill="none" stroke="rgba(103,232,249,0.85)" strokeWidth={1.5} />
          {laserPath.note && (
            <foreignObject x={path.x1 + 14} y={path.y1 + 10} width={160} height={28}>
              <span className="inline-block whitespace-nowrap rounded-md bg-slate-950/80 px-2 py-0.5 text-[11px] font-heading font-semibold tracking-wide text-cyan-100 border border-cyan-300/25">
                {laserPath.note}
              </span>
            </foreignObject>
          )}
        </svg>
      )}

      {/* Thin outline around the thing being pointed at */}
      <AnimatePresence>
        {show && laser && targetRect && (
          <motion.div
            key={laser.target}
            className="absolute rounded-xl border border-cyan-300/70 shadow-[0_0_24px_rgba(103,232,249,0.35),inset_0_0_12px_rgba(103,232,249,0.15)]"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ left: targetRect.left - 5, top: targetRect.top - 5, width: targetRect.width + 10, height: targetRect.height + 10 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {show && (
          <motion.div
            className="absolute left-0 top-0"
            style={{ x: sx, y: sy }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="relative">
              {/* Soft halo */}
              <motion.span
                className={`absolute -left-4 -top-4 w-8 h-8 rounded-full blur-md ${errored ? 'bg-amber-400/25' : 'bg-cyan-400/25'}`}
                style={{ scale: level }}
              />

              {/* Listening: ripples */}
              {status === 'listening' && [0, 0.6].map((delay) => (
                <motion.span
                  key={delay}
                  className="absolute -left-3 -top-3 w-6 h-6 rounded-full border border-cyan-200/80"
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, delay, ease: 'easeOut' }}
                />
              ))}

              {/* Thinking: an orbiting arc */}
              {thinking && (
                <motion.span
                  className="absolute -left-[11px] -top-[11px] w-[22px] h-[22px] rounded-full border-[1.5px] border-transparent border-t-cyan-200 border-r-cyan-200/40"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Core */}
              <motion.span
                className={`absolute rounded-full ${
                  errored
                    ? 'bg-amber-200 shadow-[0_0_10px_3px_rgba(251,191,36,0.7)]'
                    : 'bg-cyan-100 shadow-[0_0_12px_4px_rgba(103,232,249,0.75)]'
                }`}
                animate={{
                  width: status === 'listening' ? 12 : laser ? 11 : 8,
                  height: status === 'listening' ? 12 : laser ? 11 : 8,
                  left: status === 'listening' ? -6 : laser ? -5.5 : -4,
                  top: status === 'listening' ? -6 : laser ? -5.5 : -4,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                style={{ scale: level }}
              />

              {laser?.note && (
                <span className="absolute left-4 top-3 whitespace-nowrap rounded-md bg-slate-950/80 px-2 py-0.5 text-[11px] font-heading font-semibold tracking-wide text-cyan-100 border border-cyan-300/25 backdrop-blur-sm">
                  {laser.note}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
