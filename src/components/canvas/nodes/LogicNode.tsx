'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { LogicBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

const LOGIC_EMOJI: Record<string, string> = { and: '∧', or: '∨', not: '¬' }
const LOGIC_LABEL: Record<string, string> = { and: 'AND', or: 'OR', not: 'NOT' }

export default function LogicNode({ data, selected }: NodeProps<{ block: LogicBlock }>) {
  const { block } = data
  const removeLogicBlock = useRuleStore((s) => s.removeLogicBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const outputColor =
    block.currentOutput === null ? 'text-white/40' :
    block.currentOutput ? 'text-emerald-400' : 'text-red-400'
  const outputLabel =
    block.currentOutput === null ? 'Waiting…' :
    block.currentOutput ? 'TRUE ✓' : 'FALSE ✗'

  const isBinary = block.logicType !== 'not'
  const topInput = isBinary ? '35%' : '50%'
  const botInput = '65%'

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'logic')}>
      {/* Input handle(s) */}
      <Handle
        type="target"
        position={Position.Left}
        id={isBinary ? 'logic-in-1' : 'logic-in'}
        style={{ background: '#84CC16', border: '2px solid #365314', width: 12, height: 12, left: -6, top: topInput }}
      />
      {isBinary && (
        <Handle
          type="target"
          position={Position.Left}
          id="logic-in-2"
          style={{ background: '#84CC16', border: '2px solid #365314', width: 12, height: 12, left: -6, top: botInput }}
        />
      )}
      {/* Output */}
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
            : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeLogicBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <div className="w-12 h-12 rounded-full bg-lime-500/20 border-2 border-lime-500/40 flex items-center justify-center">
          <span className="text-xl font-bold text-lime-300">{LOGIC_EMOJI[block.logicType]}</span>
        </div>
        <span className="text-xs font-heading font-bold text-lime-400">{LOGIC_LABEL[block.logicType]}</span>

        <div className={`w-full text-xs font-heading font-bold text-center py-1 rounded-lg bg-white/5 ${outputColor}`}>
          {outputLabel}
        </div>

        <p className="text-[10px] text-white/25 font-body text-center italic">double-click to inspect</p>
      </div>
    </div>
  )
}
