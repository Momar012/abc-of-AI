'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AbitaWordmark from '@/components/ui/AbitaWordmark'
import { useTourStore } from '@/store/useTourStore'
import { useMissionStore, totalPoints } from '@/store/useMissionStore'
import { MISSIONS, MISSION_TOTAL, missionNumber } from '@/lib/missions/missions'

/** Small ring that fills up as missions get done. */
function ProgressRing({ value, children }: { value: number; children: React.ReactNode }) {
  const r = 13
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex w-8 h-8 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
        <motion.circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke="#FBBF24"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - value) }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <span className="text-sm leading-none">{children}</span>
    </span>
  )
}

/**
 * Minimal header: one button that follows the kid's journey, plus a "?" menu.
 *   1. Tour not done    → nothing (the welcome card / tour lead the way)
 *   2. Missions to do   → 🎯 Mission 3 of 13 (ring = progress)
 *   3. All missions done → 🏆 130 XP (opens My Trophies)
 */
export default function TopNav() {
  const tourStatus = useTourStore((s) => s.status)
  const startTour = useTourStore((s) => s.start)
  const results = useMissionStore((s) => s.results)
  const activeId = useMissionStore((s) => s.activeId)
  const [mounted, setMounted] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  useEffect(() => setMounted(true), [])

  // Close the ? menu when clicking anywhere else.
  useEffect(() => {
    if (!helpOpen) return
    const close = (e: PointerEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelpOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [helpOpen])

  const store = useMissionStore.getState
  const tourDone = mounted && tourStatus !== 'active' && tourStatus !== 'unseen'
  const done = Object.keys(results).length
  const allDone = done >= MISSION_TOTAL
  const xp = totalPoints(results)
  // The mission being played, or the next one to do.
  const current = activeId ? missionNumber(activeId) : (MISSIONS.findIndex((m) => !results[m.id]) + 1 || MISSION_TOTAL)

  const menu = [
    { icon: '🎓', label: 'Replay the tour', onClick: () => { store().quit(); startTour() } },
    { icon: '🎯', label: 'Missions', onClick: () => store().openPanel() },
    { icon: '🏅', label: 'My trophies', onClick: () => store().setTrophyOpen(true) },
  ]

  return (
    <header className="flex items-center gap-3 px-4 sm:px-6 py-2.5 glass-panel rounded-none border-b border-white/10 sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl">🤖</span>
        <AbitaWordmark className="text-lg" />
        <span className="text-white/40 text-sm hidden lg:inline">AI Sandbox for Kids</span>
      </div>

      {tourDone && (
        <div className="ml-auto flex items-center gap-2">
          {allDone ? (
            <button
              onClick={() => store().setTrophyOpen(true)}
              title="My trophies"
              className="flex items-center gap-2 pl-2 pr-3.5 h-9 rounded-full text-sm font-heading font-bold text-amber-100 bg-amber-500/15 border border-amber-400/35 hover:bg-amber-500/25 transition-colors"
            >
              <span className="text-base leading-none">🏆</span>
              {xp} XP
            </button>
          ) : (
            <button
              onClick={() => store().openPanel()}
              title={`${done} of ${MISSION_TOTAL} missions done`}
              className="flex items-center gap-1.5 pl-1 pr-3.5 h-9 rounded-full text-sm font-heading font-bold text-amber-100 bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/20 transition-colors"
            >
              <ProgressRing value={done / MISSION_TOTAL}>🎯</ProgressRing>
              <span className="whitespace-nowrap">
                Mission {current}
                <span className="hidden sm:inline font-semibold text-amber-200/60"> of {MISSION_TOTAL}</span>
              </span>
            </button>
          )}

          <div ref={helpRef} className="relative">
            <button
              onClick={() => setHelpOpen((o) => !o)}
              title="Help"
              aria-label="Help"
              aria-expanded={helpOpen}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-heading font-extrabold text-white/70 bg-white/5 border border-white/12 hover:bg-white/10 hover:text-white transition-colors"
            >
              ?
            </button>
            <AnimatePresence>
              {helpOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-48 p-1 glass-panel rounded-xl shadow-xl z-50"
                  role="menu"
                >
                  {menu.map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={() => { setHelpOpen(false); item.onClick() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 min-h-[38px] rounded-lg text-left text-sm font-heading font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </header>
  )
}
