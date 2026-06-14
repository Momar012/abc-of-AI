'use client'

import { NodeProps, Handle, Position } from 'reactflow'
import { motion } from 'framer-motion'
import { TimerBlock } from '@/types/rules'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TimerNode({ data, selected }: NodeProps<{ block: TimerBlock }>) {
  const { block } = data
  const removeTimerBlock = useRuleStore((s) => s.removeTimerBlock)
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock)

  const timerMode = block.timerMode ?? 'duration'

  const displaySeconds = block.isRunning
    ? block.remainingSeconds
    : block.durationMinutes * 60 + block.durationSeconds

  const isActive = block.isRunning || block.currentOutput === true
  const statusLabel =
    timerMode === 'delay-on'
      ? block.isRunning
        ? '⏳ Waiting…'
        : block.currentOutput === true
          ? '✅ ON'
          : '⬛ Idle'
      : block.isRunning
        ? '⏳ Running…'
        : '⬛ Idle'

  return (
    <div className="flex flex-col" onDoubleClick={() => setSelectedBlock(block.id, 'timer')}>
      {/* Input: trigger from a condition/logic rule output */}
      <Handle
        type="target"
        position={Position.Left}
        id="timer-in"
        style={{ background: '#84CC16', border: '2px solid #365314', width: 12, height: 12, left: -6, top: '50%' }}
      />
      {/* Output: feeds an actuator's input */}
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
            ? '0 0 0 2px rgba(167,139,250,0.9), 0 0 20px rgba(167,139,250,0.3)'
            : undefined,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-heading font-bold text-white/70">{block.name}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => removeTimerBlock(block.id)}
            className="w-5 h-5 rounded-full bg-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 text-xs flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        <motion.div
          animate={block.isRunning ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={block.isRunning ? { repeat: Infinity, duration: 1, ease: 'easeInOut' } : { duration: 0 }}
          className="text-5xl select-none"
          style={isActive ? { filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.8))' } : { opacity: 0.5 }}
        >
          ⏱️
        </motion.div>

        <p className={`text-lg font-heading font-extrabold ${isActive ? 'text-violet-300' : 'text-white/40'}`}>
          {formatTime(displaySeconds)}
        </p>

        <p className={`text-xs font-heading font-bold ${isActive ? 'text-violet-400' : 'text-white/40'}`}>
          {statusLabel}
        </p>

        {!block.linkedRuleBlockId && (
          <p className="text-xs text-white/35 font-body text-center">Connect a rule</p>
        )}

        <p className="text-[10px] text-white/35 font-body text-center italic">double-click to edit</p>
      </div>
    </div>
  )
}
