'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMissionStore, starsFor, pointsForStars } from '@/store/useMissionStore'
import { useTourStore } from '@/store/useTourStore'
import { useUIStore } from '@/store/useUIStore'
import { MISSIONS, MISSION_TOTAL, missionNumber, resolveHint, startMission, missionBlocks, oldBlocks } from '@/lib/missions/missions'
import { removeBlocks } from '@/lib/canvas/removeBlocks'
import type { StepView } from '@/lib/tour/steps'
import Spotlight, { placeBubble, useTrackedBoxes } from '@/components/tour/Spotlight'

const TICK_MS = 250

function Stars({ n, size = 'text-xl' }: { n: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? '' : 'opacity-25 grayscale'}>⭐</span>
      ))}
    </span>
  )
}

export { Stars }

/** Re-reads a value from the canvas twice a second (block counts change as kids add/delete). */
function useLive<T>(read: () => T, deps: unknown[] = []): T {
  const [v, setV] = useState<T>(read)
  useEffect(() => {
    const id = window.setInterval(() => setV(read()), 500)
    setV(read())
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return v
}

/** After a mission: nudge the kid to delete what they built, so the next mission starts on a clean canvas. */
function TidyUp({ activeId }: { activeId: string }) {
  const count = useLive(() => missionBlocks(useMissionStore.getState().baseline).length, [activeId])
  if (count === 0) {
    return (
      <p className="mt-3 text-xs font-body text-teal-200 bg-teal-500/10 border border-teal-400/25 rounded-lg px-3 py-2">
        ✨ All tidy! Your mission blocks are gone. Ready for the next mission!
      </p>
    )
  }
  return (
    <div className="mt-3 text-left text-xs font-body text-white/75 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
      <p>🧹 <span className="font-semibold text-white">Keep your canvas tidy!</span> Delete the blocks you used in this mission before the next one.</p>
      <button
        onClick={() => removeBlocks(missionBlocks(useMissionStore.getState().baseline))}
        className="mt-2 w-full py-1.5 rounded-lg font-heading font-bold text-rose-100 bg-rose-500/15 border border-rose-400/30 hover:bg-rose-500/25"
      >
        🗑️ Delete my mission blocks ({count})
      </button>
    </div>
  )
}

/** At the start of a mission: if old blocks are lying around, offer to clear them (tap twice to confirm). */
function StartFresh({ activeId }: { activeId: string }) {
  const count = useLive(() => oldBlocks(useMissionStore.getState().baseline).length, [activeId])
  const [confirming, setConfirming] = useState(false)
  useEffect(() => setConfirming(false), [activeId])
  if (count === 0) return null
  return (
    <div className="mt-3 text-xs font-body text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
      <p>🧹 Your canvas still has <span className="font-semibold text-white">{count} old block{count === 1 ? '' : 's'}</span>. Start this mission on a clean canvas?</p>
      <button
        onClick={() => {
          if (!confirming) { setConfirming(true); return }
          removeBlocks(oldBlocks(useMissionStore.getState().baseline))
          setConfirming(false)
        }}
        className={`mt-2 w-full py-1.5 rounded-lg font-heading font-bold border ${
          confirming ? 'text-white bg-rose-500/60 border-rose-300/60' : 'text-rose-100 bg-rose-500/15 border-rose-400/30 hover:bg-rose-500/25'
        }`}
      >
        {confirming ? `Tap again to delete ${count} block${count === 1 ? '' : 's'}` : '🗑️ Clear canvas'}
      </button>
    </div>
  )
}

/** How much of a card placed at `left` (bottom of the screen) would cover blocks, menus or Properties. */
function coverage(left: number, w: number, h: number) {
  const top = window.innerHeight - 16 - h
  const right = left + w
  const bottom = window.innerHeight - 16
  let area = 0
  document.querySelectorAll('.react-flow__node, [data-menu-dropdown], [data-properties-panel]').forEach((el) => {
    const r = el.getBoundingClientRect()
    const x = Math.min(right, r.right) - Math.max(left, r.left)
    const y = Math.min(bottom, r.bottom) - Math.max(top, r.top)
    if (x > 0 && y > 0) area += x * y * (el.matches('[data-menu-dropdown], [data-properties-panel]') ? 10 : 1)
  })
  return area
}

/** null = bottom-right (default); a number = left position at the bottom-left of the canvas. */
function pickCorner(card: HTMLElement | null, current: number | null): number | null {
  const w = card?.offsetWidth ?? 320
  const h = card?.offsetHeight ?? 260
  const rightX = window.innerWidth - 16 - w
  const leftX = Math.round((document.querySelector('[data-tour="canvas"]')?.getBoundingClientRect().left ?? 0) + 16)
  if (leftX + w > rightX) return null // narrow screen: only one spot
  const atRight = coverage(rightX, w, h)
  const atLeft = coverage(leftX, w, h)
  // Stay put unless the other corner is clearly better (no flip-flopping while dragging).
  if (current === null) return atRight > 0 && atLeft < atRight * 0.6 ? leftX : null
  return atLeft > 0 && atRight < atLeft * 0.6 ? null : leftX
}

/** The floating card for the mission being played: live checklist, 💡 Hint, success + stars. */
export default function MissionCard() {
  const activeId = useMissionStore((s) => s.activeId)
  const hintsUsed = useMissionStore((s) => s.hintsUsed)
  const tourStatus = useTourStore((s) => s.status)

  const [mounted, setMounted] = useState(false)
  const [ticked, setTicked] = useState<boolean[]>([])
  const [hintFor, setHintFor] = useState<number | null>(null)
  const [hintView, setHintView] = useState<StepView | null>(null)
  const [playKey, setPlayKey] = useState(0)
  const [wonStars, setWonStars] = useState<number | null>(null)
  const [minimised, setMinimised] = useState(false)
  // The card sits bottom-right, but slides to bottom-left when it would cover blocks,
  // an open toolbar menu, or the Properties panel (whichever corner hides less).
  const [dodgeLeft, setDodgeLeft] = useState<number | null>(null)
  const wonRef = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const mission = useMemo(() => MISSIONS.find((m) => m.id === activeId) ?? null, [activeId])
  const number = activeId ? missionNumber(activeId) : 0
  const nextMission = number > 0 ? MISSIONS[number] ?? null : null
  const visible = mounted && !!mission && tourStatus !== 'active'

  // Fresh attempt → reset local UI.
  useEffect(() => {
    setTicked([])
    setHintFor(null)
    setHintView(null)
    setWonStars(null)
    setMinimised(false)
    wonRef.current = false
  }, [activeId])

  // Watch the canvas: tick checklist items (they stay ticked) and check for success.
  useEffect(() => {
    if (!visible || !mission) return
    const tick = () => {
      setDodgeLeft((prev) => {
        const next = pickCorner(cardRef.current, prev)
        return prev === next ? prev : next
      })
      if (wonRef.current) return
      const { baseline } = useMissionStore.getState()
      setTicked((prev) => {
        const next = mission.steps.map((s, i) => !!prev[i] || s.isDone(baseline))
        return next.every((v, i) => v === !!prev[i]) && prev.length === next.length ? prev : next
      })
      if (mission.check(baseline)) {
        wonRef.current = true
        setHintFor(null)
        setHintView(null)
        const store = useMissionStore.getState()
        const stars = store.complete(mission.id)
        setWonStars(stars)
        setMinimised(false)
        const done = Object.keys(useMissionStore.getState().results).length
        const ui = useUIStore.getState()
        if (done >= MISSION_TOTAL && MISSIONS.length >= MISSION_TOTAL && !ui.earnedBadges.includes('mission-master')) {
          ui.earnBadge('mission-master')
          ui.addToast('🎯 New badge: Mission Master! You finished every mission!', 'success')
        }
      }
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(id)
  }, [visible, mission])

  // Keep the hint pointing at the right thing (it can change, e.g. a menu closes).
  useEffect(() => {
    if (hintFor === null || !mission) return
    if (ticked[hintFor]) {
      // That item is done — hint goes away until asked again.
      setHintFor(null)
      setHintView(null)
      return
    }
    const update = () => {
      const v = resolveHint(mission.steps[hintFor].hint)
      setHintView((prev) => (prev && JSON.stringify(prev) === JSON.stringify(v) ? prev : v))
    }
    update()
    const id = window.setInterval(update, TICK_MS)
    return () => window.clearInterval(id)
  }, [hintFor, ticked, mission])

  // Replay the ghost hand whenever the hint target/gesture changes.
  useEffect(() => {
    if (hintView) setPlayKey((k) => k + 1)
  }, [hintView?.target, hintView?.gesture]) // eslint-disable-line react-hooks/exhaustive-deps

  const boxes = useTrackedBoxes(hintView)

  if (!visible || !mission) return null

  const firstOpen = ticked.length ? ticked.findIndex((t) => !t) : 0
  const showHint = () => {
    const idx = firstOpen === -1 ? mission.steps.length - 1 : firstOpen
    useMissionStore.getState().takeHint()
    setHintFor(idx)
    setPlayKey((k) => k + 1)
  }

  return createPortal(
    <>
      {hintView && wonStars === null && (
        <>
          <Spotlight view={hintView} targetBox={boxes.targetBox} dragToBox={boxes.dragToBox} showHand playKey={playKey} />
          {/* The hint itself, right next to what it points at */}
          <motion.div
            key={hintView.text}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed z-[10004] pointer-events-none glass-card border border-cyan-400/40 px-3 py-2 shadow-2xl"
            style={{ ...placeBubble(boxes.targetBox, boxes.avoidBox, 64, hintView.prefer), width: 'min(320px, calc(100vw - 32px))' }}
          >
            <p className="text-sm font-body text-cyan-50">💡 {hintView.text}</p>
          </motion.div>
        </>
      )}

      <motion.div
        ref={cardRef}
        data-canvas-avoid
        key={mission.id}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed z-[10005] bottom-4 glass-card border border-amber-300/40 shadow-2xl p-4 pointer-events-auto"
        style={{ width: 'min(320px, calc(100vw - 32px))', ...(dodgeLeft !== null ? { left: dodgeLeft } : { right: 16 }) }}
        role="dialog"
        aria-label={`Mission ${number}: ${mission.title}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-amber-300">
            🎯 Mission {number} of {MISSION_TOTAL}
          </span>
          <button
            onClick={() => setMinimised((m) => !m)}
            className="ml-auto w-7 h-7 rounded-md text-white/40 hover:text-white hover:bg-white/10 text-sm"
            title={minimised ? 'Show mission' : 'Hide mission'}
            aria-label={minimised ? 'Show mission' : 'Hide mission'}
          >
            {minimised ? '▴' : '▾'}
          </button>
          <button
            onClick={() => useMissionStore.getState().quit()}
            className="w-7 h-7 rounded-md text-white/40 hover:text-white hover:bg-white/10 text-base leading-none"
            title={wonStars !== null ? 'Close' : 'Close mission (you can start it again from Missions)'}
            aria-label="Close mission"
          >
            ×
          </button>
        </div>
        <p className="font-heading font-extrabold text-white text-base mt-0.5">
          <span className="mr-1.5">{mission.emoji}</span>
          {mission.title}
        </p>

        <AnimatePresence initial={false}>
          {!minimised && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {wonStars !== null ? (
                <div className="relative text-center pt-3">
                  {/* little confetti burst */}
                  {Array.from({ length: 14 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="pointer-events-none absolute left-1/2 top-6 text-lg"
                      initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                      animate={{
                        x: Math.cos((i / 14) * Math.PI * 2) * (70 + (i % 3) * 25),
                        y: Math.sin((i / 14) * Math.PI * 2) * (50 + (i % 3) * 20) - 20,
                        opacity: 0,
                        scale: 1.1,
                      }}
                      transition={{ duration: 1.1, ease: 'easeOut' }}
                    >
                      {['⭐', '✨', '🎉', '🌟'][i % 4]}
                    </motion.span>
                  ))}
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.2, 1] }} transition={{ duration: 0.6 }}>
                    <Stars n={wonStars} size="text-3xl" />
                  </motion.div>
                  <p className="font-heading font-extrabold text-lg text-teal-300 mt-1">Mission complete!</p>
                  <motion.p
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: [0.6, 1.25, 1], opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.5 }}
                    className="font-heading font-extrabold text-2xl text-amber-300"
                  >
                    +{pointsForStars(wonStars)} XP
                  </motion.p>
                  <p className="text-xs text-white/60 font-body mt-1">✅ {mission.success}</p>
                  {wonStars < 3 && (
                    <p className="text-[11px] text-white/45 font-body mt-1">Play it again without hints to earn all 10 XP!</p>
                  )}
                  <TidyUp activeId={mission.id} />
                  <div className="flex gap-2 mt-4">
                    {nextMission ? (
                      <button
                        onClick={() => startMission(nextMission.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-heading font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-[0_0_14px_rgba(245,158,11,0.5)]"
                      >
                        Next mission →
                      </button>
                    ) : (
                      <span className="flex-1 py-2 text-xs font-heading text-amber-200">🏁 That was the last mission!</span>
                    )}
                    <button
                      onClick={() => { useMissionStore.getState().quit(); useMissionStore.getState().openPanel() }}
                      className="px-3 py-2 rounded-xl text-xs font-heading font-bold text-white/70 bg-white/8 border border-white/10 hover:bg-white/12"
                    >
                      All missions
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-white/40 mt-3 mb-1.5">Your mission</p>
                  <ul className="flex flex-col gap-1.5">
                    {mission.steps.map((s, i) => (
                      <li key={i} className={`flex items-start gap-2 text-sm font-body ${ticked[i] ? 'text-teal-200' : 'text-white/80'}`}>
                        <motion.span
                          key={ticked[i] ? 'on' : 'off'}
                          initial={{ scale: ticked[i] ? 0.4 : 1 }}
                          animate={{ scale: 1 }}
                          className="flex-shrink-0 w-5 text-center"
                        >
                          {ticked[i] ? '✅' : '⬜'}
                        </motion.span>
                        <span className={ticked[i] ? 'line-through decoration-teal-400/50' : ''}>{s.text}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-white/50 font-body mt-3">
                    <span className="text-teal-300 font-semibold">✅ Success:</span> {mission.success}
                  </p>
                  <StartFresh activeId={mission.id} />


                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={showHint}
                      className="px-3 py-1.5 min-h-[32px] rounded-lg text-xs font-heading font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 hover:bg-cyan-500/30"
                    >
                      💡 Hint
                    </button>
                    <span className="flex items-center gap-1 text-[11px] font-heading text-white/45" title="Fewer hints = more stars">
                      <Stars n={starsFor(hintsUsed)} size="text-sm" />
                      <span className="text-amber-200/80 font-bold">{pointsForStars(starsFor(hintsUsed))} XP</span>
                      <span className="hidden sm:inline">to win</span>
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>,
    document.body
  )
}
