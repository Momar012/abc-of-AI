'use client'

import { useEffect } from 'react'
import { NodeProps, Handle, Position } from 'reactflow'
import { IfElseBlock } from '@/types/workflow'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useModelStore } from '@/store/useModelStore'

export default function IfElseNode({ data }: NodeProps<{ block: IfElseBlock }>) {
  const { block } = data
  const updateIfElseBlock = useWorkflowStore((s) => s.updateIfElseBlock)
  const removeIfElseBlock = useWorkflowStore((s) => s.removeIfElseBlock)
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const trainedModels = useModelStore((s) => s.trainedModels)

  const linkedModel = modelBlocks.find((m) => m.id === block.linkedModelId)
  const trainedModel = trainedModels.find((m) => m.id === linkedModel?.trainedModelId)
  const availableLabels = trainedModel?.labels ?? []

  // Evaluate condition whenever testResults or condition changes
  useEffect(() => {
    const testResults = linkedModel?.testResults
    if (!testResults?.length || !block.condition) {
      updateIfElseBlock(block.id, { currentOutput: null })
      return
    }
    const output = testResults[0].predictedLabel === block.condition
    updateIfElseBlock(block.id, { currentOutput: output })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedModel?.testResults, block.condition, block.id])

  const outputColor =
    block.currentOutput === null ? 'text-white/40' :
    block.currentOutput ? 'text-emerald-400' : 'text-red-400'
  const outputLabel =
    block.currentOutput === null ? 'Waiting…' :
    block.currentOutput ? 'True ✓' : 'False ✗'

  return (
    <div className="flex flex-col">
      <Handle
        type="target"
        position={Position.Left}
        id="ifelse-in"
        style={{ background: '#8B5CF6', border: '2px solid #4C1D95', width: 12, height: 12, left: -6, top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="ifelse-out"
        style={{ background: '#10B981', border: '2px solid #064E3B', width: 12, height: 12, right: -6, top: '50%' }}
      />

      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div className="glass-card w-52 flex flex-col gap-3 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🔀</span>
            <span className="text-sm font-heading font-bold text-white">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeIfElseBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-white/40 font-body">if prediction is:</p>
          {availableLabels.length > 0 ? (
            <select
              value={block.condition ?? ''}
              onChange={(e) =>
                updateIfElseBlock(block.id, { condition: e.target.value || null, currentOutput: null })
              }
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-body outline-none focus:border-violet-400 cursor-pointer"
            >
              <option value="">Pick a label…</option>
              {availableLabels.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-white/25 font-body italic">
              {block.linkedModelId ? 'Train the model first' : 'Connect a trained model'}
            </p>
          )}
        </div>

        <div className={`text-xs font-heading font-bold text-center py-1 rounded-lg bg-white/5 ${outputColor}`}>
          {outputLabel}
        </div>
      </div>
    </div>
  )
}
