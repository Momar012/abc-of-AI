'use client'

import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'

const LOGIC_INFO = {
  and: { emoji: '∧', label: 'AND Gate', desc: 'Output is TRUE only when BOTH inputs are TRUE.' },
  or:  { emoji: '∨', label: 'OR Gate',  desc: 'Output is TRUE when AT LEAST ONE input is TRUE.' },
  not: { emoji: '¬', label: 'NOT Gate', desc: 'Output is the OPPOSITE of the input.' },
}

function LogicBlockView({ id }: { id: string }) {
  const logicBlocks = useRuleStore((s) => s.logicBlocks)
  const updateLogicBlock = useRuleStore((s) => s.updateLogicBlock)
  const block = logicBlocks.find((b) => b.id === id)
  if (!block) return null

  const info = LOGIC_INFO[block.logicType]
  const outputColor =
    block.currentOutput === null ? 'text-white/40' :
    block.currentOutput ? 'text-emerald-400' : 'text-red-400'
  const outputLabel =
    block.currentOutput === null ? 'Waiting…' :
    block.currentOutput ? 'TRUE ✓' : 'FALSE ✗'

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-lime-500/20 border-2 border-lime-500/40 flex items-center justify-center">
          <span className="text-xl font-bold text-lime-300">{info.emoji}</span>
        </div>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Logic Block</p>
          <p className="text-sm font-heading font-bold text-lime-300">{info.label}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateLogicBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-lime-400 bg-transparent"
        />
      </div>

      <div className="rounded-xl bg-lime-500/10 border border-lime-500/20 p-3">
        <p className="text-xs text-lime-200/80 font-body leading-relaxed">{info.desc}</p>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-1">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Output</p>
        <p className={`text-lg font-heading font-extrabold ${outputColor}`}>{outputLabel}</p>
      </div>

      <p className="text-[10px] text-white/25 font-body text-center italic">
        Wire rule outputs into the handles on the left. The result feeds into the right handle.
      </p>
    </>
  )
}

function FanBlockView({ id }: { id: string }) {
  const fanBlocks = useRuleStore((s) => s.fanBlocks)
  const updateFanBlock = useRuleStore((s) => s.updateFanBlock)
  const block = fanBlocks.find((b) => b.id === id)
  if (!block) return null

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-3xl">🌀</span>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Actuator</p>
          <p className="text-sm font-heading font-bold text-sky-300">Fan</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateFanBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-sky-400 bg-transparent"
        />
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider mb-1">Status</p>
        <p className={`text-lg font-heading font-extrabold ${block.isOn ? 'text-sky-400' : 'text-white/40'}`}>
          {block.isOn ? '💨 Running!' : '⬛ Off'}
        </p>
      </div>

      {!block.linkedRuleBlockId && (
        <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-3">
          <p className="text-xs text-sky-200/80 font-body">Connect a rule block&apos;s output to this fan&apos;s left handle to control it.</p>
        </div>
      )}
    </>
  )
}

function AlarmBlockView({ id }: { id: string }) {
  const alarmBlocks = useRuleStore((s) => s.alarmBlocks)
  const updateAlarmBlock = useRuleStore((s) => s.updateAlarmBlock)
  const block = alarmBlocks.find((b) => b.id === id)
  if (!block) return null

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-3xl">🚨</span>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Actuator</p>
          <p className="text-sm font-heading font-bold text-red-300">Alarm</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateAlarmBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-red-400 bg-transparent"
        />
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider mb-1">Status</p>
        <p className={`text-lg font-heading font-extrabold ${block.isOn ? 'text-red-400' : 'text-white/40'}`}>
          {block.isOn ? '🔔 Alarm!' : '⬛ Silent'}
        </p>
      </div>

      {!block.linkedRuleBlockId && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-200/80 font-body">Connect a rule block&apos;s output to this alarm&apos;s left handle to control it.</p>
        </div>
      )}
    </>
  )
}

export default function LogicInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const selectedBlockType = useUIStore((s) => s.selectedBlockType)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)

  if (!selectedBlockId) return null

  return (
    <div className="glass-card flex flex-col gap-4 p-4">
      <div className="flex justify-end">
        <button
          onClick={clearSelectedBlock}
          className="w-6 h-6 rounded-full bg-white/10 text-white/40 hover:text-white hover:bg-white/20 text-xs flex items-center justify-center transition-all"
        >
          ×
        </button>
      </div>
      {selectedBlockType === 'logic' && <LogicBlockView id={selectedBlockId} />}
      {selectedBlockType === 'fan'   && <FanBlockView   id={selectedBlockId} />}
      {selectedBlockType === 'alarm' && <AlarmBlockView id={selectedBlockId} />}
    </div>
  )
}
