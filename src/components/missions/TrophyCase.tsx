'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMissionStore, totalPoints } from '@/store/useMissionStore'
import { useUIStore } from '@/store/useUIStore'
import { BADGES } from '@/lib/badges'
import { MISSION_TOTAL } from '@/lib/missions/missions'
import { MAX_POINTS, currentRank, nextGoal } from '@/lib/missions/milestones'

/** "My Trophies": the kid's points, rank, and every badge (earned in colour, the rest locked with how to get them). */
export default function TrophyCase() {
  const open = useMissionStore((s) => s.trophyOpen)
  const setOpen = useMissionStore((s) => s.setTrophyOpen)
  const results = useMissionStore((s) => s.results)
  const earned = useUIStore((s) => s.earnedBadges)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const points = totalPoints(results)
  const done = Object.keys(results).length
  const rank = currentRank(points, done)
  const goal = nextGoal(points)
  const earnedCount = BADGES.filter((b) => earned.includes(b.id)).length

  return (
    <AnimatePresence>
      {mounted && open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="glass-card w-full max-w-xl max-h-full overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start">
              <h2 className="font-heading font-extrabold text-2xl text-white">🏅 My Trophies</h2>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Points */}
            <div className="mt-4 rounded-2xl p-4 bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-400/25">
              <div className="flex items-end gap-2">
                <span className="text-4xl">⚡</span>
                <span className="font-heading font-extrabold text-4xl text-amber-200 leading-none">{points}</span>
                <span className="font-heading text-white/50 mb-0.5">/ {MAX_POINTS} XP</span>
                <span className="ml-auto text-xs font-heading text-white/55 mb-1">
                  {done}/{MISSION_TOTAL} missions
                </span>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((points / MAX_POINTS) * 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                />
              </div>
              <p className="mt-2 text-xs font-heading text-white/60">
                {rank ? (
                  <>
                    Rank: <span className="text-amber-200 font-bold">{rank.emoji} {rank.title.replace('!', '')}</span>
                  </>
                ) : (
                  'Rank: 🌱 New Explorer'
                )}
                {goal && (
                  <>
                    {' · '}
                    {goal.points! - points} more XP to <span className="font-bold text-white/80">{goal.emoji} {goal.title.replace('!', '')}</span>
                  </>
                )}
              </p>
            </div>

            {/* Badges */}
            <div className="flex items-center mt-5 mb-2">
              <h3 className="font-heading font-bold text-white">Badges</h3>
              <span className="ml-2 text-xs font-heading text-white/45">
                {earnedCount}/{BADGES.length} earned
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BADGES.map((b, i) => {
                const has = earned.includes(b.id)
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className={`flex items-center gap-3 rounded-xl p-3 border ${has ? 'bg-white/8' : 'bg-white/[0.02] border-white/5'}`}
                    style={has ? { borderColor: `${b.color}66`, boxShadow: `0 0 18px ${b.color}22` } : undefined}
                  >
                    <div
                      className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center text-2xl ${has ? '' : 'grayscale opacity-30'}`}
                      style={has ? { background: `${b.color}33` } : { background: 'rgba(255,255,255,0.05)' }}
                    >
                      {b.icon}
                    </div>
                    <div className="min-w-0">
                      <p className={`font-heading font-bold text-sm ${has ? 'text-white' : 'text-white/40'}`}>
                        {b.name} {!has && '🔒'}
                      </p>
                      <p className={`text-[11px] font-body leading-snug ${has ? 'text-white/60' : 'text-white/30'}`}>{b.description}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <button
              onClick={() => { setOpen(false); useMissionStore.getState().openPanel() }}
              className="mt-5 w-full py-2.5 rounded-xl text-sm font-heading font-bold text-amber-200 bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/20"
            >
              🎯 Go to missions
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
