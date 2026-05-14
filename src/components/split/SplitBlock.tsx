'use client'

import { useDatasetStore } from '@/store/useDatasetStore'
import SliderInput from '@/components/ui/SliderInput'
import SplitVisualizer from './SplitVisualizer'

export default function SplitBlock() {
  const splitConfig = useDatasetStore((s) => s.splitConfig)
  const updateSplit = useDatasetStore((s) => s.updateSplit)

  return (
    <div className="glass-card p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">✂️</span>
        <h3 className="font-heading font-bold text-white text-sm">Split Your Dataset</h3>
      </div>

      <p className="text-xs text-white/50 font-body -mt-2">
        Decide how much data to use for training, testing, and validating the AI.
      </p>

      <SplitVisualizer split={splitConfig} />

      <div className="flex flex-col gap-3">
        <SliderInput
          label="Training data"
          value={splitConfig.trainPercent}
          color="#7C3AED"
          onChange={(v) => updateSplit('trainPercent', v)}
        />
        <SliderInput
          label="Test data"
          value={splitConfig.testPercent}
          color="#06B6D4"
          onChange={(v) => updateSplit('testPercent', v)}
        />
        <SliderInput
          label="Validation data"
          value={splitConfig.validationPercent}
          color="#10B981"
          onChange={(v) => updateSplit('validationPercent', v)}
        />
      </div>

      <div className="rounded-xl p-3 bg-white/5 border border-white/10 text-xs text-white/50 font-body leading-relaxed">
        <p><span className="text-violet-400 font-semibold">🧠 Training</span> — the AI learns from this data</p>
        <p className="mt-1"><span className="text-cyan-400 font-semibold">📊 Testing</span> — we check how well it learned</p>
        <p className="mt-1"><span className="text-emerald-400 font-semibold">✅ Validation</span> — fine-tuning to make it better</p>
      </div>
    </div>
  )
}
