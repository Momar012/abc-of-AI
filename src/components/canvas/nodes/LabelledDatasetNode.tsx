'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { LabelledDatasetBlock as LabelledBlock } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

export default function LabelledDatasetNode({ data }: NodeProps<{ block: LabelledBlock }>) {
  const removeLabelledBlock = useDatasetStore((s) => s.removeLabelledBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)
  const { block } = data

  const handleDoubleClick = () => {
    setSelectedBlock(block.id, 'labelled')
  }

  const totalItems =
    block.itemIds.length + block.labels.reduce((sum, l) => sum + l.itemIds.length, 0)
  const labelledCount = block.labels.reduce((sum, l) => sum + l.itemIds.length, 0)

  return (
    <div className="flex flex-col">
      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div className="glass-card w-56 flex flex-col gap-2 px-4 py-3" onDoubleClick={handleDoubleClick}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-base flex-shrink-0">🗂️</span>
            <span className="text-sm font-heading font-bold text-white truncate">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeLabelledBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-white/50 font-body">
          <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
          {block.labels.length > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span>{labelledCount} labelled</span>
            </>
          )}
        </div>

        {/* Label chips */}
        {block.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {block.labels.slice(0, 4).map((label) => (
              <span
                key={label.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body"
                style={{ background: `${label.color}22`, border: `1px solid ${label.color}55`, color: label.color }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: label.color }}
                />
                {label.name}
              </span>
            ))}
            {block.labels.length > 4 && (
              <span className="text-xs text-white/30 font-body">+{block.labels.length - 4} more</span>
            )}
          </div>
        )}

        {/* Hint */}
        <p className="text-xs text-white/25 font-body text-center mt-1">
          Double-click to inspect
        </p>
      </div>

      {/* Violet handle — training data → model's cyan handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ background: '#8B5CF6', border: '2px solid #4C1D95', width: 12, height: 12, right: -6, top: '35%' }}
      />
      {/* Amber handle — test data with ground truth → model's amber handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="test-out"
        style={{ background: '#F59E0B', border: '2px solid #78350F', width: 12, height: 12, right: -6, top: '72%' }}
      />
    </div>
  )
}
