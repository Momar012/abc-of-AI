'use client'

import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function SavedDatasetsList() {
  const savedDatasets = useDatasetStore((s) => s.savedDatasets)
  const loadSavedDataset = useDatasetStore((s) => s.loadSavedDataset)
  const deleteSavedDataset = useDatasetStore((s) => s.deleteSavedDataset)
  const addToast = useUIStore((s) => s.addToast)

  if (savedDatasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
        <span className="text-4xl">📋</span>
        <p className="text-white/50 text-sm font-heading font-semibold">Nothing saved yet</p>
        <p className="text-white/30 text-xs font-body leading-relaxed">
          Type a name and hit <span className="text-violet-400">💾 Save</span> in the toolbar to store a snapshot of your work.
        </p>
      </div>
    )
  }

  const handleLoad = (id: string, name: string) => {
    loadSavedDataset(id)
    addToast(`📂 Loaded "${name}"`, 'info')
  }

  const handleDelete = (id: string, name: string) => {
    deleteSavedDataset(id)
    addToast(`🗑 Deleted "${name}"`, 'warn')
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {savedDatasets.map((ds) => {
        const itemCount = ds.bankItems.length
        const labelCount = ds.labelledBlocks.reduce((acc, b) => acc + b.labels.length, 0)
        return (
          <div
            key={ds.id}
            className="glass-card-dark rounded-xl p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-heading font-bold text-white truncate">{ds.name}</p>
                <p className="text-xs text-white/40 font-body mt-0.5">
                  {timeAgo(ds.savedAt)} · {itemCount} item{itemCount !== 1 ? 's' : ''} · {labelCount} label{labelCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleLoad(ds.id, ds.name)}
                className="flex-1 text-xs font-heading font-semibold py-1.5 rounded-lg bg-violet-600/40 text-violet-200 hover:bg-violet-600/60 transition-colors"
              >
                ▶ Load
              </button>
              <button
                onClick={() => handleDelete(ds.id, ds.name)}
                className="px-3 text-xs font-heading font-semibold py-1.5 rounded-lg bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/15 transition-colors"
              >
                🗑
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
