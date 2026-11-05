'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMissionStore, totalPoints } from '@/store/useMissionStore'
import { useUIStore } from '@/store/useUIStore'
import { MILESTONES, MAX_POINTS, isReached, Milestone } from '@/lib/missions/milestones'
import { MISSION_TOTAL } from '@/lib/missions/missions'
import GlowButton from '@/components/ui/GlowButton'

const CONFETTI = ['🎉', '✨', '⭐', '🌟', '🎊', '💡', '🚀', '🏆']
const DELAY_MS = 1600 // let the mission's own "complete" card show first

/** Full-screen party when the kid reaches a points milestone (30, 60, 100, all missions, 130). */
export default function MilestoneCelebration() {
  const results = useMissionStore((s) => s.results)
  const celebrated = useMissionStore((s) => s.celebrated)
  const markCelebrated = useMissionStore((s) => s.markCelebrated)
  const [mounted, setMounted] = useState(false)
  const [showing, setShowing] = useState<Milestone | null>(null)
  useEffect(() => setMounted(true), [])

  const points = totalPoints(results)
  const done = Object.keys(results).length

  const pending = useMemo(
    () => MILESTONES.find((m) => isReached(m, points, done) && !celebrated.includes(m.id)) ?? null,
    [points, done, celebrated]
  )

  useEffect(() => {
    if (!mounted || !pending || showing) return
    const t = window.setTimeout(() => setShowing(pending), DELAY_MS)
    return () => window.clearTimeout(t)
  }, [mounted, pending, showing])

  // The grand finale also hands out the Mission Master badge (if the mission card hasn't yet).
  useEffect(() => {
    if (showing?.id !== 'all-missions') return
    const ui = useUIStore.getState()
    if (!ui.earnedBadges.includes('mission-master')) {
      ui.earnBadge('mission-master')
      ui.addToast('🎯 New badge: Mission Master!', 'success')
    }
  }, [showing])

  const pieces = useMemo(
    () =>
      showing
        ? Array.from({ length: showing.grand ? 48 : 28 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            e: CONFETTI[i % CONFETTI.length],
            d: Math.random() * 0.8,
            s: 0.8 + Math.random() * 0.9,
          }))
        : [],
    [showing]
  )

  const close = () => {
    if (showing) markCelebrated(showing.id)
    setShowing(null)
  }

  return (
    <AnimatePresence>
      {showing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10020] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-hidden"
          onClick={close}
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="pointer-events-none absolute top-0"
              style={{ left: `${p.x}%`, fontSize: `${1.4 * p.s}rem` }}
              initial={{ y: -60, rotate: 0, opacity: 1 }}
              animate={{ y: '110vh', rotate: 540, opacity: [1, 1, 0] }}
              transition={{ duration: 2.6 + p.s, delay: p.d, ease: 'easeIn' }}
            >
              {p.e}
            </motion.span>
          ))}

          <motion.div
            initial={{ scale: 0.6, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`relative glass-card w-full text-center p-6 sm:p-8 border ${
              showing.grand ? 'max-w-md border-amber-300/50 shadow-[0_0_60px_rgba(245,158,11,0.35)]' : 'max-w-sm border-cyan-300/40'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className={showing.grand ? 'text-7xl mb-3' : 'text-6xl mb-3'}
              animate={{ rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.2, delay: 0.2 }}
            >
              {showing.emoji}
            </motion.div>
            <h2 className={`font-heading font-extrabold text-white mb-2 ${showing.grand ? 'text-3xl' : 'text-2xl'}`}>{showing.title}</h2>
            <p className="text-white/75 font-body leading-relaxed mb-4">{showing.text}</p>
            <div className="flex items-center justify-center gap-3 mb-6 text-sm font-heading">
              <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 font-bold">⚡ {points} / {MAX_POINTS} XP</span>
              <span className="px-3 py-1 rounded-full bg-white/8 border border-white/10 text-white/70">
                {done}/{MISSION_TOTAL} missions
              </span>
            </div>
            <GlowButton size="lg" onClick={close} className="w-full">
              {done >= MISSION_TOTAL ? '🏆 Awesome!' : '🎯 Keep going!'}
            </GlowButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
