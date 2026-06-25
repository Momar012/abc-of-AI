'use client'

import { AnimatePresence } from 'framer-motion'
import { DataItem } from '@/types/dataset'
import { useUIStore } from '@/store/useUIStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import DataItemCard from './DataItemCard'

interface DataBankGridProps {
  items: DataItem[]
}

export default function DataBankGrid({ items }: DataBankGridProps) {
  const selectedBankItemIds = useUIStore((s) => s.selectedBankItemIds)
  const clearBankSelection = useUIStore((s) => s.clearBankSelection)
  const selectAllBankItems = useUIStore((s) => s.selectAllBankItems)
  const bulkRemoveBankItems = useDatasetStore((s) => s.bulkRemoveBankItems)

  const count = selectedBankItemIds.length
  const allSelected = items.length > 0 && selectedBankItemIds.length === items.length

  function handleSelectAll() {
    if (allSelected) {
      clearBankSelection()
    } else {
      selectAllBankItems(items.map((i) => i.id))
    }
  }

  function handleBulkDelete() {
    bulkRemoveBankItems(selectedBankItemIds)
    clearBankSelection()
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/40">
        <span className="text-4xl mb-3">📂</span>
        <p className="text-sm font-heading">No data yet</p>
        <p className="text-xs mt-1">Upload images or text above</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Header bar: item count + select-all toggle */}
      <div className="flex items-center justify-between px-1 py-0.5">
        <span className="text-xs text-white/40 font-body">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleSelectAll}
          className="text-xs text-white/40 hover:text-white font-body transition-colors"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {/* Selection action banner */}
      {count > 0 && (
        <div className="flex items-center justify-between px-2 py-1.5 mx-1 rounded-lg bg-white/5 border border-white/10">
          <span className="text-xs text-violet-300 font-body font-semibold">
            {count} selected · drag to block
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleBulkDelete}
              title={`Delete ${count} selected item${count !== 1 ? 's' : ''}`}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 hover:border-red-400/60 text-red-400 hover:text-red-300 transition-all"
            >
              <svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path d="M1 2.5h9M4 2.5V1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M2 2.5l.5 7.5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5L9 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.5 5v4M6.5 5v4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              <span className="text-xs font-heading font-bold">{count}</span>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={clearBankSelection}
              className="text-xs text-white/40 hover:text-white font-body transition-colors px-1"
            >
              ✕
            </button>
          </div>
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
