'use client'

import { useState } from 'react'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import DataBankUploader from './DataBankUploader'
import DataBankGrid from './DataBankGrid'
import SavedDatasetsList from '@/components/saved-datasets/SavedDatasetsList'
import TrainedModelsList from '@/components/trained-models/TrainedModelsList'

type Tab = 'bank' | 'saved' | 'models'

export default function DataBank() {
  const bankItems = useDatasetStore((s) => s.bankItems)
  const savedDatasets = useDatasetStore((s) => s.savedDatasets)
  const trainedModels = useModelStore((s) => s.trainedModels)
  const [activeTab, setActiveTab] = useState<Tab>('bank')

  return (
    <aside className="w-full flex-shrink-0 flex flex-col gap-0 flex-1 min-h-0 overflow-hidden glass-panel">
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('bank')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 px-0.5 text-xs font-heading font-semibold transition-colors ${
            activeTab === 'bank'
              ? 'text-white border-b-2 border-violet-400 -mb-px'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <span className="truncate">📁 Data</span>
          <span className="flex-shrink-0 text-white/40">{bankItems.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 px-0.5 text-xs font-heading font-semibold transition-colors ${
            activeTab === 'saved'
              ? 'text-white border-b-2 border-violet-400 -mb-px'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <span className="truncate">📋 Datasets</span>
          {savedDatasets.length > 0 && (
            <span className="flex-shrink-0 bg-violet-500/60 text-white text-xs rounded-full px-1 py-0.5 font-semibold">
              {savedDatasets.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('models')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2.5 px-0.5 text-xs font-heading font-semibold transition-colors ${
            activeTab === 'models'
              ? 'text-white border-b-2 border-violet-400 -mb-px'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <span className="truncate">🤖 Models</span>
          {trainedModels.length > 0 && (
            <span className="flex-shrink-0 bg-emerald-500/60 text-white text-xs rounded-full px-1 py-0.5 font-semibold">
              {trainedModels.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'bank' ? (
          <div className="flex flex-col gap-3 p-3 h-full overflow-hidden">
            <DataBankUploader />
            <div className="flex-1 overflow-y-auto pr-1">
              <DataBankGrid items={bankItems} />
            </div>
          </div>
        ) : activeTab === 'saved' ? (
          <div className="p-3 overflow-y-auto flex-1">
            <SavedDatasetsList />
          </div>
        ) : (
          <div className="p-3 overflow-y-auto flex-1">
            <TrainedModelsList />
          </div>
        )}
      </div>
    </aside>
  )
}
