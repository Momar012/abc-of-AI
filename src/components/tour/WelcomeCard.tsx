'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTourStore } from '@/store/useTourStore'
import { useUIStore } from '@/store/useUIStore'
import GlowButton from '@/components/ui/GlowButton'
import AbitaWordmark from '@/components/ui/AbitaWordmark'

const SKILLS = ['🧱 Add blocks', '✋ Move them', '🔗 Connect them', '⚙️ Change settings', '🔍 Zoom & pan', '📚 Chapters & lessons']

/** First-visit card: start the hands-on Getting Started tour or skip it. */
export default function WelcomeCard() {
  const status = useTourStore((s) => s.status)
  const start = useTourStore((s) => s.start)
  const skipTour = useTourStore((s) => s.skipTour)
  const setFirstVisitSeen = useUIStore((s) => s.setFirstVisitSeen)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const show = mounted && status === 'unseen'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="glass-card max-w-md w-full max-h-full overflow-y-auto p-6 sm:p-8 text-center"
          >
            <motion.div
              className="text-5xl mb-3"
              animate={{ rotate: [0, -10, 10, -6, 0] }}
              transition={{ duration: 1.2, delay: 0.3 }}
            >
              🤖
            </motion.div>
            <h2 className="font-heading font-extrabold text-2xl text-white mb-2">
              Welcome to <AbitaWordmark className="text-2xl" />!
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-4">
              Let&apos;s get started! In this <span className="text-cyan-300 font-semibold">quick hands-on tour</span> you&apos;ll build
              a real light switch and learn everything you need in about 5 minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5 mb-6">
              {SKILLS.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full text-xs font-heading bg-white/8 border border-white/10 text-white/75">
                  {s}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <GlowButton
                size="lg"
                onClick={() => { setFirstVisitSeen(); start() }}
              >
                🚀 Let&apos;s get started
              </GlowButton>
              <button
                onClick={() => { setFirstVisitSeen(); skipTour() }}
                className="py-2 text-sm font-heading text-white/45 hover:text-white transition-colors"
              >
                I already know ABITA — skip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
