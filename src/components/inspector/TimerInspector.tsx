'use client'

import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TimerInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const timerBlocks = useRuleStore((s) => s.timerBlocks)
  const conditionBlocks = useRuleStore((s) => s.conditionBlocks)
  const logicBlocks = useRuleStore((s) => s.logicBlocks)
  const updateTimerBlock = useRuleStore((s) => s.updateTimerBlock)

  const block = timerBlocks.find((b) => b.id === selectedBlockId)
  if (!block) return null

  const trigger = block.linkedRuleBlockId
    ? conditionBlocks.find((c) => c.id === block.linkedRuleBlockId)
      ?? logicBlocks.find((l) => l.id === block.linkedRuleBlockId)
    : null

  const timerMode = block.timerMode ?? 'duration'

  const displaySeconds = block.isRunning
    ? block.remainingSeconds
    : block.durationMinutes * 60 + block.durationSeconds

  const statusColor = block.isRunning || block.currentOutput === true ? 'text-violet-400' : 'text-white/40'
  const statusLabel =
    timerMode === 'delay-on'
      ? block.isRunning
        ? `⏳ Waiting… ${formatTime(displaySeconds)}`
        : block.currentOutput === true
          ? '✅ ON'
          : '⬛ Idle'
      : block.isRunning
        ? `⏳ Running… ${formatTime(displaySeconds)}`
        : '⬛ Idle'

  const setTimerMode = (mode: 'duration' | 'delay-on') => {
    if (mode === timerMode) return
    updateTimerBlock(block.id, {
      timerMode: mode,
      isRunning: false,
      remainingSeconds: 0,
      currentOutput: null,
      lastTriggerInput: null,
    })
  }

  return (
    <div className="glass-panel flex flex-col gap-4 p-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏱️</span>
          <div>
            <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Timer Block</p>
            <p className="text-sm font-heading font-bold text-violet-300">Set a duration</p>
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
          onChange={(e) => updateTimerBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-violet-400 bg-transparent"
        />
      </div>

      {/* Connected trigger */}
      <div className="rounded-xl bg-white/5 p-3 flex flex-col gap-1">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Connected Trigger</p>
        <p className="text-sm font-heading font-semibold text-white">
          {trigger ? trigger.name : '— not connected —'}
        </p>
        {!trigger && (
          <p className="text-xs text-white/40 font-body">Wire a 🔀 IF or logic block&apos;s output to this timer&apos;s left handle</p>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setTimerMode('duration')}
            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-heading font-bold transition-all ${
              timerMode === 'duration'
                ? 'border-violet-400 bg-violet-500/20 text-white'
                : 'border-white/15 text-white/50 hover:text-white'
            }`}
          >
            ⏳ Stay ON for…
          </button>
          <button
            onClick={() => setTimerMode('delay-on')}
            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-heading font-bold transition-all ${
              timerMode === 'delay-on'
                ? 'border-violet-400 bg-violet-500/20 text-white'
                : 'border-white/15 text-white/50 hover:text-white'
            }`}
          >
            🕐 Turn ON after…
          </button>
        </div>
      </div>

      {/* Duration inputs */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">
          {timerMode === 'delay-on' ? 'Wait then turn ON…' : 'Run for…'}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <input
              type="number"
              min={0}
              max={59}
              value={block.durationMinutes}
              onChange={(e) => updateTimerBlock(block.id, { durationMinutes: Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-violet-400 bg-transparent"
            />
            <span className="text-[10px] text-white/40 font-body text-center">minutes</span>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <input
              type="number"
              min={0}
              max={59}
              value={block.durationSeconds}
              onChange={(e) => updateTimerBlock(block.id, { durationSeconds: Math.min(59, Math.max(0, Number(e.target.value))) })}
              className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-violet-400 bg-transparent"
            />
            <span className="text-[10px] text-white/40 font-body text-center">seconds</span>
          </div>
        </div>
      </div>

      {/* Live status */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-1">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Status</p>
        <p className={`text-lg font-heading font-extrabold ${statusColor}`}>{statusLabel}</p>
      </div>

      <p className="text-[10px] text-white/35 font-body text-center italic">
        {timerMode === 'delay-on'
          ? 'When the connected rule turns TRUE, this timer waits, then turns its output ON — and OFF again as soon as the rule turns FALSE.'
          : 'When the connected rule turns TRUE, this timer counts down from the time above and keeps its output ON until it reaches 0.'}
      </p>
    </div>
  )
}
