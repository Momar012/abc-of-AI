'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { UnlabelledDatasetBlock as UnlabelledBlock } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

export default function UnlabelledDatasetNode({ data, selected }: NodeProps<{ block: UnlabelledBlock }>) {
  const removeUnlabelledBlock = useDatasetStore((s) => s.removeUnlabelledBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)
  const { block } = data

  const handleClick = () => {
    setSelectedBlock(block.id, 'unlabelled')
  }

  return (
    <div className="flex flex-col">
      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div
        className="glass-card w-48 flex flex-col gap-2 px-4 py-3"
        onClick={handleClick}
        style={{
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.4)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-base flex-shrink-0">📦</span>
            <span className="text-sm font-heading font-bold text-white truncate">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeUnlabelledBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="text-xs text-white/50 font-body">
          {block.itemIds.length} item{block.itemIds.length !== 1 ? 's' : ''}
        </div>

        {/* Hint */}
        <p className="text-xs text-white/35 font-body text-center mt-1">
          Click to inspect
        </p>
      </div>

      {/* Source handle — right side, connect to Model block as test set */}
      <Handle
        type="source"
        position={Position.Right}
        id="test-out"
        style={{ background: '#F59E0B', border: '2px solid #78350F', width: 12, height: 12, right: -6 }}
      />
    </div>
  )
}
