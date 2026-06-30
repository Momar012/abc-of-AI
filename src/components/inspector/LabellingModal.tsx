'use client'

import { useState, useCallback } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import EditableLabelPill from '@/components/ui/EditableLabelPill'

export default function LabellingModal() {
  const blockId = useUIStore((s) => s.labellingModalBlockId)
  const closeLabellingModal = useUIStore((s) => s.closeLabellingModal)
  const block = useDatasetStore((s) => s.labelledBlocks.find((b) => b.id === blockId))
  const bankItems = useDatasetStore((s) => s.bankItems)
  const assignItemLabel = useDatasetStore((s) => s.assignItemLabel)
  const removeItemFromBlock = useDatasetStore((s) => s.removeItemFromBlock)
  const bulkRemoveItemsFromBlock = useDatasetStore((s) => s.bulkRemoveItemsFromBlock)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Compute rows before any hooks that depend on them
  const allRows = block
    ? [
        ...block.itemIds.map((id) => ({ itemId: id, assignedLabelId: null as string | null })),
        ...block.labels.flatMap((label) =>
          label.itemIds.map((id) => ({ itemId: id, assignedLabelId: label.id as string | null }))
        ),
      ].sort((a, b) => {
        const aAt = bankItems.find((i) => i.id === a.itemId)?.addedAt ?? 0
        const bAt = bankItems.find((i) => i.id === b.itemId)?.addedAt ?? 0
        return bAt - aAt
      })
    : []

  const allItemIds = allRows.map((r) => r.itemId)
  const isAllSelected = allItemIds.length > 0 && allItemIds.every((id) => selected.has(id))

  // All hooks before any early return
  const toggleSelect = useCallback((itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected(isAllSelected ? new Set() : new Set(allItemIds))
  }, [isAllSelected, allItemIds])

  const handleDeleteSelected = useCallback(() => {
    if (!blockId || selected.size === 0) return
    bulkRemoveItemsFromBlock(blockId, [...selected])
    setSelected(new Set())
  }, [blockId, selected, bulkRemoveItemsFromBlock])

  const handleDeleteOne = useCallback(
    (itemId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!blockId) return
      removeItemFromBlock(blockId, itemId)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    },
    [blockId, removeItemFromBlock]
  )

  // Early return after all hooks
  if (!block) return null

  const getLabel = (labelId: string | null) =>
    labelId ? block.labels.find((l) => l.id === labelId) : null

  const labelledCount = allRows.filter((r) => r.assignedLabelId !== null).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={closeLabellingModal}
    >
      <div
        className="glass-card w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ border: '1px solid rgba(139,92,246,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏷️</span>
            <div>
              <p className="text-sm font-heading font-bold text-white">Label: {block.name}</p>
              <p className="text-xs text-white/40 font-body">
                {allRows.length} item{allRows.length !== 1 ? 's' : ''} · {labelledCount} labelled
              </p>
            </div>
          </div>
          <button
            onClick={closeLabellingModal}
            className="w-8 h-8 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        {/* Label legend */}
        {block.labels.length > 0 && (
          <div className="px-5 py-3 border-b border-white/8 flex-shrink-0 flex flex-wrap gap-2">
            {block.labels.map((label) => (
              <EditableLabelPill key={label.id} blockId={block.id} label={label} />
            ))}
          </div>
        )}

        {/* Selection toolbar — visible only when items are selected */}
        {selected.size > 0 && (
          <div
            className="px-5 py-2.5 flex-shrink-0 flex items-center justify-between"
            style={{ background: 'rgba(139,92,246,0.12)', borderBottom: '1px solid rgba(139,92,246,0.25)' }}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="accent-violet-500 cursor-pointer"
              />
              <span className="text-xs text-violet-300 font-body font-semibold">
                {selected.size} selected
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-white/40 hover:text-white/70 font-body transition-colors"
              >
                Deselect all
              </button>
            </div>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-body font-semibold transition-all"
            >
              🗑 Delete {selected.size} item{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Select-all row — visible when nothing selected */}
        {selected.size === 0 && allRows.length > 0 && (
          <div className="px-5 py-2 flex-shrink-0 flex items-center gap-2 border-b border-white/5">
            <input
              type="checkbox"
              checked={false}
              onChange={toggleSelectAll}
              className="accent-violet-500 cursor-pointer"
            />
            <span
              className="text-xs text-white/30 font-body cursor-pointer select-none"
              onClick={toggleSelectAll}
            >
              Select all
            </span>
          </div>
        )}

        {/* Empty state */}
        {allRows.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/40">
            <p className="text-sm font-body">No items in this block yet. Drag items from the Data Bank.</p>
          </div>
        )}

        {/* Grid */}
        {allRows.length > 0 && (
          <div className="overflow-y-auto flex-1 p-5">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {allRows.map(({ itemId, assignedLabelId }) => {
                const item = bankItems.find((i) => i.id === itemId)
                if (!item) return null
                const assignedLabel = getLabel(assignedLabelId)
                const isSelected = selected.has(itemId)

                return (
                  <div
                    key={itemId}
                    className="flex flex-col rounded-xl overflow-hidden border transition-all cursor-pointer relative group"
                    style={{
                      borderColor: isSelected
                        ? 'rgba(139,92,246,0.8)'
                        : assignedLabel
                        ? assignedLabel.color + '66'
                        : 'rgba(255,255,255,0.1)',
                      background: isSelected
                        ? 'rgba(139,92,246,0.15)'
                        : assignedLabel
                        ? assignedLabel.color + '11'
                        : 'rgba(255,255,255,0.04)',
                      boxShadow: isSelected ? '0 0 0 2px rgba(139,92,246,0.4)' : 'none',
                    }}
                    onClick={() => toggleSelect(itemId)}
                  >
                    {/* Select checkbox — top left */}
                    <div
                      className="absolute top-1.5 left-1.5 z-10"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(itemId) }}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-violet-500 border-violet-400'
                            : 'bg-black/40 border-white/30 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Delete button — top right, visible on hover */}
                    <button
                      className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded bg-black/50 border border-white/20 text-white/50 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs leading-none"
                      title="Delete this item"
                      onClick={(e) => handleDeleteOne(itemId, e)}
                    >
                      ×
                    </button>

                    {/* Thumbnail or text preview */}
                    {item.type === 'image' && item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full aspect-square object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full aspect-square bg-white/5 flex items-center justify-center p-2">
                        <p className="text-xs text-white/50 text-center line-clamp-4 font-body leading-relaxed">
                          {item.type === 'text' ? item.content?.slice(0, 80) : '📄'}
                        </p>
                      </div>
                    )}

                    {/* Label selector */}
                    <div className="px-2 py-2 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-white/50 font-body truncate" title={item.name}>
                        {item.name}
                      </p>
                      {block.labels.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {assignedLabel && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: assignedLabel.color }}
                            />
                          )}
                          <select
                            value={assignedLabelId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              assignItemLabel(block.id, itemId, val === '' ? null : val)
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex-1 text-xs font-body bg-white/10 border border-white/15 text-white rounded-lg px-2 py-1 outline-none focus:border-violet-400 cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="" style={{ background: '#1e1b4b', color: 'white' }}>no label</option>
                            {block.labels.map((label) => (
                              <option key={label.id} value={label.id} style={{ background: '#1e1b4b', color: 'white' }}>
                                {label.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className="text-xs text-white/35 font-body">Add labels first</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-white/30 font-body">
            Click a card to select · hover for delete (×)
          </p>
          <button
            onClick={closeLabellingModal}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-heading font-semibold transition-colors"
          >
            Done ✓
          </button>
        </div>
      </div>
    </div>
  )
}
