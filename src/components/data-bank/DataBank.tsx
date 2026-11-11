'use client'

import { useState } from 'react'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useUIStore } from '@/store/useUIStore'
import DataBankUploader from './DataBankUploader'
import DataBankGrid from './DataBankGrid'
import SavedDatasetsList from '@/components/saved-datasets/SavedDatasetsList'
import TrainedModelsList from '@/components/trained-models/TrainedModelsList'

type Tab = 'bank' | 'saved' | 'models'

/** Below this panel width, the tab names go under their icons instead of being cut off ("Data…"). */
const STACK_TABS_BELOW = 300

function TabButton({
  id, icon, label, count, badge, active, stacked, onClick,
}: {
  id: Tab
  icon: string
  label: string
  count: number
  /** Coloured count bubble (hidden at 0); without it the count is plain grey text. */
  badge?: string
  active: boolean
  stacked: boolean
  onClick: () => void
}) {
  const countEl = badge ? (
    count > 0 && <span className={`flex-shrink-0 ${badge} text-white text-[11px] leading-none rounded-full px-1.5 py-0.5 font-semibold`}>{count}</span>
  ) : (
    <span className="flex-shrink-0 text-white/40">{count}</span>
  )
  return (
    <button
      data-tour={`tab-${id}`}
      data-active={active}
      onClick={onClick}
      className={`flex-1 min-w-0 flex items-center justify-center font-heading font-semibold transition-colors ${
        stacked ? 'flex-col gap-0.5 py-1.5 px-0.5 text-[11px]' : 'gap-1 py-2.5 px-0.5 text-xs'
      } ${active ? 'text-white border-b-2 border-violet-400 -mb-px' : 'text-white/40 hover:text-white/70'}`}
    >
      {stacked ? (
        <>
          <span className="flex items-center gap-1 text-[13px] leading-none">{icon}{countEl}</span>
          <span className="leading-tight">{label}</span>
        </>
      ) : (
        <>
          <span className="truncate">{icon} {label}</span>
          {countEl}
        </>
      )}
    </button>
  )
}

export default function DataBank() {
  const bankItems = useDatasetStore((s) => s.bankItems)
  const savedDatasets = useDatasetStore((s) => s.savedDatasets)
  const trainedModels = useModelStore((s) => s.trainedModels)
  const stacked = useUIStore((s) => s.dataBankWidth) < STACK_TABS_BELOW
  const [activeTab, setActiveTab] = useState<Tab>('bank')

  return (
    <aside className="w-full flex flex-col flex-1 min-h-0 overflow-hidden glass-panel h-full">
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <TabButton id="bank" icon="📁" label="Data" count={bankItems.length} active={activeTab === 'bank'} stacked={stacked} onClick={() => setActiveTab('bank')} />
        <TabButton id="saved" icon="📋" label="Datasets" count={savedDatasets.length} badge="bg-violet-500/60" active={activeTab === 'saved'} stacked={stacked} onClick={() => setActiveTab('saved')} />
        <TabButton id="models" icon="🤖" label="Models" count={trainedModels.length} badge="bg-emerald-500/60" active={activeTab === 'models'} stacked={stacked} onClick={() => setActiveTab('models')} />
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
