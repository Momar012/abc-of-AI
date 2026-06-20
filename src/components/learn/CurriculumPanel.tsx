'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CURRICULUM, CurriculumModule } from '@/data/curriculum'
import { useCurriculumStore } from '@/store/useCurriculumStore'
import { useUIStore } from '@/store/useUIStore'
import { LearnStepView, LabStepView, ChallengeStepView, TYPE_DOT, TYPE_COLOR, TYPE_LABEL } from './StepViews'

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <rect x="3" y="4" width="7" height="16" rx="2.5" fill="currentColor" fillOpacity="0.35" stroke="none" />
      <line x1="10" y1="4" x2="10" y2="20" />
    </svg>
  )
}

// ── Module selector ───────────────────────────────────────────────────────────

function ModuleSelector({
  modules,
  currentModuleId,
  onSelect,
}: {
  modules: CurriculumModule[]
  currentModuleId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      {modules.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
            m.id === currentModuleId
              ? 'bg-violet-500/20 border border-violet-500/30'
              : 'hover:bg-white/5'
          }`}
        >
          <span className="text-lg">{m.emoji}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-heading font-bold text-white/40 uppercase tracking-wider">
              {m.title}
            </p>
            <p className="text-xs font-heading font-bold text-white truncate">{m.subtitle}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function CurriculumPanel() {
  const { currentModuleId, currentStepIndex, goToStep, nextStep, prevStep, markStepComplete, setModule } =
    useCurriculumStore()
  const toggleCurriculumPanel = useUIStore((s) => s.toggleCurriculumPanel)
  const [showModules, setShowModules] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const module = CURRICULUM.find((m) => m.id === currentModuleId) ?? CURRICULUM[0]
  const totalSteps = module.steps.length
  const currentStep = module.steps[currentStepIndex] ?? module.steps[0]
  const currentModuleIndex = CURRICULUM.findIndex((m) => m.id === currentModuleId)
  const nextModule = CURRICULUM[currentModuleIndex + 1] ?? null
  const isLastStep = currentStepIndex === totalSteps - 1

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep.id])

  function handleNext() {
    markStepComplete(currentStep.id)
    nextStep(totalSteps)
  }

  function handleNextChapter() {
    markStepComplete(currentStep.id)
    setModule(nextModule!.id)
    goToStep(0)
  }

  function handlePrev() {
    prevStep()
  }

  function handleModuleSelect(id: string) {
    setModule(id)
    goToStep(0)
    setShowModules(false)
  }

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10">
        {/* Icon banner */}
        <div className="relative px-4 pt-4 pb-3 bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-teal-500/10 border-b border-white/8">
          <button
            onClick={toggleCurriculumPanel}
            title="Hide curriculum"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-white/35 hover:text-white hover:bg-white/10 transition-colors"
          >
            <SidebarIcon />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-teal-400 flex items-center justify-center text-xl flex-shrink-0 shadow-[0_0_16px_rgba(124,58,237,0.45)]">
              🧠
            </div>
            <div>
              <p className="text-[9px] font-heading font-bold text-violet-300/60 uppercase tracking-[0.15em]">Learning Path</p>
              <p className="text-sm font-heading font-extrabold text-white leading-tight">Curriculum</p>
            </div>
          </div>
        </div>

        {/* Module selector row */}
        <div className="px-4 pt-3 pb-3">
          <button
            onClick={() => setShowModules((s) => !s)}
            className="w-full flex items-center gap-2.5 group text-left"
          >
            <span className="text-2xl">{module.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-heading font-bold text-violet-300 uppercase tracking-wider">
                {module.title}
              </p>
              <p className="text-sm font-heading font-extrabold text-white truncate">
                {module.subtitle}
              </p>
            </div>
            <span className="text-white/30 group-hover:text-white/60 transition-colors text-xs">
              {showModules ? '▴' : '▾'}
            </span>
          </button>
        </div>

        {/* Module switcher dropdown */}
        <AnimatePresence>
          {showModules && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mt-3">
                <ModuleSelector modules={CURRICULUM} currentModuleId={currentModuleId} onSelect={handleModuleSelect} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar + step type */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[currentStep.type]}`} />
            <span className={`text-[10px] font-heading font-bold uppercase tracking-wider ${TYPE_COLOR[currentStep.type]}`}>
              {TYPE_LABEL[currentStep.type]}
            </span>
          </div>
          <span className="text-[10px] font-heading font-bold text-white/35">
            {currentStepIndex + 1} / {totalSteps}
          </span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-teal-400 transition-all duration-500"
            style={{ width: `${Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%` }}
          />
        </div>
      </div>

      {/* Step content — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {currentStep.type === 'learn' && <LearnStepView step={currentStep} />}
            {currentStep.type === 'lab' && <LabStepView step={currentStep} />}
            {currentStep.type === 'challenge' && <ChallengeStepView step={currentStep} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation footer */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 flex items-center gap-2">
        <button
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          className="flex-1 py-2 rounded-xl text-xs font-heading font-bold transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed
            bg-white/8 hover:bg-white/12 text-white/70 hover:text-white
            border border-white/10"
        >
          ← Prev
        </button>

        {isLastStep && nextModule ? (
          <button
            onClick={handleNextChapter}
            className="flex-1 py-2 rounded-xl text-xs font-heading font-bold transition-all
              bg-gradient-to-r from-teal-500 to-violet-500
              hover:shadow-[0_0_16px_rgba(124,58,237,0.5)]
              text-white flex flex-col items-center gap-0.5"
          >
            <span>Next Chapter →</span>
            <span className="text-[10px] opacity-70">{nextModule.emoji} {nextModule.title}</span>
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={isLastStep}
            className="flex-1 py-2 rounded-xl text-xs font-heading font-bold transition-all
              disabled:opacity-30 disabled:cursor-not-allowed
              bg-gradient-to-r from-violet-500 to-teal-400
              hover:shadow-[0_0_16px_rgba(124,58,237,0.5)]
              text-white"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
