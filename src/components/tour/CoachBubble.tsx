'use client'

import { motion } from 'framer-motion'
import { forwardRef } from 'react'

interface Props {
  stepNumber: number
  totalSteps: number
  emoji: string
  title: string
  text: string
  success: boolean
  /** Explain-only card: show "Got it →" instead of "Show me". */
  info?: boolean
  onNext?: () => void
  style: React.CSSProperties
  onShowMe: () => void
  onSkipStep: () => void
  onExit: () => void
}

const CoachBubble = forwardRef<HTMLDivElement, Props>(function CoachBubble(
  { stepNumber, totalSteps, emoji, title, text, success, info, onNext, style, onShowMe, onSkipStep, onExit },
  ref
) {
  return (
    <motion.div
      ref={ref}
      key={stepNumber}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="fixed z-[10004] pointer-events-auto glass-card p-4 shadow-2xl border border-cyan-400/40"
      style={{ width: 'min(320px, calc(100vw - 32px))', ...style }}
      role="dialog"
      aria-live="polite"
    >
      {/* progress */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-300 transition-all duration-500"
            style={{ width: `${Math.round((stepNumber / totalSteps) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] font-heading text-white/40 whitespace-nowrap">
          Getting Started {stepNumber}/{totalSteps}
        </span>
      </div>

      {success ? (
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: [0.8, 1.1, 1] }} className="py-3 text-center">
          <div className="text-4xl mb-1">✅</div>
          <p className="font-heading font-extrabold text-lg text-teal-300">Great job!</p>
        </motion.div>
      ) : (
        <>
          <p className="font-heading font-extrabold text-white text-base mb-1">
            <span className="mr-1.5">{emoji}</span>
            {title}
          </p>
          <p className="font-body text-sm text-white/80 leading-relaxed whitespace-pre-line">{text}</p>

          <div className="flex items-center gap-2 mt-3">
            {info ? (
              <button
                onClick={onNext}
                className="px-4 py-1.5 min-h-[32px] rounded-lg text-xs font-heading font-bold text-white bg-gradient-to-r from-violet-500 to-teal-400 hover:shadow-[0_0_14px_rgba(45,212,191,0.5)]"
              >
                Got it →
              </button>
            ) : (
              <>
                <button
                  onClick={onShowMe}
                  className="px-3 py-1.5 min-h-[32px] rounded-lg text-xs font-heading font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 hover:bg-cyan-500/30"
                >
                  👀 Show me
                </button>
                <button
                  onClick={onSkipStep}
                  className="px-2 py-1.5 min-h-[32px] rounded-lg text-xs font-heading text-white/50 hover:text-white hover:bg-white/10"
                >
                  Skip step
                </button>
              </>
            )}
            <button
              onClick={onExit}
              className="ml-auto px-2 py-1.5 min-h-[32px] rounded-lg text-xs font-heading text-white/40 hover:text-white hover:bg-white/10"
            >
              Exit tour
            </button>
          </div>
        </>
      )}
    </motion.div>
  )
})

export default CoachBubble
