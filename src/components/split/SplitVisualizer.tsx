'use client'

import { motion } from 'framer-motion'
import { SplitConfig } from '@/types/dataset'

const SEGMENTS = [
  { key: 'trainPercent' as const, label: 'Train', color: '#7C3AED', emoji: '🧠' },
  { key: 'testPercent' as const, label: 'Test', color: '#2DD4BF', emoji: '📊' },
  { key: 'validationPercent' as const, label: 'Validate', color: '#10B981', emoji: '✅' },
]

interface SplitVisualizerProps {
  split: SplitConfig
}

export default function SplitVisualizer({ split }: SplitVisualizerProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Bar */}
      <div className="flex h-6 rounded-xl overflow-hidden gap-0.5">
        {SEGMENTS.map((seg) => (
          <motion.div
            key={seg.key}
            animate={{ flex: split[seg.key] }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full flex items-center justify-center text-xs font-heading font-bold text-white/90 overflow-hidden"
            style={{ background: seg.color, minWidth: 0 }}
          >
            {split[seg.key] > 10 ? `${split[seg.key]}%` : ''}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-between">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: seg.color }} />
            <span className="text-xs text-white/60 font-body">{seg.emoji} {seg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
