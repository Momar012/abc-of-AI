'use client'

import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { DataItem } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

interface DataItemCardProps {
  item: DataItem
  isOverlay?: boolean
}

export default function DataItemCard({ item, isOverlay = false }: DataItemCardProps) {
  const removeBankItem = useDatasetStore((s) => s.removeBankItem)
  const selectedBankItemIds = useUIStore((s) => s.selectedBankItemIds)
  const toggleBankItemSelection = useUIStore((s) => s.toggleBankItemSelection)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  })

  const isSelected = selectedBankItemIds.includes(item.id)

  const handleClick = (e: React.MouseEvent) => {
    if (isOverlay) return
    e.stopPropagation()
    toggleBankItemSelection(item.id)
  }

  return (
    <motion.div
      ref={isOverlay ? undefined : setNodeRef}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging && !isOverlay ? 0.3 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={handleClick}
      className={`relative group rounded-xl overflow-hidden border bg-white/5 cursor-pointer
        ${isOverlay ? 'shadow-2xl shadow-violet-500/30 rotate-2 scale-105 border-white/10' : ''}
        ${!isOverlay && isSelected ? 'border-violet-400 ring-2 ring-violet-400/60' : !isOverlay ? 'border-white/10' : ''}
      `}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
    >
      {item.type === 'image' && item.thumbnailUrl ? (
        <div className="w-full aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      ) : (
        <div className="w-full aspect-square flex items-center justify-center p-2 bg-white/5">
          <p className="text-xs text-white/60 text-center line-clamp-4 font-body">
            {item.type === 'text' ? item.content.slice(0, 80) : '📄'}
          </p>
        </div>
      )}

      <div className="px-2 py-1.5">
        <p className="text-xs text-white/70 font-body truncate">{item.name}</p>
      </div>

      {/* Selection checkmark */}
      {!isOverlay && isSelected && (
        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
          <span className="text-white text-xs font-bold leading-none">✓</span>
        </div>
      )}

      {/* Delete button */}
      {!isOverlay && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeBankItem(item.id) }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white/60 text-xs
            flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
        >
          ×
        </button>
      )}
    </motion.div>
  )
}
