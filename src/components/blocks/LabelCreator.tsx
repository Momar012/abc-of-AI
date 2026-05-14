'use client'

import { useState } from 'react'
import { useDatasetStore } from '@/store/useDatasetStore'
import { MAX_LABELS } from '@/lib/constants'
import { Label } from '@/types/dataset'

interface LabelCreatorProps {
  blockId: string
  labels: Label[]
}

export default function LabelCreator({ blockId, labels }: LabelCreatorProps) {
  const addLabel = useDatasetStore((s) => s.addLabel)
  const [name, setName] = useState('')

  const handleAdd = () => {
    if (labels.length >= MAX_LABELS) return
    addLabel(blockId, name)
    setName('')
  }

  return (
    <div className="flex gap-1.5 mt-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="Label name…"
        className="flex-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-white text-xs placeholder-white/30 outline-none focus:border-violet-400"
        maxLength={30}
      />
      <button
        onClick={handleAdd}
        disabled={labels.length >= MAX_LABELS}
        className="px-3 py-1 rounded-lg bg-violet-600/70 text-white text-xs font-heading font-semibold hover:bg-violet-500/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        + Add
      </button>
    </div>
  )
}
