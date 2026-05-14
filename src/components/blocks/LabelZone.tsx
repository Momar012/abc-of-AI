'use client'

import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Label } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'
import DroppedItemChip from './DroppedItemChip'

interface LabelZoneProps {
  blockId: string
  label: Label
}

export default function LabelZone({ blockId, label }: LabelZoneProps) {
  const renameLabel = useDatasetStore((s) => s.renameLabel)
  const removeLabel = useDatasetStore((s) => s.removeLabel)
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(label.name)

  const { isOver, setNodeRef } = useDroppable({
    id: `label-${blockId}-${label.id}`,
    data: { blockId, labelId: label.id },
  })

  const commitRename = () => {
    const trimmed = nameValue.trim()
    if (trimmed) renameLabel(blockId, label.id, trimmed)
    else setNameValue(label.name)
    setEditing(false)
  }

  return (
    <motion.div
      ref={setNodeRef}
      animate={{
        boxShadow: isOver ? `0 0 20px 4px ${label.color}55` : 'none',
        scale: isOver ? 1.02 : 1,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="rounded-xl p-2 min-h-[80px] drop-zone"
      style={{
        borderColor: isOver ? label.color : `${label.color}55`,
        background: isOver ? `${label.color}12` : `${label.color}08`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: label.color }} />
          {editing ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename() }}
              className="text-xs font-heading font-semibold bg-transparent border-b border-white/40 outline-none text-white w-24"
              maxLength={30}
            />
          ) : (
            <button
              onDoubleClick={() => setEditing(true)}
              className="text-xs font-heading font-semibold text-white/90 hover:text-white truncate"
              title="Double-click to rename"
            >
              {label.name}
            </button>
          )}
          <span className="text-xs text-white/30">{label.itemIds.length}</span>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeLabel(blockId, label.id) }}
          className="text-white/20 hover:text-red-400 text-xs transition-colors leading-none"
        >
          ×
        </button>
      </div>

      {label.itemIds.length === 0 ? (
        <p className="text-xs text-white/25 text-center py-2 font-body">
          {isOver ? '✨ Drop here!' : 'Drag items here'}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <AnimatePresence>
            {label.itemIds.map((itemId) => (
              <DroppedItemChip
                key={itemId}
                itemId={itemId}
                blockId={blockId}
                labelId={label.id}
                color={label.color}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
