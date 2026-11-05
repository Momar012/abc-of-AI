'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTourStore } from '@/store/useTourStore'
import { useUIStore } from '@/store/useUIStore'
import GlowButton from '@/components/ui/GlowButton'
import { MISSIONS, MISSION_TOTAL, startMission } from '@/lib/missions/missions'
import { MAX_POINTS } from '@/lib/missions/milestones'

const CONFETTI = ['🎉', '✨', '⭐', '💡', '🎊', '🌟', '🧠', '🚀']

/** Celebration after the last Getting Started step: badge + hand-off to the lessons. */
export default function FinishCard() {
  const justFinished = useTourStore((s) => s.justFinished)
  const dismissFinish = useTourStore((s) => s.dismissFinish)
  const [pieces, setPieces] = useState<{ id: number; x: number; e: string; d: number }[]>([])

  useEffect(() => {
    if (!justFinished) return
    const ui = useUIStore.getState()
    if (!ui.earnedBadges.includes('explorer')) {
      ui.earnBadge('explorer')
      ui.addToast('🧭 New badge: ABITA Explorer!', 'success')
    }
    setPieces(
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        e: CONFETTI[i % CONFETTI.length],
        d: Math.random() * 0.6,
      }))
    )
  }, [justFinished])

  const close = () => {
    dismissFinish()
    const ui = useUIStore.getState()
    if (ui.curriculumCollapsed) ui.toggleCurriculumPanel()
  }

  return (
    <AnimatePresence>
      {justFinished && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm overflow-hidden"
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="pointer-events-none absolute top-0 text-2xl"
              style={{ left: `${p.x}%` }}
              initial={{ y: -40, rotate: 0, opacity: 1 }}
              animate={{ y: '105vh', rotate: 360, opacity: [1, 1, 0] }}
              transition={{ duration: 2.4, delay: p.d, ease: 'easeIn' }}
            >
              {p.e}
            </motion.span>
          ))}
          <motion.div
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative glass-card max-w-sm w-full p-6 sm:p-8 text-center"
          >
            <div className="text-6xl mb-3">🧭</div>
            <h2 className="font-heading font-extrabold text-2xl text-white mb-1">You&apos;re ready to build!</h2>
            <p className="text-cyan-300 font-heading font-bold mb-3">You earned the ABITA Explorer badge</p>
            <p className="text-white/70 font-body text-sm leading-relaxed mb-5">
              You can add, move and wire up blocks, change their settings, zoom and pan the canvas,
              and find your way through chapters and cards.
            </p>

            {/* Next step: the Playground Challenge (recommended), or straight to lessons */}
            {MISSIONS[0] && (
              <div className="rounded-2xl p-4 mb-3 text-left bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-400/30">
                <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-amber-300">Up next · recommended</p>
                <p className="font-heading font-extrabold text-white text-lg mt-0.5">🚀 The Playground Challenge</p>
                <p className="text-xs text-white/65 font-body mt-1 leading-relaxed">
                  Get comfortable with the ABITA playground: complete {MISSION_TOTAL} mini-missions on your own and earn up to{' '}
                  <span className="text-amber-200 font-bold">{MAX_POINTS} XP</span> plus the 🎯 Mission Master badge.
                </p>
                <GlowButton
                  size="lg"
                  onClick={() => { dismissFinish(); startMission(MISSIONS[0].id) }}
                  className="w-full mt-3"
                >
                  🎯 Start Mission 1
                </GlowButton>
              </div>
            )}
            <button
              onClick={close}
              className="w-full py-2.5 rounded-xl text-sm font-heading font-bold text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              🧠 Skip for now, go to my lessons
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
