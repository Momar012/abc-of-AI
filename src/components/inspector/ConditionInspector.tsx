'use client'

import { useState } from 'react'
import { useRuleStore } from '@/store/useRuleStore'
import { useUIStore } from '@/store/useUIStore'
import { useModelStore } from '@/store/useModelStore'
import { RuleOperator } from '@/types/rules'

const NUMERIC_OPS: { value: RuleOperator; label: string }[] = [
  { value: '>', label: '> greater than' },
  { value: '<', label: '< less than' },
  { value: '>=', label: '≥ greater or equal' },
  { value: '<=', label: '≤ less or equal' },
  { value: '==', label: '= equals' },
  { value: '!=', label: '≠ not equals' },
]

const TEXT_OPS: { value: RuleOperator; label: string }[] = [
  { value: '==', label: '= equals' },
  { value: '!=', label: '≠ not equals' },
  { value: 'contains', label: '∋ contains' },
]

const MOTION_OPS: { value: RuleOperator; label: string }[] = [
  { value: 'is', label: 'is (true / false)' },
]

export default function ConditionInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const conditionBlocks = useRuleStore((s) => s.conditionBlocks)
  const sensorBlocks    = useRuleStore((s) => s.sensorBlocks)
  const updateConditionBlock = useRuleStore((s) => s.updateConditionBlock)
  const evaluateGraph        = useRuleStore((s) => s.evaluateGraph)
  const modelBlocks = useModelStore((s) => s.modelBlocks)
  const trainedModels = useModelStore((s) => s.trainedModels)

  const block = conditionBlocks.find((b) => b.id === selectedBlockId)
  const [thresholdText, setThresholdText] = useState(() => (block?.threshold == null ? '' : String(block.threshold)))
  if (!block) return null

  const isModelMode = !!block.linkedModelId
  const sensor = sensorBlocks.find((s) => s.id === block.linkedSensorId)
  const sensorType = sensor?.sensorType ?? 'temperature'
  const linkedModel = modelBlocks.find((m) => m.id === block.linkedModelId)
  const trainedModel = trainedModels.find((m) => m.id === linkedModel?.trainedModelId)
  const availableLabels = trainedModel?.labels ?? []
  const isLiveMode = !!linkedModel?.liveLinkedSensorId
  const currentPrediction = isLiveMode
    ? (linkedModel?.liveResult?.predictedLabel ?? null)
    : (linkedModel?.testResults?.[0]?.predictedLabel ?? null)
  const liveConfidence = isLiveMode ? (linkedModel?.liveResult?.confidence ?? null) : null
  const labelMatchCount = (!isLiveMode && block.modelCondition && linkedModel?.testResults?.length)
    ? linkedModel.testResults.filter((r: { predictedLabel: string }) => r.predictedLabel === block.modelCondition).length
    : null

  const ops =
    sensorType === 'motion' ? MOTION_OPS :
    sensorType === 'text-input' ? TEXT_OPS :
    NUMERIC_OPS

  const outputColor =
    block.currentOutput === null ? 'text-white/40' :
    block.currentOutput ? 'text-emerald-400' : 'text-red-400'
  const outputLabel =
    block.currentOutput === null
      ? (isModelMode
          ? (isLiveMode ? 'Type text in the sensor to predict…' : 'Waiting for test result…')
          : 'Waiting for sensor…')
      : block.currentOutput ? 'TRUE ✓' : 'FALSE ✗'

  const update = (updates: Parameters<typeof updateConditionBlock>[1]) => {
    updateConditionBlock(block.id, updates)
    evaluateGraph()
  }

  return (
    <div className="glass-panel flex flex-col gap-4 p-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔀</span>
          <div>
            <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">IF Block</p>
            <p className="text-sm font-heading font-bold text-yellow-300">
              {isModelMode ? 'Model Prediction' : 'Sensor Condition'}
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
          onChange={(e) => updateConditionBlock(block.id, { name: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 bg-transparent"
        />
      </div>

      {isModelMode ? (
        /* ── Model prediction mode ── */
        <>
          <div className="rounded-xl bg-white/5 p-3 flex flex-col gap-1">
            <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Connected Model</p>
            <p className="text-sm font-heading font-semibold text-white">
              {linkedModel ? linkedModel.name : '— not found —'}
            </p>
            {linkedModel && !trainedModel && (
              <p className="text-xs text-amber-400/80 font-body mt-0.5">⚠ Train the model first, then run a test.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">If prediction is…</label>
            {availableLabels.length > 0 ? (
              <select
                value={block.modelCondition ?? ''}
                onChange={(e) => update({ modelCondition: e.target.value || null, currentOutput: null })}
                className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 cursor-pointer"
                style={{ backgroundColor: '#1e1b4b' }}
              >
                <option value="" style={{ backgroundColor: '#1e1b4b' }}>Pick a label…</option>
                {availableLabels.map((label) => (
                  <option key={label} value={label} style={{ backgroundColor: '#1e1b4b' }}>{label}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-white/40 font-body">
                Train the model and run a test to see labels here.
              </p>
            )}
          </div>

          <p className="text-[10px] text-white/25 font-body italic">
            {isLiveMode
              ? 'Live mode: type in the sensor text box and the model predicts instantly.'
              : 'Tip: Add another IF condition connected to the same model to handle a different label.'}
          </p>
        </>
      ) : (
        /* ── Sensor condition mode ── */
        <>
          <div className="rounded-xl bg-white/5 p-3 flex flex-col gap-1">
            <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Connected Sensor</p>
            <p className="text-sm font-heading font-semibold text-white">
              {sensor ? sensor.name : '— not connected —'}
            </p>
            {!sensor && (
              <p className="text-xs text-white/40 font-body">Wire a 📡 Sensor to this IF block&apos;s left handle</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-white/40 font-body uppercase tracking-wider">Condition</label>
            <select
              value={block.operator}
              onChange={(e) => update({ operator: e.target.value as RuleOperator })}
              className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 cursor-pointer"
              style={{ backgroundColor: '#1e1b4b' }}
            >
              {ops.map((op) => (
                <option key={op.value} value={op.value} style={{ backgroundColor: '#1e1b4b' }}>
                  {op.label}
                </option>
              ))}
            </select>

            {sensorType === 'motion' ? (
              <select
                value={String(block.threshold)}
                onChange={(e) => update({ threshold: e.target.value === 'true' })}
                className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 cursor-pointer"
                style={{ backgroundColor: '#1e1b4b' }}
              >
                <option value="true" style={{ backgroundColor: '#1e1b4b' }}>true (motion detected)</option>
                <option value="false" style={{ backgroundColor: '#1e1b4b' }}>false (no motion)</option>
              </select>
            ) : sensorType === 'text-input' ? (
              <input
                type="text"
                value={String(block.threshold)}
                onChange={(e) => update({ threshold: e.target.value })}
                placeholder="Value to compare…"
                className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 bg-transparent"
              />
            ) : (
              <input
                type="number"
                value={thresholdText}
                onChange={(e) => {
                  const v = e.target.value
                  setThresholdText(v)
                  if (v === '' || v === '-') {
                    update({ threshold: null })
                    return
                  }
                  const n = Number(v)
                  if (!Number.isNaN(n)) update({ threshold: n })
                }}
                onBlur={() => {
                  if (thresholdText === '' || Number.isNaN(Number(thresholdText))) {
                    setThresholdText('')
                    update({ threshold: null })
                  }
                }}
                placeholder="Enter a number…"
                className="w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-yellow-400 bg-transparent"
              />
            )}
          </div>
        </>
      )}

      {/* Live preview */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-1">
        <p className="text-[10px] text-white/40 font-body uppercase tracking-wider">Live Result</p>
        {!isModelMode && (
          <p className="text-xs font-body text-white/70">
            IF{' '}
            <span className="text-orange-300 font-semibold">
              {sensor ? (sensor.name.split(' ').slice(1).join(' ') || sensor.name) : '?'}
            </span>{' '}
            <span className="text-yellow-300">{block.operator}</span>{' '}
            <span className="text-lime-300">{block.threshold === null ? '…' : String(block.threshold)}</span>
          </p>
        )}
        {isModelMode && block.modelCondition && (
          <p className="text-xs font-body text-white/70">
            IF prediction =={' '}
            <span className="text-violet-300 font-semibold">&quot;{block.modelCondition}&quot;</span>
          </p>
        )}
        {isModelMode && currentPrediction && (
          <p className="text-xs font-body text-white/40 mt-0.5">
            {isLiveMode ? 'Live prediction:' : 'Latest prediction:'}{' '}
            <span className={currentPrediction === block.modelCondition ? 'text-emerald-400 font-semibold' : 'text-white/55'}>
              &quot;{currentPrediction}&quot;
            </span>
            {liveConfidence !== null && (
              <span className="text-white/30 ml-1">({Math.round(liveConfidence * 100)}%)</span>
            )}
          </p>
        )}
        {labelMatchCount !== null && linkedModel?.testResults?.length && (
          <p className="text-xs font-body text-white/40">
            {labelMatchCount} of {linkedModel.testResults.length} items matched
          </p>
        )}
        <p className={`text-sm font-heading font-bold ${outputColor}`}>→ {outputLabel}</p>
      </div>
    </div>
  )
}
