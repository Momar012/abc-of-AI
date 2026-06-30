'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import { useUIStore } from '@/store/useUIStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import LabelTableRow from '@/components/blocks/LabelTableRow'
import LabelCreator from '@/components/blocks/LabelCreator'
import DroppedItemChip from '@/components/blocks/DroppedItemChip'
import SpreadsheetPasteModal from '@/components/inspector/SpreadsheetPasteModal'
import UnlabelledPasteModal from '@/components/inspector/UnlabelledPasteModal'
import EditableLabelPill from '@/components/ui/EditableLabelPill'

function ExpandViewButton({ blockId }: { blockId: string }) {
  const openLabellingModal = useUIStore((s) => s.openLabellingModal)
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => openLabellingModal(blockId)}
      className="text-xs text-violet-300 hover:text-violet-200 font-body transition-colors whitespace-nowrap"
    >
      ↗ Expand View
    </button>
  )
}

function LabelledContent({ blockId }: { blockId: string }) {
  const block = useDatasetStore((s) => s.labelledBlocks.find((b) => b.id === blockId))
  const bankItems = useDatasetStore((s) => s.bankItems)
  const { isOver, setNodeRef } = useDroppable({
    id: `block-table-${blockId}`,
    data: { blockId, blockDrop: true },
  })
  const [showPasteModal, setShowPasteModal] = useState(false)

  if (!block) return null

  const allRows = [
    ...block.itemIds.map((id) => ({ itemId: id, assignedLabelId: null as string | null })),
    ...block.labels.flatMap((label) =>
      label.itemIds.map((id) => ({ itemId: id, assignedLabelId: label.id as string | null }))
    ),
  ].sort((a, b) => {
    const aAt = bankItems.find((i) => i.id === a.itemId)?.addedAt ?? 0
    const bAt = bankItems.find((i) => i.id === b.itemId)?.addedAt ?? 0
    return bAt - aAt
  })

  const totalItems = allRows.length

  return (
    <div className="flex flex-col gap-0">
      {/* Items header with expand button */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-xs text-white/40 font-heading font-semibold uppercase tracking-wider">Items</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasteModal(true)}
            className="text-xs text-violet-300 hover:text-violet-200 font-body transition-colors whitespace-nowrap"
            title="Import labelled text rows from a spreadsheet"
          >
            📋 Paste
          </button>
          <ExpandViewButton blockId={blockId} />
        </div>
      </div>

      {showPasteModal && (
        <SpreadsheetPasteModal blockId={blockId} onClose={() => setShowPasteModal(false)} />
      )}

      {/* Drop zone + table */}
      <motion.div
        ref={setNodeRef}
        animate={{ boxShadow: isOver ? '0 0 24px 6px rgba(124,58,237,0.4)' : 'none' }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{ borderColor: isOver ? 'rgba(124,58,237,0.6)' : undefined }}
        className="min-h-[80px]"
      >
        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            {isOver ? (
              <p className="text-violet-300 font-heading font-semibold text-sm">✨ Drop here!</p>
            ) : (
              <>
                <p className="text-white/40 text-sm font-body">Drag items from Data Bank here</p>
                <p className="text-white/30 text-xs mt-1 font-body">Then assign labels in the table</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col">
              {allRows.map(({ itemId, assignedLabelId }) => (
                <LabelTableRow
                  key={itemId}
                  blockId={block.id}
                  itemId={itemId}
                  labels={block.labels}
                  assignedLabelId={assignedLabelId}
                />
              ))}
            </div>
            {isOver && (
              <div className="text-center py-2 text-violet-300 text-xs font-heading font-semibold border-t border-violet-500/20">
                ✨ Drop to add
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Label creator */}
      <div className="px-4 py-3 border-t border-white/8">
        <p className="text-xs text-white/40 mb-1.5 font-heading font-semibold">Labels</p>
        <LabelCreator blockId={block.id} labels={block.labels} />
        {block.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {block.labels.map((label) => (
              <EditableLabelPill key={label.id} blockId={block.id} label={label} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UnlabelledContent({ blockId }: { blockId: string }) {
  const block = useDatasetStore((s) => s.unlabelledBlocks.find((b) => b.id === blockId))
  const { isOver, setNodeRef } = useDroppable({
    id: `unlabelled-${blockId}`,
    data: { blockId, unlabelled: true },
  })
  const [showPasteModal, setShowPasteModal] = useState(false)

  if (!block) return null

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-xs text-white/40 font-heading font-semibold uppercase tracking-wider">Items</p>
        <button
          onClick={() => setShowPasteModal(true)}
          className="text-xs font-body transition-colors whitespace-nowrap"
          style={{ color: '#2DD4BF' }}
          title="Paste text items from a spreadsheet or clipboard"
        >
          📋 Paste
        </button>
      </div>

      {showPasteModal && (
        <UnlabelledPasteModal blockId={blockId} onClose={() => setShowPasteModal(false)} />
      )}

      <motion.div
        ref={setNodeRef}
        animate={{
          boxShadow: isOver ? '0 0 20px 4px rgba(45,212,191,0.35)' : 'none',
          scale: isOver ? 1.01 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="drop-zone min-h-[120px] mx-4 my-2 p-3 flex flex-col gap-1 rounded-xl"
        style={{ borderColor: isOver ? '#2DD4BF' : undefined }}
      >
        {block.itemIds.length === 0 ? (
          <p className="text-xs text-white/35 text-center py-6 font-body">
            {isOver ? '✨ Drop here!' : 'Drag items here (no labels)'}
          </p>
        ) : (
          <AnimatePresence>
            {block.itemIds.map((itemId) => (
              <DroppedItemChip
                key={itemId}
                itemId={itemId}
                blockId={block.id}
                labelId="unlabelled"
                color="#2DD4BF"
              />
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  )
}

export default function BlockInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const selectedBlockType = useUIStore((s) => s.selectedBlockType)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const addToast = useUIStore((s) => s.addToast)

  const renameLabelledBlock = useDatasetStore((s) => s.renameLabelledBlock)
  const renameUnlabelledBlock = useDatasetStore((s) => s.renameUnlabelledBlock)
  const saveCurrentDataset = useDatasetStore((s) => s.saveCurrentDataset)
  const savedDatasets = useDatasetStore((s) => s.savedDatasets)

  const labelledBlock = useDatasetStore((s) =>
    selectedBlockType === 'labelled' ? s.labelledBlocks.find((b) => b.id === selectedBlockId) : undefined
  )
  const unlabelledBlock = useDatasetStore((s) =>
    selectedBlockType === 'unlabelled' ? s.unlabelledBlocks.find((b) => b.id === selectedBlockId) : undefined
  )
  const block = labelledBlock ?? unlabelledBlock

  const [saveName, setSaveName] = useState(block?.name ?? '')

  // Sync name when switching blocks
  useEffect(() => {
    if (block) setSaveName(block.name)
  }, [selectedBlockId, block?.name])

  if (!selectedBlockId || !selectedBlockType || !block) return null

  const handleSave = () => {
    const name = saveName.trim() || block.name
    const isOverwrite = savedDatasets.some((d) => d.name === name)
    if (selectedBlockType === 'labelled') renameLabelledBlock(selectedBlockId, name)
    else renameUnlabelledBlock(selectedBlockId, name)
    saveCurrentDataset(selectedBlockId, selectedBlockType as 'labelled' | 'unlabelled')
    addToast(isOverwrite ? `🔄 "${name}" updated!` : `💾 "${name}" saved!`, 'success')
  }

  const icon = selectedBlockType === 'labelled' ? '🗂️' : '📦'
  const typeLabel = selectedBlockType === 'labelled' ? 'Labelled Block' : 'Unlabelled Block'

  return (
    <div className="glass-panel flex flex-col gap-0 overflow-hidden flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-sm font-heading font-bold text-white">{block.name}</p>
            <p className="text-xs text-white/40 font-body">{typeLabel}</p>
          </div>
        </div>
        <button
          onClick={clearSelectedBlock}
          className="w-7 h-7 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 text-sm flex items-center justify-center transition-all"
          title="Close inspector"
        >
          ×
        </button>
      </div>

      {/* Block content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedBlockType === 'labelled' && <LabelledContent blockId={selectedBlockId} />}
        {selectedBlockType === 'unlabelled' && <UnlabelledContent blockId={selectedBlockId} />}
      </div>

      {/* Footer — Save section */}
      <div className="px-4 py-4 border-t border-white/8 flex flex-col gap-2 flex-shrink-0">
        <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider">Save Dataset</p>
        <input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Dataset name…"
          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm placeholder-white/40 outline-none focus:border-violet-400 font-body"
          maxLength={60}
        />
        <button
          onClick={handleSave}
          className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-heading font-semibold transition-colors"
        >
          💾 Save Data
        </button>
      </div>
    </div>
  )
}
