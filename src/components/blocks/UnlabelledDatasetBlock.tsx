'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { UnlabelledDatasetBlock as UnlabelledBlock } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'
import DroppedItemChip from './DroppedItemChip'

interface UnlabelledDatasetBlockProps {
  block: UnlabelledBlock
}

export default function UnlabelledDatasetBlock({ block }: UnlabelledDatasetBlockProps) {
  const removeUnlabelledBlock = useDatasetStore((s) => s.removeUnlabelledBlock)
  const renameUnlabelledBlock = useDatasetStore((s) => s.renameUnlabelledBlock)
  const removeItemFromUnlabelled = useDatasetStore((s) => s.removeItemFromUnlabelled)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(block.name)

  const { isOver, setNodeRef } = useDroppable({
    id: `unlabelled-${block.id}`,
    data: { blockId: block.id, unlabelled: true },
  })

  const commitRename = () => {
    const trimmed = nameValue.trim()
    if (trimmed) renameUnlabelledBlock(block.id, trimmed)
    else setNameValue(block.name)
    setEditingName(false)
  }

  return (
    <div className="glass-card p-4 w-64 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">📦</span>
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }}
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
        <button
          onClick={() => removeUnlabelledBlock(block.id)}
          className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
        >
          ×
        </button>
      </div>

      <motion.div
        ref={setNodeRef}
        animate={{
          boxShadow: isOver ? '0 0 20px 4px rgba(6,182,212,0.35)' : 'none',
          scale: isOver ? 1.02 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="drop-zone min-h-[80px] max-h-48 overflow-y-auto p-2 flex flex-col gap-1"
        style={{ borderColor: isOver ? '#06B6D4' : undefined }}
      >
        {block.itemIds.length === 0 ? (
          <p className="text-xs text-white/25 text-center py-4 font-body">
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
                color="#06B6D4"
              />
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      <p className="text-xs text-white/30 font-body text-center">
        {block.itemIds.length} item{block.itemIds.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
