'use client'

const STEPS = [
  { icon: '📁', label: 'Collect Data' },
  { icon: '🏷️', label: 'Add Labels' },
  { icon: '✅', label: 'Validate' },
  { icon: '✂️', label: 'Split Data' },
  { icon: '🎉', label: 'Done!' },
]

interface StepIndicatorProps {
  currentStep: number
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      {STEPS.map((step, i) => {
        const done = i < currentStep
        const active = i === currentStep
        return (
          <div key={i} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-all
                ${active ? 'bg-violet-600/70 text-white shadow-lg shadow-violet-500/30' : ''}
                ${done ? 'bg-white/10 text-white/70' : ''}
                ${!active && !done ? 'text-white/40' : ''}
              `}
            >
              <span>{step.icon}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${done ? 'bg-white/40' : 'bg-white/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
