'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LearnStep, LabStep, ChallengeStep } from '@/data/curriculum'
import SimpleContent from './SimpleContent'

export const TYPE_COLOR = {
  learn: 'text-violet-300',
  lab: 'text-teal-300',
  challenge: 'text-amber-300',
}

export const TYPE_DOT = {
  learn: 'bg-violet-500',
  lab: 'bg-teal-500',
  challenge: 'bg-amber-500',
}

export const TYPE_LABEL = {
  learn: 'LEARN',
  lab: 'LAB',
  challenge: 'CHALLENGE',
}

export function LearnStepView({ step }: { step: LearnStep }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xl">
          {step.icon}
        </div>
        <div>
          <p className="text-[10px] font-heading font-bold text-violet-300 uppercase tracking-wider mb-0.5">
            Learn
          </p>
          <h3 className="text-sm font-heading font-extrabold text-white leading-snug">
            {step.title}
          </h3>
        </div>
      </div>

      <SimpleContent body={step.body} />

      {step.tip && (
        <div className="glass-card p-3 border-l-2 border-amber-400/50 flex gap-2">
          <span className="text-base flex-shrink-0">💡</span>
          <p className="text-xs text-amber-200/80 font-body leading-relaxed">{step.tip}</p>
        </div>
      )}
    </div>
  )
}

export function LabStepView({ step }: { step: LabStep }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-xl">
          {step.icon}
        </div>
        <div>
          <p className="text-[10px] font-heading font-bold text-teal-300 uppercase tracking-wider mb-0.5">
            Guided Lab
          </p>
          <h3 className="text-sm font-heading font-extrabold text-white leading-snug">
            {step.title}
          </h3>
        </div>
      </div>

      <SimpleContent body={step.instruction} />

      {step.canvasHint && (
        <div className="glass-card p-2.5 flex gap-2 items-start">
          <span className="text-sm flex-shrink-0">🔍</span>
          <p className="text-xs text-teal-300/80 font-body leading-relaxed">{step.canvasHint}</p>
        </div>
      )}
    </div>
  )
}

export function ChallengeStepView({ step }: { step: ChallengeStep }) {
  const [hintOpen, setHintOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">
          {step.icon}
        </div>
        <div>
          <p className="text-[10px] font-heading font-bold text-amber-300 uppercase tracking-wider mb-0.5">
            Challenge
          </p>
          <h3 className="text-sm font-heading font-extrabold text-white leading-snug">
            {step.title}
          </h3>
        </div>
      </div>

      <div className="glass-card p-3 bg-gradient-to-r from-violet-500/10 to-amber-500/10 border border-amber-400/20">
        <SimpleContent body={step.prompt} />
      </div>

      {step.successHint && (
        <div>
          <button
            onClick={() => setHintOpen((o) => !o)}
            className="text-xs font-heading font-semibold text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <span>{hintOpen ? '▾' : '▸'}</span>
            <span>{hintOpen ? 'Hide hint' : 'Reveal hint'}</span>
          </button>
          <AnimatePresence>
            {hintOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="glass-card p-3 mt-2 border-l-2 border-emerald-400/50">
                  <p className="text-xs text-emerald-200/80 font-body leading-relaxed">
                    {step.successHint}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
