'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import { LabelledDatasetBlock as LabelledBlock } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'
import LabelCreator from './LabelCreator'
import LabelTableRow from './LabelTableRow'

interface LabelledDatasetBlockProps {
  block: LabelledBlock
}

export default function LabelledDatasetBlock({ block }: LabelledDatasetBlockProps) {
  const removeLabelledBlock = useDatasetStore((s) => s.removeLabelledBlock)
  const renameLabelledBlock = useDatasetStore((s) => s.renameLabelledBlock)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(block.name)

  const { isOver, setNodeRef } = useDroppable({
    id: `block-table-${block.id}`,
    data: { blockId: block.id, blockDrop: true },
  })

  const commitRename = () => {
    const trimmed = nameValue.trim()
    if (trimmed) renameLabelledBlock(block.id, trimmed)
    else setNameValue(block.name)
    setEditingName(false)
  }

  // Collect all rows: unassigned first, then by label
  const allRows: { itemId: string; assignedLabelId: string | null }[] = [
    ...block.itemIds.map((id) => ({ itemId: id, assignedLabelId: null })),
    ...block.labels.flatMap((label) =>
      label.itemIds.map((id) => ({ itemId: id, assignedLabelId: label.id }))
    ),
  ]

  const totalItems = allRows.length

  return (
    <motion.div
      ref={setNodeRef}
      animate={{
        boxShadow: isOver ? '0 0 24px 6px rgba(124,58,237,0.4)' : 'none',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="glass-card flex flex-col gap-0 w-80"
      style={{ borderColor: isOver ? 'rgba(124,58,237,0.6)' : undefined }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-base flex-shrink-0">🗂️</span>
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-sm font-heading font-bold bg-transparent border-b border-white/40 outline-none text-white flex-1 min-w-0"
              maxLength={40}
            />
          ) : (
            <button
              onDoubleClick={() => setEditingName(true)}
              className="text-sm font-heading font-bold text-white truncate flex-1 text-left"
              title="Double-click to rename"
            >
              {block.name}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-white/40">{totalItems} items</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeLabelledBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>
      </div>

      {/* Table */}
      {totalItems === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 px-4 text-center"
          style={{ minHeight: 120 }}
        >
          {isOver ? (
            <p className="text-violet-300 font-heading font-semibold text-sm">✨ Drop here!</p>
          ) : (
            <>
              <p className="text-white/30 text-sm font-body">Drag items from Data Bank here</p>
              <p className="text-white/20 text-xs mt-1 font-body">Then assign labels in the table</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-56">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-white/10 bg-[rgba(18,12,45,0.95)]">
                <th className="text-left text-xs text-white/40 font-heading font-semibold px-3 py-2">Item</th>
                <th className="text-left text-xs text-white/40 font-heading font-semibold px-3 py-2">Label</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {allRows.map(({ itemId, assignedLabelId }) => (
                <LabelTableRow
                  key={itemId}
                  blockId={block.id}
                  itemId={itemId}
                  labels={block.labels}
                  assignedLabelId={assignedLabelId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drop hint when hovering with items already present */}
      {isOver && totalItems > 0 && (
        <div className="text-center py-2 text-violet-300 text-xs font-heading font-semibold border-t border-violet-500/20">
          ✨ Drop to add
        </div>
      )}

      {/* Label creator */}
      <div className="px-4 py-3 border-t border-white/8">
        <LabelCreator blockId={block.id} labels={block.labels} />
      </div>
    </motion.div>
  )
}
