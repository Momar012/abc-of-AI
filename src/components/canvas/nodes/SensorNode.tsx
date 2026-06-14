'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { SensorBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

const SENSOR_EMOJI: Record<string, string> = {
  temperature: '🌡️',
  light: '💡',
  motion: '👁️',
  humidity: '💧',
  'text-input': '📝',
}

export default function SensorNode({ data, selected }: NodeProps<{ block: SensorBlock }>) {
  const { block } = data
  const updateSensorBlock = useRuleStore((s) => s.updateSensorBlock)
  const removeSensorBlock = useRuleStore((s) => s.removeSensorBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const emoji = SENSOR_EMOJI[block.sensorType] ?? '📡'
  const isNumeric = block.sensorType !== 'motion' && block.sensorType !== 'text-input'

  const handleValueChange = (newVal: number | boolean | string) => {
    updateSensorBlock(block.id, { value: newVal })
    evaluateGraph()
  }

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'sensor')}>
      <Handle
        type="source"
        position={Position.Right}
        id="sensor-out"
        style={{ background: '#F97316', border: '2px solid #7C2D12', width: 12, height: 12, right: -6, top: '50%' }}
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
            ? '0 0 0 2px rgba(249,115,22,0.9), 0 0 20px rgba(249,115,22,0.3)'
            : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{emoji}</span>
            <span className="text-xs font-heading font-bold text-white">{block.name}</span>
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeSensorBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        {/* Inline value control */}
        {isNumeric && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-white/40 font-body">{block.min ?? 0}</span>
              <span className="font-heading font-bold text-orange-300">
                {String(block.value)}{block.unit}
              </span>
              <span className="text-white/40 font-body">{block.max ?? 100}</span>
            </div>
            <input
              type="range"
              min={block.min ?? 0}
              max={block.max ?? 100}
              step={block.sensorType === 'temperature' ? 1 : 1}
              value={Number(block.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => handleValueChange(Number(e.target.value))}
              className="w-full h-2 rounded-full cursor-pointer accent-orange-400"
            />
          </div>
        )}

        {block.sensorType === 'motion' && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleValueChange(!block.value)}
            className={`w-full py-1.5 rounded-lg text-xs font-heading font-bold transition-all ${
              block.value
                ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50'
                : 'bg-white/5 text-white/40 border border-white/10'
            }`}
          >
            {block.value ? '👁️ Motion Detected' : '🔇 No Motion'}
          </button>
        )}

        {block.sensorType === 'text-input' && (
          <input
            type="text"
            value={String(block.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Type a value…"
            className="w-full px-2 py-1.5 rounded-lg border border-white/15 text-white text-xs font-body outline-none focus:border-orange-400 bg-transparent"
          />
        )}

        <p className="text-[10px] text-white/35 font-body text-center italic">double-click to inspect</p>
      </div>
    </div>
  )
}
