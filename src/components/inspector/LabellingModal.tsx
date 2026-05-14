'use client'

import { useUIStore } from '@/store/useUIStore'
import { useDatasetStore } from '@/store/useDatasetStore'

export default function LabellingModal() {
  const blockId = useUIStore((s) => s.labellingModalBlockId)
  const closeLabellingModal = useUIStore((s) => s.closeLabellingModal)
  const block = useDatasetStore((s) => s.labelledBlocks.find((b) => b.id === blockId))
  const bankItems = useDatasetStore((s) => s.bankItems)
  const assignItemLabel = useDatasetStore((s) => s.assignItemLabel)

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

  const getLabel = (labelId: string | null) =>
    labelId ? block.labels.find((l) => l.id === labelId) : null

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
              <p className="text-xs text-white/40 font-body">{allRows.length} items</p>
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
              <span
                key={label.id}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-body font-semibold"
                style={{
                  background: `${label.color}22`,
                  border: `1px solid ${label.color}55`,
                  color: label.color,
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: label.color }} />
                {label.name}
                <span className="text-white/40 ml-0.5">({label.itemIds.length})</span>
              </span>
            ))}
            <span className="text-xs text-white/30 font-body self-center ml-1">
              {allRows.filter((r) => r.assignedLabelId !== null).length}/{allRows.length} labelled
            </span>
          </div>
        )}

        {/* Empty state */}
        {allRows.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-white/30">
            <p className="text-sm font-body">No items in this block yet. Drag items from the Data Bank.</p>
          </div>
        )}

        {/* Image grid */}
        {allRows.length > 0 && (
          <div className="overflow-y-auto flex-1 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {allRows.map(({ itemId, assignedLabelId }) => {
                const item = bankItems.find((i) => i.id === itemId)
                if (!item) return null
                const assignedLabel = getLabel(assignedLabelId)

                return (
                  <div
                    key={itemId}
                    className="flex flex-col rounded-xl overflow-hidden border transition-all"
                    style={{
                      borderColor: assignedLabel
                        ? assignedLabel.color + '66'
                        : 'rgba(255,255,255,0.1)',
                      background: assignedLabel
                        ? assignedLabel.color + '11'
                        : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Thumbnail */}
                    {item.type === 'image' && item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full aspect-square object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                        <p className="text-xs text-white/50 text-center px-2 line-clamp-4 font-body">
                          {item.type === 'text' ? item.content.slice(0, 60) : '📄'}
                        </p>
                      </div>
                    )}

                    {/* Label selector */}
                    <div className="px-2 py-2 flex flex-col gap-1.5">
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
                        <p className="text-xs text-white/25 font-body">Add labels first</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex-shrink-0 flex justify-end">
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
