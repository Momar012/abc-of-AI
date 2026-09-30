'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import { DisplayBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

export default function DisplayNode({ data, selected }: NodeProps<{ block: DisplayBlock }>) {
  const { block } = data
  const removeDisplayBlock = useRuleStore((s) => s.removeDisplayBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const isOn = block.isOn

  return (
    <div className="flex flex-col" onClick={() => setSelectedBlock(block.id, 'display')}>
      <Handle
        type="target"
        position={Position.Left}
        id="display-in"
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
            onClick={() => { removeDisplayBlock(block.id); evaluateGraph() }}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <motion.div
          animate={isOn ? { boxShadow: ['0 0 6px rgba(52,211,153,0.4)', '0 0 16px rgba(52,211,153,0.85)', '0 0 6px rgba(52,211,153,0.4)'] } : { boxShadow: '0 0 0 rgba(0,0,0,0)' }}
          transition={isOn ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : {}}
          className="w-full min-h-[2.75rem] rounded-md bg-black/60 border border-white/10 flex items-center justify-center px-2 py-1.5"
        >
          <span
            className={`text-[11px] font-heading font-bold text-center leading-tight break-words ${
              isOn ? 'text-emerald-300' : 'text-white/20 italic'
            }`}
            style={isOn ? { textShadow: '0 0 8px rgba(52,211,153,0.8)' } : undefined}
          >
            {isOn ? block.message : '···'}
          </span>
        </motion.div>

        <p className={`text-xs font-heading font-bold ${isOn ? 'text-emerald-400' : 'text-white/40'}`}>
          {isOn ? '🪧 On!' : '⬛ Off'}
        </p>

        {!block.linkedRuleBlockId && (
          <p className="text-xs text-white/35 font-body text-center">Connect a rule</p>
        )}
      </div>
    </div>
  )
}
