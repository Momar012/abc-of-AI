'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import { SwitchBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

export default function SwitchNode({ data, selected }: NodeProps<{ block: SwitchBlock }>) {
  const { block } = data
  const removeSwitchBlock = useRuleStore((s) => s.removeSwitchBlock)
  const updateSwitchBlock = useRuleStore((s) => s.updateSwitchBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const toggle = () => {
    updateSwitchBlock(block.id, { isOn: !block.isOn })
    evaluateGraph()
  }

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'switch')}>
      <Handle
        type="source"
        position={Position.Right}
        id="rule-out"
        style={{ background: '#84CC16', border: '2px solid #365314', width: 12, height: 12, right: -6, top: '50%' }}
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
            ? '0 0 0 2px rgba(132,204,22,0.9), 0 0 20px rgba(132,204,22,0.3)'
            : block.isOn ? '0 0 0 2px rgba(132,204,22,0.5), 0 0 30px rgba(132,204,22,0.3)' : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeSwitchBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggle}
          className={`relative w-16 h-8 rounded-full border-2 transition-colors ${
            block.isOn ? 'bg-lime-500/30 border-lime-400' : 'bg-white/10 border-white/20'
          }`}
        >
          <motion.div
            className={`absolute top-1/2 w-6 h-6 rounded-full ${block.isOn ? 'bg-lime-400' : 'bg-white/40'}`}
            style={block.isOn ? { filter: 'drop-shadow(0 0 6px rgba(132,204,22,0.9))' } : {}}
            animate={{ left: block.isOn ? 'calc(100% - 28px)' : '4px', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>

        <p className={`text-xs font-heading font-bold ${block.isOn ? 'text-lime-400' : 'text-white/40'}`}>
          {block.isOn ? 'ON' : 'OFF'}
        </p>
      </div>
    </div>
  )
}
