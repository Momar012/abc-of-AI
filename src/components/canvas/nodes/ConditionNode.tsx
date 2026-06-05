'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { ConditionBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

export default function ConditionNode({ data, selected }: NodeProps<{ block: ConditionBlock }>) {
  const { block } = data
  const removeConditionBlock = useRuleStore((s) => s.removeConditionBlock)
  const sensorBlocks = useRuleStore((s) => s.sensorBlocks)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const sensor = sensorBlocks.find((s) => s.id === block.linkedSensorId)

  const outputColor =
    block.currentOutput === null ? 'text-white/40' :
    block.currentOutput ? 'text-emerald-400' : 'text-red-400'
  const outputLabel =
    block.currentOutput === null ? 'Waiting…' :
    block.currentOutput ? 'TRUE ✓' : 'FALSE ✗'

  const sensorLabel = sensor ? sensor.name.split(' ').slice(1).join(' ') || sensor.name : ''
  const conditionPreview = sensor
    ? `${sensorLabel} ${block.operator} ${block.threshold}`
    : 'Connect a sensor'

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'condition')}>
      {/* Input: from sensor */}
      <Handle
        type="target"
        position={Position.Left}
        id="condition-in"
        style={{ background: '#F97316', border: '2px solid #7C2D12', width: 12, height: 12, left: -6, top: '50%' }}
      />
      {/* Output: to logic/actuators */}
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
        className="glass-card w-52 flex flex-col gap-3 px-4 py-3"
        style={{
          boxShadow: selected
            ? '0 0 0 2px rgba(234,179,8,0.9), 0 0 20px rgba(234,179,8,0.3)'
            : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span className="text-sm font-heading font-bold text-white">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeConditionBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <div className="rounded-lg bg-white/5 px-3 py-2">
          <p className="text-[10px] text-white/40 font-body mb-0.5">IF</p>
          <p className="text-xs font-heading font-semibold text-yellow-300 truncate">{conditionPreview}</p>
        </div>

        <div className={`text-xs font-heading font-bold text-center py-1 rounded-lg bg-white/5 ${outputColor}`}>
          {outputLabel}
        </div>

        <p className="text-[10px] text-white/25 font-body text-center italic">double-click to edit</p>
      </div>
    </div>
  )
}
