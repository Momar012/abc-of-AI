'use client'

import { Label } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'

interface LabelTableRowProps {
  blockId: string
  itemId: string
  labels: Label[]
  assignedLabelId: string | null
}

export default function LabelTableRow({ blockId, itemId, labels, assignedLabelId }: LabelTableRowProps) {
  const bankItems = useDatasetStore((s) => s.bankItems)
  const assignItemLabel = useDatasetStore((s) => s.assignItemLabel)
  const removeItemFromBlock = useDatasetStore((s) => s.removeItemFromBlock)

  const item = bankItems.find((i) => i.id === itemId)
  if (!item) return null

  const handleLabelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    assignItemLabel(blockId, itemId, val === '' ? null : val)
  }

  const assignedLabel = labels.find((l) => l.id === assignedLabelId)

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors group">
      {/* Preview + name */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-2 min-w-0">
          {item.type === 'image' && item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt={item.name}
              className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10"
              draggable={false}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-lg">
              📄
            </div>
          )}
          <span className="text-xs text-white/70 font-body truncate max-w-[100px]" title={item.name}>
            {item.name}
          </span>
        </div>
      </td>

      {/* Label dropdown */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5">
          {assignedLabel && (
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: assignedLabel.color }} />
          )}
          <select
            value={assignedLabelId ?? ''}
            onChange={handleLabelChange}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs font-body bg-white/10 border border-white/15 text-white rounded-lg px-2 py-1 outline-none focus:border-violet-400 cursor-pointer w-full"
            style={{ colorScheme: 'dark' }}
          >
            <option value="" style={{ background: '#1e1b4b', color: 'white' }}>unassigned</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id} style={{ background: '#1e1b4b', color: 'white' }}>
                {label.name}
              </option>
            ))}
          </select>
        </div>
      </td>

      {/* Remove */}
      <td className="py-2 px-2 text-right">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeItemFromBlock(blockId, itemId) }}
          className="w-5 h-5 rounded-full text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm leading-none"
        >
          ×
        </button>
      </td>
    </tr>
  )
}
