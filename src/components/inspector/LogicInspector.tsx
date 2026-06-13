'use client'

import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
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

function SwitchBlockView({ id }: { id: string }) {
  const switchBlocks = useRuleStore((s) => s.switchBlocks)
  const updateSwitchBlock = useRuleStore((s) => s.updateSwitchBlock)
  const evaluateGraph = useRuleStore((s) => s.evaluateGraph)
  const block = switchBlocks.find((b) => b.id === id)
  if (!block) return null

  const toggle = () => {
    updateSwitchBlock(block.id, { isOn: !block.isOn })
    evaluateGraph()
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-3xl">🎚️</span>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Input</p>
          <p className="text-sm font-heading font-bold text-lime-300">Switch</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateSwitchBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-lime-400 bg-transparent"
        />
      </div>

      <button
        onClick={toggle}
        className={`relative w-24 h-12 mx-auto rounded-full border-2 transition-colors ${
          block.isOn ? 'bg-lime-500/30 border-lime-400' : 'bg-white/10 border-white/20'
        }`}
      >
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full transition-all ${
            block.isOn ? 'left-[calc(100%-42px)] bg-lime-400' : 'left-1 bg-white/40'
          }`}
          style={block.isOn ? { boxShadow: '0 0 12px rgba(132,204,22,0.9)' } : {}}
        />
      </button>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-1">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Output</p>
        <p className={`text-lg font-heading font-extrabold ${block.isOn ? 'text-emerald-400' : 'text-red-400'}`}>
          {block.isOn ? 'TRUE ✓' : 'FALSE ✗'}
        </p>
      </div>

      <div className="rounded-xl bg-lime-500/10 border border-lime-500/20 p-3">
        <p className="text-xs text-lime-200/80 font-body leading-relaxed">
          Flip this switch to send TRUE or FALSE into a Logic Gate (AND / OR / NOT) — or straight to a 💡 Bulb.
        </p>
      </div>
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

function ACBlockView({ id }: { id: string }) {
  const acBlocks = useRuleStore((s) => s.acBlocks)
  const updateACBlock = useRuleStore((s) => s.updateACBlock)
  const block = acBlocks.find((b) => b.id === id)
  if (!block) return null

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-3xl">❄️</span>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Actuator</p>
          <p className="text-sm font-heading font-bold text-cyan-300">AC</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateACBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-cyan-400 bg-transparent"
        />
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider mb-1">Status</p>
        <p className={`text-lg font-heading font-extrabold ${block.isOn ? 'text-cyan-400' : 'text-white/40'}`}>
          {block.isOn ? '🥶 Cooling!' : '⬛ Off'}
        </p>
      </div>

      {!block.linkedRuleBlockId && (
        <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3">
          <p className="text-xs text-cyan-200/80 font-body">Connect a rule block&apos;s output (or a ⏱️ Timer) to this AC&apos;s left handle to control it.</p>
        </div>
      )}
    </>
  )
}

function DoorBlockView({ id }: { id: string }) {
  const doorBlocks = useWorkflowStore((s) => s.doorBlocks)
  const updateDoorBlock = useWorkflowStore((s) => s.updateDoorBlock)
  const block = doorBlocks.find((b) => b.id === id)
  if (!block) return null

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-3xl">🚪</span>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Actuator</p>
          <p className="text-sm font-heading font-bold text-amber-300">Door</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateDoorBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-amber-400 bg-transparent"
        />
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider mb-1">Status</p>
        <p className={`text-lg font-heading font-extrabold ${block.isOpen ? 'text-emerald-400' : 'text-white/40'}`}>
          {block.isOpen ? '🚪 Open!' : '🔒 Closed'}
        </p>
      </div>

      {!block.linkedRuleBlockId && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-200/80 font-body">Connect a rule block&apos;s output to this door&apos;s left handle to control it.</p>
        </div>
      )}
    </>
  )
}

function BulbBlockView({ id }: { id: string }) {
  const bulbBlocks = useWorkflowStore((s) => s.bulbBlocks)
  const updateBulbBlock = useWorkflowStore((s) => s.updateBulbBlock)
  const block = bulbBlocks.find((b) => b.id === id)
  if (!block) return null

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="text-3xl">💡</span>
        <div>
          <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Actuator</p>
          <p className="text-sm font-heading font-bold text-yellow-300">Bulb</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Name</label>
        <input
          value={block.name}
          onChange={(e) => updateBulbBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 bg-transparent"
        />
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider mb-1">Status</p>
        <p className={`text-lg font-heading font-extrabold ${block.isOn ? 'text-yellow-400' : 'text-white/40'}`}>
          {block.isOn ? '💡 On!' : '⬛ Off'}
        </p>
      </div>

      {!block.linkedRuleBlockId && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3">
          <p className="text-xs text-yellow-200/80 font-body">Connect a rule block&apos;s output to this bulb&apos;s left handle to control it.</p>
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
      {selectedBlockType === 'switch' && <SwitchBlockView id={selectedBlockId} />}
      {selectedBlockType === 'logic' && <LogicBlockView id={selectedBlockId} />}
      {selectedBlockType === 'fan'   && <FanBlockView   id={selectedBlockId} />}
      {selectedBlockType === 'alarm' && <AlarmBlockView id={selectedBlockId} />}
      {selectedBlockType === 'ac'    && <ACBlockView    id={selectedBlockId} />}
      {selectedBlockType === 'door'  && <DoorBlockView  id={selectedBlockId} />}
      {selectedBlockType === 'bulb'  && <BulbBlockView  id={selectedBlockId} />}
    </div>
  )
}
