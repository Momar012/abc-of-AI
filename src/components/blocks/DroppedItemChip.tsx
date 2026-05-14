'use client'

import { motion } from 'framer-motion'
import { useDatasetStore } from '@/store/useDatasetStore'

interface DroppedItemChipProps {
  itemId: string
  blockId: string
  labelId: string
  color: string
}

export default function DroppedItemChip({ itemId, blockId, labelId, color }: DroppedItemChipProps) {
  const bankItems = useDatasetStore((s) => s.bankItems)
  const removeItemFromLabel = useDatasetStore((s) => s.removeItemFromLabel)
  const removeItemFromUnlabelled = useDatasetStore((s) => s.removeItemFromUnlabelled)
  const item = bankItems.find((i) => i.id === itemId)

  if (!item) return null

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (labelId === 'unlabelled') {
      removeItemFromUnlabelled(blockId, itemId)
    } else {
      removeItemFromLabel(blockId, labelId, itemId)
    }
  }

  return (
    <motion.div
      layoutId={`chip-${itemId}-${blockId}-${labelId}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-body max-w-full group"
      style={{ background: `${color}22`, border: `1px solid ${color}55` }}
    >
      {item.type === 'image' && item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumbnailUrl} alt={item.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
      ) : (
        <span className="text-sm flex-shrink-0">📄</span>
      )}
      <span className="truncate text-white/80 min-w-0">{item.name}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleRemove}
        className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-opacity leading-none"
      >
        ×
      </button>
    </motion.div>
  )
}
