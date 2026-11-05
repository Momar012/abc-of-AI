'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AbitaWordmark from '@/components/ui/AbitaWordmark'
import { useTourStore } from '@/store/useTourStore'
import { useMissionStore, totalPoints } from '@/store/useMissionStore'
import { useUIStore } from '@/store/useUIStore'
import { MISSIONS, MISSION_TOTAL, missionNumber } from '@/lib/missions/missions'
import { MAX_POINTS, currentRank } from '@/lib/missions/milestones'

/** Tiny "+10 XP" that floats up when XP goes up. */
function useGain(value: number) {
  const prev = useRef(value)
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null)
  useEffect(() => {
    const diff = value - prev.current
    prev.current = value
    if (diff > 0) {
      setGain({ n: diff, key: Date.now() })
      const t = window.setTimeout(() => setGain(null), 1800)
      return () => window.clearTimeout(t)
    }
  }, [value])
  return gain
}

export default function TopNav() {
  const tourStatus = useTourStore((s) => s.status)
  const startTour = useTourStore((s) => s.start)
  const results = useMissionStore((s) => s.results)
  const activeId = useMissionStore((s) => s.activeId)
  const badgeCount = useUIStore((s) => s.earnedBadges.length)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const xp = totalPoints(results)
  const done = Object.keys(results).length
  const left = MISSION_TOTAL - done
  const rank = currentRank(xp, done)
  const active = activeId ? MISSIONS.find((m) => m.id === activeId) : null
  const gain = useGain(mounted ? xp : 0)

  const tourFree = mounted && tourStatus !== 'active' && tourStatus !== 'unseen'
  const missions = useMissionStore.getState

  return (
    <header className="flex items-center gap-3 px-4 sm:px-6 py-2.5 glass-panel rounded-none border-b border-white/10 sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl">🤖</span>
        <AbitaWordmark className="text-lg" />
        <span className="text-white/40 text-sm hidden lg:inline">AI Sandbox for Kids</span>
      </div>

      {tourFree && (
        <nav className="ml-auto flex items-center gap-2" aria-label="Progress">
          {/* Missions: what you're on now, or how many are left */}
          <button
            onClick={() => missions().openPanel()}
            title={active ? `Mission ${missionNumber(active.id)}: ${active.title}` : 'The Playground Challenge: 13 mini-missions'}
            className={`group flex items-center gap-2 pl-2.5 pr-3 h-9 rounded-xl text-xs font-heading font-bold border transition-all ${
              active
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-100'
                : left > 0
                ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/20 border-amber-400/40 text-amber-100 hover:shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="relative text-base leading-none">
              🎯
              {active && (
                <span className="absolute -top-1 -right-1.5 flex w-2.5 h-2.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-950" />
                </span>
              )}
            </span>
            {active ? (
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="whitespace-nowrap">Mission {missionNumber(active.id)}/{MISSION_TOTAL}</span>
                <span className="hidden xl:inline max-w-[160px] truncate font-semibold text-amber-200/70">· {active.title}</span>
              </span>
            ) : left > 0 ? (
              <span className="whitespace-nowrap">
                Missions<span className="hidden sm:inline font-semibold text-amber-200/70"> · {left} left</span>
              </span>
            ) : (
              <span className="whitespace-nowrap">Missions ✓</span>
            )}
          </button>

          {/* XP meter */}
          <button
            onClick={() => missions().setTrophyOpen(true)}
            title={`${xp} / ${MAX_POINTS} XP${rank ? ` · ${rank.title.replace('!', '')}` : ''}`}
            className="relative flex items-center gap-2 pl-2.5 pr-3 h-9 rounded-xl bg-white/5 border border-white/12 hover:bg-white/10 transition-colors"
          >
            <span className="text-base leading-none">{rank?.emoji ?? '⚡'}</span>
            <span className="flex flex-col items-stretch gap-1 w-[72px] sm:w-[92px]">
              <span className="flex items-baseline justify-between text-[11px] font-heading leading-none">
                <span className="font-extrabold text-amber-200">{xp} XP</span>
                <span className="text-white/35">/{MAX_POINTS}</span>
              </span>
              <span className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.span
                  className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  initial={false}
                  animate={{ width: `${Math.round((xp / MAX_POINTS) * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </span>
            </span>
            <AnimatePresence>
              {gain && (
                <motion.span
                  key={gain.key}
                  initial={{ opacity: 0, y: 4, scale: 0.8 }}
                  animate={{ opacity: 1, y: 26, scale: 1 }}
                  exit={{ opacity: 0, y: 34 }}
                  transition={{ duration: 0.5 }}
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full -mt-5 px-2 py-0.5 rounded-full text-[11px] font-heading font-extrabold text-amber-950 bg-amber-300 shadow-lg whitespace-nowrap"
                >
                  +{gain.n} XP
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Badges */}
          <button
            onClick={() => missions().setTrophyOpen(true)}
            title="My badges"
            className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl bg-white/5 border border-white/12 hover:bg-white/10 transition-colors text-xs font-heading font-bold text-violet-100"
          >
            <motion.span key={badgeCount} initial={{ scale: 1.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} className="text-base leading-none">
              🏅
            </motion.span>
            <span>{badgeCount}</span>
            <span className="hidden md:inline font-semibold text-white/40">badges</span>
          </button>

          <span className="w-px h-6 bg-white/10 mx-0.5" aria-hidden />

          {/* Help: replay the tour */}
          <button
            onClick={() => { missions().quit(); startTour() }}
            title="Replay the Getting Started tour"
            aria-label="Replay the Getting Started tour"
            className="flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-xs font-heading font-bold text-cyan-100 bg-cyan-500/10 border border-cyan-400/25 hover:bg-cyan-500/20 transition-colors"
          >
            <span className="text-base leading-none">🎓</span>
            <span className="hidden lg:inline">Tour</span>
          </button>
        </nav>
      )}
    </header>
  )
}
