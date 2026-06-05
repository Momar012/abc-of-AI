'use client'

import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

const SENSOR_EMOJI: Record<string, string> = {
  temperature: '🌡️',
  light: '💡',
  motion: '👁️',
  humidity: '💧',
  'text-input': '📝',
}

const SENSOR_TITLE: Record<string, string> = {
  temperature: 'Temperature Sensor',
  light: 'Light Level Sensor',
  motion: 'Motion Sensor',
  humidity: 'Humidity Sensor',
  'text-input': 'Text Input',
}

export default function SensorInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const sensorBlocks = useRuleStore((s) => s.sensorBlocks)
  const updateSensorBlock = useRuleStore((s) => s.updateSensorBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)

  const block = sensorBlocks.find((b) => b.id === selectedBlockId)
  if (!block) return null

  const isNumeric = block.sensorType !== 'motion' && block.sensorType !== 'text-input'
  const emoji = SENSOR_EMOJI[block.sensorType] ?? '📡'

  const setValue = (v: number | boolean | string) => {
    updateSensorBlock(block.id, { value: v })
    evaluateGraph()
  }

  return (
    <div className="glass-card flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <div>
            <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Sensor</p>
            <p className="text-sm font-heading font-bold text-orange-300">
              {SENSOR_TITLE[block.sensorType]}
            </p>
          </div>
        </div>
        <button
          onClick={clearSelectedBlock}
          className="w-6 h-6 rounded-full bg-white/10 text-white/40 hover:text-white hover:bg-white/20 text-xs flex items-center justify-center transition-all"
        >
          ×
        </button>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateSensorBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-orange-400 bg-transparent"
        />
      </div>

      {/* Value control */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Current Value</label>

        {isNumeric && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40 font-body">{block.min ?? 0}{block.unit}</span>
              <span className="text-lg font-heading font-extrabold text-orange-300">
                {String(block.value)}<span className="text-sm text-white/60 ml-0.5">{block.unit}</span>
              </span>
              <span className="text-xs text-white/40 font-body">{block.max ?? 100}{block.unit}</span>
            </div>
            <input
              type="range"
              min={block.min ?? 0}
              max={block.max ?? 100}
              step={1}
              value={Number(block.value)}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full h-3 rounded-full cursor-pointer accent-orange-400"
            />
          </div>
        )}

        {block.sensorType === 'motion' && (
          <button
            onClick={() => setValue(!block.value)}
            className={`w-full py-3 rounded-xl text-sm font-heading font-bold transition-all ${
              block.value
                ? 'bg-orange-500/20 text-orange-300 border-2 border-orange-500/60'
                : 'bg-white/5 text-white/40 border-2 border-white/10'
            }`}
          >
            {block.value ? '👁️ Motion Detected' : '🔇 No Motion — click to trigger'}
          </button>
        )}

        {block.sensorType === 'text-input' && (
          <input
            type="text"
            value={String(block.value)}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type a value…"
            className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-orange-400 bg-transparent"
          />
        )}
      </div>

      {/* Hint */}
      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
        <p className="text-xs text-orange-200/80 font-body leading-relaxed">
          💡 Connect this sensor&apos;s output to an <strong>IF</strong> block, then set a condition. When the condition is true, the connected action (Door, Fan, Bulb…) will activate!
        </p>
      </div>
    </div>
  )
}
