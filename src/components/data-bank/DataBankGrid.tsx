'use client'

import { AnimatePresence } from 'framer-motion'
import { DataItem } from '@/types/dataset'
import { useUIStore } from '@/store/useUIStore'
import DataItemCard from './DataItemCard'

interface DataBankGridProps {
  items: DataItem[]
}

export default function DataBankGrid({ items }: DataBankGridProps) {
  const selectedBankItemIds = useUIStore((s) => s.selectedBankItemIds)
  const clearBankSelection = useUIStore((s) => s.clearBankSelection)
  const count = selectedBankItemIds.length

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/30">
        <span className="text-4xl mb-3">📂</span>
        <p className="text-sm font-heading">No data yet</p>
        <p className="text-xs mt-1">Upload images or text above</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Selection banner */}
      {count > 0 && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs text-violet-300 font-body font-semibold">
            {count} selected · drag to block
          </span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={clearBankSelection}
            className="text-xs text-white/40 hover:text-white font-body transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 p-1">
        <AnimatePresence>
          {items.map((item) => (
            <DataItemCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
