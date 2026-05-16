'use client'

import { useEffect } from 'react'
import { NodeProps, Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import { BulbBlock } from '@/types/workflow'
import { useWorkflowStore } from '@/store/useWorkflowStore'

export default function BulbNode({ data, selected }: NodeProps<{ block: BulbBlock }>) {
  const { block } = data
  const updateBulbBlock = useWorkflowStore((s) => s.updateBulbBlock)
  const removeBulbBlock = useWorkflowStore((s) => s.removeBulbBlock)
  const ifElseBlocks = useWorkflowStore((s) => s.ifElseBlocks)

  const linkedIfElse = ifElseBlocks.find((b) => b.id === block.linkedIfElseId)

  useEffect(() => {
    if (!linkedIfElse) return
    updateBulbBlock(block.id, { isOn: linkedIfElse.currentOutput === true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedIfElse?.currentOutput, block.id])

  const isOn = block.isOn

  return (
    <div className="flex flex-col">
      <Handle
        type="target"
        position={Position.Left}
        id="bulb-in"
        style={{ background: '#10B981', border: '2px solid #064E3B', width: 12, height: 12, left: -6, top: '50%' }}
      />

      <div className="drag-handle flex justify-center items-center py-1.5 px-4 rounded-t-xl cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-white/20" />
          ))}
        </div>
      </div>

      <div
        className="glass-card w-40 flex flex-col items-center gap-3 px-4 py-3"
        style={{
          boxShadow: selected ? '0 0 0 2px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.4)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeBulbBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <motion.div
          animate={isOn ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={isOn ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
          style={
            isOn
              ? { filter: 'drop-shadow(0 0 14px rgba(251,191,36,0.9))' }
              : { filter: 'grayscale(1)', opacity: 0.3 }
          }
          className="text-5xl select-none"
        >
          💡
        </motion.div>

        <p className={`text-xs font-heading font-bold ${isOn ? 'text-amber-400' : 'text-white/40'}`}>
          {isOn ? '💡 On!' : '⬛ Off'}
        </p>

        {!block.linkedIfElseId && (
          <p className="text-xs text-white/25 font-body text-center">Connect If/Else</p>
        )}
      </div>
    </div>
  )
}
