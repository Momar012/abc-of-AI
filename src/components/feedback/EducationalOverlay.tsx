'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '@/store/useUIStore'
import GlowButton from '@/components/ui/GlowButton'

export default function EducationalOverlay() {
  const { showEducationalOverlay, setShowEducationalOverlay, setFirstVisitSeen } = useUIStore()

  const dismiss = () => {
    setShowEducationalOverlay(false)
    setFirstVisitSeen()
  }

  return (
    <AnimatePresence>
      {showEducationalOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="glass-card max-w-md w-full p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="font-heading font-extrabold text-2xl text-white mb-3">
              Welcome to the abc of AI
            </h2>
            <p className="text-white/70 font-body leading-relaxed mb-2">
            🧒👧<span className="text-violet-400 font-semibold">AI Sandbox for Kids</span>
            </p>
            <p className="text-white/60 font-body text-sm leading-relaxed mb-6">
            In this playground, you’ll learn by building, experimenting, and teaching AI step by step, just like real AI creators do.
              
            </p>

            <div className="flex flex-col gap-2 mb-6 text-left">
              {[
                ['🧠', 'Discover how machines learn from data'],
                ['📸', 'Create and organise your own datasets'],
                ['🏷️', 'Teach AI using labels and examples'],
                ['🧪', 'Train models and test their predictions'],
                ['🚀', 'Explore the world of AI through play'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/70 font-body">
                  <span className="text-xl">{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <GlowButton size="lg" onClick={dismiss} className="w-full justify-center">
              🚀 Let&apos;s Build!
            </GlowButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
