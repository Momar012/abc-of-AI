'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { ModelBlock } from '@/types/model'
import { useModelStore } from '@/store/useModelStore'
import { useUIStore } from '@/store/useUIStore'

const MODEL_TYPE_LABELS: Record<string, string> = {
  'image-supervised': 'Image Supervised',
  'image-classifier': 'Image Classifier',
  'image-unsupervised': 'Image Unsupervised',
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  idle: { color: 'text-white/40', label: 'Not trained' },
  loading: { color: 'text-teal-400', label: 'Loading…' },
  training: { color: 'text-amber-400', label: 'Training…' },
  trained: { color: 'text-emerald-400', label: 'Trained ✓' },
  error: { color: 'text-red-400', label: 'Error' },
}

export default function ModelBlockNode({ data, selected }: NodeProps<{ block: ModelBlock }>) {
  const removeModelBlock = useModelStore((s) => s.removeModelBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)
  const { block } = data

  const statusStyle = STATUS_STYLES[block.status] ?? STATUS_STYLES.idle
  const isActive = block.status === 'loading' || block.status === 'training'
  const isTesting = block.testStatus === 'running'

  return (
    <div className="flex flex-col">
      {/* Target handle — top-left, receives training data from Labelled block */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: '#2DD4BF', border: '2px solid #134E4A', width: 12, height: 12, left: -6, top: '38%' }}
      />
      {/* Target handle — bottom-left, receives test data from Unlabelled block */}
      <Handle
        type="target"
        position={Position.Left}
        id="test-in"
        style={{ background: '#F59E0B', border: '2px solid #78350F', width: 12, height: 12, left: -6, top: '65%' }}
      />
      {/* Source handle — right, emits prediction output to If/Else block */}
      <Handle
        type="source"
        position={Position.Right}
        id="prediction-out"
        style={{ background: '#10B981', border: '2px solid #064E3B', width: 10, height: 10, right: -5, top: '85%' }}
      />

      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div
        className="glass-card w-56 flex flex-col gap-2 px-4 py-3"
        onClick={() => setSelectedBlock(block.id, 'model')}
        style={{
          borderColor: block.status === 'trained' ? 'rgba(52,211,153,0.3)' : undefined,
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.4)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`text-base flex-shrink-0 ${isActive || isTesting ? 'animate-pulse' : ''}`}>🤖</span>
            <span className="text-sm font-heading font-bold text-white truncate">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeModelBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Model type + train status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {block.modelType ? (
            <span className="text-xs font-body px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              {MODEL_TYPE_LABELS[block.modelType] ?? block.modelType}
            </span>
          ) : (
            <span className="text-xs text-white/40 font-body">No model selected</span>
          )}
          <span className={`text-xs font-body ${statusStyle.color}`}>
            · {statusStyle.label}
          </span>
        </div>

        {/* Test status chip */}
        {block.testLinkedBlockId && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-body px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {block.testStatus === 'running'
                ? '⏳ Testing…'
                : block.testStatus === 'done'
                ? '✓ Test done'
                : '📦 Test linked'}
            </span>
          </div>
        )}

        {/* Hint */}
        <p className="text-xs text-white/35 font-body text-center mt-1">
          Click to inspect
        </p>
      </div>
    </div>
  )
}
