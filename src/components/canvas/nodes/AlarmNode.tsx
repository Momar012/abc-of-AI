'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import { AlarmBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

export default function AlarmNode({ data, selected }: NodeProps<{ block: AlarmBlock }>) {
  const { block } = data
  const removeAlarmBlock = useRuleStore((s) => s.removeAlarmBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'alarm')}>
      <Handle
        type="target"
        position={Position.Left}
        id="alarm-in"
        style={{ background: '#84CC16', border: '2px solid #365314', width: 12, height: 12, left: -6, top: '50%' }}
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
          boxShadow: selected
            ? '0 0 0 2px rgba(239,68,68,0.9), 0 0 20px rgba(239,68,68,0.3)'
            : block.isOn ? '0 0 0 2px rgba(239,68,68,0.5), 0 0 30px rgba(239,68,68,0.3)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeAlarmBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <motion.div
          animate={block.isOn ? { scale: [1, 1.1, 1], opacity: [1, 0.7, 1] } : { scale: 1, opacity: 0.3 }}
          transition={block.isOn ? { repeat: Infinity, duration: 0.5, ease: 'easeInOut' } : {}}
          style={block.isOn ? { filter: 'drop-shadow(0 0 12px rgba(239,68,68,0.9))' } : {}}
          className="text-5xl select-none"
        >
          🚨
        </motion.div>

        <p className={`text-xs font-heading font-bold ${block.isOn ? 'text-red-400' : 'text-white/40'}`}>
          {block.isOn ? '🔔 Alarm!' : '⬛ Silent'}
        </p>

        {!block.linkedRuleBlockId && (
          <p className="text-xs text-white/35 font-body text-center">Connect a rule</p>
        )}
      </div>
    </div>
  )
}
