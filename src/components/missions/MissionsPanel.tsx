'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMissionStore, totalPoints, pointsForStars, POINTS_PER_MISSION } from '@/store/useMissionStore'
import { MISSIONS, MISSION_TOTAL, isUnlocked, startMission } from '@/lib/missions/missions'
import { Stars } from './MissionCard'
import { currentRank, nextGoal as getNextGoal, MAX_POINTS } from '@/lib/missions/milestones'

/** The list of all mini-missions: stars earned, what's locked, and a way to start one. */
export default function MissionsPanel() {
  const open = useMissionStore((s) => s.panelOpen)
  const results = useMissionStore((s) => s.results)
  const closePanel = useMissionStore((s) => s.closePanel)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const points = totalPoints(results)
  const doneCount = Object.keys(results).length
  const rank = currentRank(points, doneCount)
  const nextGoal = getNextGoal(points)

  return (
    <AnimatePresence>
      {mounted && open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closePanel}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="glass-card w-full max-w-2xl max-h-full overflow-y-auto p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-1">
              <div>
                <h2 className="font-heading font-extrabold text-2xl text-white">🚀 The ABITA Challenge</h2>
                <p className="text-sm text-white/60 font-body">
                  {MISSION_TOTAL} missions. Earn up to {POINTS_PER_MISSION} XP per mission ({MAX_POINTS} XP in total): 10 XP with no hints, 7 with one hint, 5 with more. Finish all {MISSION_TOTAL} to earn the 🎯 Mission Master badge.
                </p>
              </div>
              <button
                onClick={closePanel}
                className="ml-auto w-8 h-8 flex-shrink-0 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3 my-4">
              <span className="font-heading font-extrabold text-amber-300 text-lg">⚡ {points} / {MAX_POINTS} XP</span>
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${Math.round((points / MAX_POINTS) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-heading text-white/50">{doneCount}/{MISSION_TOTAL} done</span>
            </div>
            <p className="-mt-2 mb-4 text-xs font-heading text-white/55">
              {rank ? <>Your rank: <span className="text-amber-200 font-bold">{rank.emoji} {rank.title.replace('!', '')}</span> · </> : null}
              {nextGoal ? <>Next celebration at <span className="text-amber-200 font-bold">⚡ {nextGoal.points} XP</span></> : <>You reached every celebration! 🎉</>}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {Array.from({ length: MISSION_TOTAL }).map((_, i) => {
                const m = MISSIONS[i]
                const result = m ? results[m.id] : undefined
                const unlocked = !!m && isUnlocked(i, results)
                return (
                  <button
                    key={m?.id ?? `soon-${i}`}
                    disabled={!unlocked}
                    onClick={() => m && startMission(m.id)}
                    className={`text-left rounded-xl p-3 border transition-all ${
                      unlocked
                        ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-amber-300/40 hover:-translate-y-0.5'
                        : 'bg-white/[0.02] border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-amber-300/80">Mission {i + 1}</span>
                      <span className="ml-auto text-sm">{!unlocked ? '🔒' : result ? '✅' : ''}</span>
                    </div>
                    <p className={`font-heading font-bold text-sm mt-1 ${unlocked ? 'text-white' : 'text-white/30'}`}>
                      {m ? (
                        <>
                          <span className="mr-1">{m.emoji}</span>
                          {m.title}
                        </>
                      ) : (
                        'Coming soon'
                      )}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Stars n={result?.stars ?? 0} size="text-sm" />
                      <span className={`text-xs font-heading font-bold ${result ? 'text-amber-200' : 'text-white/25'}`}>
                        {result ? pointsForStars(result.stars) : 0}/{POINTS_PER_MISSION} XP
                      </span>
                    </div>
                    {unlocked && (
                      <p className="text-[11px] font-heading text-white/40 mt-1">{result ? 'Play again →' : 'Start →'}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
