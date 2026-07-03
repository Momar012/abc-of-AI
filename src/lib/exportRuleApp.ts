import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useModelStore } from '@/store/useModelStore'

export interface ExportCardInfo {
  id: string
  name: string
  icon: string
  category: 'input' | 'output'
}

const SENSOR_ICONS: Record<string, string> = {
  temperature: '🌡️', light: '☀️', motion: '👁️', humidity: '💧', 'text-input': '📝',
}

export function getExportCards(selectedIds: Set<string>): ExportCardInfo[] {
  const rule = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const modelState = useModelStore.getState()
  const keep = (id: string) => selectedIds.has(id)
  const cards: ExportCardInfo[] = []
  const liveSensorIds = new Set(rule.sensorBlocks.filter(s => keep(s.id)).map(s => s.id))

  rule.sensorBlocks.filter(s => keep(s.id)).forEach(s => {
    cards.push({ id: s.id, name: s.name, icon: SENSOR_ICONS[s.sensorType] ?? '📡', category: 'input' })
  })
  rule.switchBlocks.filter(s => keep(s.id)).forEach(s => {
    cards.push({ id: s.id, name: s.name, icon: '🎚️', category: 'input' })
  })
  rule.timerBlocks.filter(t => keep(t.id)).forEach(t => {
    cards.push({ id: t.id, name: t.name, icon: '⏱️', category: 'input' })
  })
  modelState.modelBlocks
    .filter(b => keep(b.id) && (b.modelType === 'text-supervised' || b.modelType === 'text-unsupervised') && b.trainedModelId)
    .forEach(mb => {
      if (!mb.liveLinkedSensorId || !liveSensorIds.has(mb.liveLinkedSensorId)) {
        cards.push({ id: mb.id, name: mb.name, icon: '📝', category: 'input' })
      }
    })
  modelState.modelBlocks
    .filter(b => keep(b.id) && (b.modelType === 'image-supervised' || b.modelType === 'image-classifier' || b.modelType === 'image-unsupervised') && b.trainedModelId)
    .forEach(mb => {
      cards.push({ id: mb.id, name: mb.name, icon: '📷', category: 'input' })
    })
  workflow.bulbBlocks.filter(b => keep(b.id)).forEach(b => {
    cards.push({ id: b.id, name: b.name, icon: '💡', category: 'output' })
  })
  rule.fanBlocks.filter(f => keep(f.id)).forEach(f => {
    cards.push({ id: f.id, name: f.name, icon: '🌀', category: 'output' })
  })
  workflow.doorBlocks.filter(d => keep(d.id)).forEach(d => {
    cards.push({ id: d.id, name: d.name, icon: '🚪', category: 'output' })
  })
  rule.alarmBlocks.filter(a => keep(a.id)).forEach(a => {
    cards.push({ id: a.id, name: a.name, icon: '🚨', category: 'output' })
  })
  rule.acBlocks.filter(a => keep(a.id)).forEach(a => {
    cards.push({ id: a.id, name: a.name, icon: '❄️', category: 'output' })
  })
  return cards
}

export function validateExportSelection(selectedIds: Set<string>): {
  valid: boolean
  reason: 'ok' | 'no-outputs' | 'unconnected-output' | 'incomplete-chain' | 'untrained-model' | 'unsupported-model-type'
} {
  const rule = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const modelState = useModelStore.getState()

  // Early check: any selected condition using a model must be trained + a supported type
  for (const cond of rule.conditionBlocks.filter(c => selectedIds.has(c.id) && c.linkedModelId)) {
    const mb = modelState.modelBlocks.find(b => b.id === cond.linkedModelId)
    if (!mb || mb.status !== 'trained' || !mb.trainedModelId) {
      return { valid: false, reason: 'untrained-model' }
    }
    const allowed = ['text-supervised', 'image-supervised', 'image-classifier', 'text-unsupervised', 'image-unsupervised']
    if (!allowed.includes(mb.modelType ?? '')) {
      return { valid: false, reason: 'unsupported-model-type' }
    }
  }

  const outputDevices = [
    ...rule.fanBlocks,
    ...rule.alarmBlocks,
    ...rule.acBlocks,
    ...workflow.doorBlocks,
    ...workflow.bulbBlocks,
  ].filter(d => selectedIds.has(d.id))

  if (outputDevices.length === 0) return { valid: false, reason: 'no-outputs' }

  for (const d of outputDevices) {
    if (!d.linkedRuleBlockId || !selectedIds.has(d.linkedRuleBlockId)) {
      return { valid: false, reason: 'unconnected-output' }
    }
  }

  const visited = new Set<string>()

  function check(id: string): boolean {
    if (!id || !selectedIds.has(id)) return false
    if (visited.has(id)) return true
    visited.add(id)

    const logic = rule.logicBlocks.find(b => b.id === id)
    if (logic) {
      const nonNull = logic.linkedInputIds.filter(Boolean) as string[]
      return nonNull.length > 0 && nonNull.every(check)
    }

    const cond = rule.conditionBlocks.find(b => b.id === id)
    if (cond) {
      if (cond.linkedSensorId) return selectedIds.has(cond.linkedSensorId)
      if (cond.linkedModelId) {
        if (!selectedIds.has(cond.linkedModelId)) return false
        const mb = modelState.modelBlocks.find(b => b.id === cond.linkedModelId)
        // Image models use the webcam; text models provide an inline input in the exported app.
        // Only the model block itself needs to be in the selection — no sensor required.
        return true
      }
      return false
    }

    if (rule.switchBlocks.some(b => b.id === id)) return true
    if (rule.sensorBlocks.some(b => b.id === id)) return true

    const timer = rule.timerBlocks.find(b => b.id === id)
    if (timer) return !!timer.linkedRuleBlockId && check(timer.linkedRuleBlockId)

    return false
  }

  for (const d of outputDevices) {
    if (!check(d.linkedRuleBlockId!)) {
      return { valid: false, reason: 'incomplete-chain' }
    }
  }

  return { valid: true, reason: 'ok' }
}

export function validateAIModelExport(selectedIds: Set<string>): {
  valid: boolean
  reason: 'ok' | 'no-model' | 'untrained-model' | 'unsupported-type' | 'legacy-model'
} {
  const modelState = useModelStore.getState()
  const selected = modelState.modelBlocks.filter(b => selectedIds.has(b.id))
  if (selected.length === 0) return { valid: false, reason: 'no-model' }
  const EXPORTABLE = new Set(['text-supervised', 'image-supervised', 'image-classifier', 'text-unsupervised', 'image-unsupervised'])
  for (const mb of selected) {
    if (mb.status !== 'trained' || !mb.trainedModelId) return { valid: false, reason: 'untrained-model' }
    if (!EXPORTABLE.has(mb.modelType ?? '')) return { valid: false, reason: 'unsupported-type' }
    if (mb.modelType === 'text-supervised') {
      const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
      if (!tm?.nbWordLogProbs || Object.keys(tm.nbWordLogProbs).length === 0) {
        return { valid: false, reason: 'legacy-model' }
      }
    }
  }
  return { valid: true, reason: 'ok' }
}

const THEMES = {
  space:  { bg1:'#0c0a1e', bg2:'#130926', acc:'#8b5cf6', acc2:'#2dd4bf',
            orb1:'rgba(139,92,246,0.12)', orb2:'rgba(45,212,191,0.10)',
            ptBg:'#ffffff', ptW:2, ptH:2, ptRad:'50%' },
  ocean:  { bg1:'#031628', bg2:'#061020', acc:'#06b6d4', acc2:'#0ea5e9',
            orb1:'rgba(6,182,212,0.13)',  orb2:'rgba(14,165,233,0.10)',
            ptBg:'#7dd3fc', ptW:5, ptH:5, ptRad:'50%' },
  jungle: { bg1:'#061a0a', bg2:'#031208', acc:'#22c55e', acc2:'#10b981',
            orb1:'rgba(34,197,94,0.11)',  orb2:'rgba(16,185,129,0.09)',
            ptBg:'#86efac', ptW:3, ptH:3, ptRad:'50%' },
  neon:   { bg1:'#0a0814', bg2:'#0d0520', acc:'#ec4899', acc2:'#f97316',
            orb1:'rgba(236,72,153,0.13)', orb2:'rgba(249,115,22,0.10)',
            ptBg:'#f9a8d4', ptW:2, ptH:12, ptRad:'2px' },
  candy:  { bg1:'#1a0828', bg2:'#200a30', acc:'#e879f9', acc2:'#fbbf24',
            orb1:'rgba(232,121,249,0.13)',orb2:'rgba(251,191,36,0.10)',
            ptBg:'#f0abfc', ptW:6, ptH:6, ptRad:'2px' },
} as const

type Theme = keyof typeof THEMES
type Layout = 'classic' | 'dashboard' | 'mobile'

export function exportRuleApp(
  appName = 'My AI App',
  selectedIds?: Set<string>,
  theme: Theme = 'space',
  layout: Layout = 'classic',
  creatorName = '',
  instructions = '',
  cardOrder: string[] = [],
): void {
  const rule = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const keep = (id: string) => !selectedIds || selectedIds.has(id)

  const modelState = useModelStore.getState()
  const models = modelState.modelBlocks
    .filter(b => keep(b.id) && b.modelType === 'text-supervised' && b.trainedModelId)
    .map(mb => {
      const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
      return {
        id: mb.id,
        name: mb.name,
        liveSensorId: mb.liveLinkedSensorId ?? null,
        vocab: tm?.textVocab ?? [],
        wordLogProbs: tm?.nbWordLogProbs ?? {},
        classLogPriors: tm?.nbClassLogPriors ?? {},
        labels: tm?.labels ?? [],
        labelIds: tm?.labelIds ?? [],
      }
    })

  const imageModels = modelState.modelBlocks
    .filter(b => keep(b.id) && (b.modelType === 'image-supervised' || b.modelType === 'image-classifier') && b.trainedModelId)
    .map(mb => {
      const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
      return {
        id: mb.id,
        name: mb.name,
        labels: tm?.labels ?? [],
        labelIds: tm?.labelIds ?? [],
        knnData: tm?.knnData ?? {},
      }
    })

  const textClusterModels = modelState.modelBlocks
    .filter(b => keep(b.id) && b.modelType === 'text-unsupervised' && b.trainedModelId)
    .map(mb => {
      const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
      return {
        id: mb.id,
        name: mb.name,
        liveSensorId: mb.liveLinkedSensorId ?? null,
        labels: tm?.labels ?? [],
        centroids: tm?.clusterCentroids ?? [],
        vocab: tm?.clusterVocab ?? [],
        idfWeights: tm?.clusterIdfWeights ?? [],
      }
    })

  const imageClusterModels = modelState.modelBlocks
    .filter(b => keep(b.id) && b.modelType === 'image-unsupervised' && b.trainedModelId)
    .map(mb => {
      const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
      return {
        id: mb.id,
        name: mb.name,
        labels: tm?.labels ?? [],
        centroids: tm?.clusterCentroids ?? [],
      }
    })

  const data = {
    sensors: rule.sensorBlocks.filter(s => keep(s.id)).map(s => ({
      id: s.id, name: s.name, sensorType: s.sensorType,
      value: s.value, min: s.min ?? 0, max: s.max ?? 100, unit: s.unit ?? '',
    })),
    switches: rule.switchBlocks.filter(s => keep(s.id)).map(s => ({
      id: s.id, name: s.name, isOn: s.isOn,
    })),
    conditions: rule.conditionBlocks.filter(c => keep(c.id)).map(c => ({
      id: c.id, name: c.name,
      linkedSensorId: c.linkedSensorId,
      operator: c.operator, threshold: c.threshold,
      linkedModelId: c.linkedModelId ?? null,
      modelCondition: c.modelCondition ?? null,
    })),
    logic: rule.logicBlocks.filter(l => keep(l.id)).map(l => ({
      id: l.id, logicType: l.logicType,
      inputs: [l.linkedInputIds[0] ?? null, l.linkedInputIds[1] ?? null],
    })),
    fans:   rule.fanBlocks.filter(f => keep(f.id)).map(f => ({ id: f.id, name: f.name, linkedRuleBlockId: f.linkedRuleBlockId })),
    alarms: rule.alarmBlocks.filter(a => keep(a.id)).map(a => ({ id: a.id, name: a.name, linkedRuleBlockId: a.linkedRuleBlockId })),
    acs:    rule.acBlocks.filter(a => keep(a.id)).map(a => ({ id: a.id, name: a.name, linkedRuleBlockId: a.linkedRuleBlockId })),
    bulbs:  workflow.bulbBlocks.filter(b => keep(b.id)).map(b => ({ id: b.id, name: b.name, linkedRuleBlockId: b.linkedRuleBlockId })),
    doors:  workflow.doorBlocks.filter(d => keep(d.id)).map(d => ({ id: d.id, name: d.name, linkedRuleBlockId: d.linkedRuleBlockId })),
    timers: rule.timerBlocks.filter(t => keep(t.id)).map(t => ({
      id: t.id, name: t.name,
      timerMode: t.timerMode ?? 'duration',
      totalSeconds: t.durationMinutes * 60 + t.durationSeconds,
      linkedRuleBlockId: t.linkedRuleBlockId,
    })),
    models,
    imageModels,
    textClusterModels,
    imageClusterModels,
  }

  const defaultInputIds = [
    ...data.sensors.map((s: {id:string}) => s.id),
    ...data.switches.map((s: {id:string}) => s.id),
    ...data.timers.map((t: {id:string}) => t.id),
    ...data.models.map((m: {id:string}) => m.id),
    ...data.textClusterModels.map((m: {id:string}) => m.id),
    ...data.imageModels.map((m: {id:string}) => m.id),
    ...data.imageClusterModels.map((m: {id:string}) => m.id),
  ]
  const defaultOutputIds = [
    ...data.bulbs.map((b: {id:string}) => b.id),
    ...data.fans.map((f: {id:string}) => f.id),
    ...data.doors.map((d: {id:string}) => d.id),
    ...data.alarms.map((a: {id:string}) => a.id),
    ...data.acs.map((a: {id:string}) => a.id),
  ]
  const inputIdSet = new Set(defaultInputIds)
  const outputIdSet = new Set(defaultOutputIds)
  const resolvedInputOrder = [
    ...cardOrder.filter(id => inputIdSet.has(id)),
    ...defaultInputIds.filter(id => !cardOrder.includes(id)),
  ]
  const resolvedOutputOrder = [
    ...cardOrder.filter(id => outputIdSet.has(id)),
    ...defaultOutputIds.filter(id => !cardOrder.includes(id)),
  ]

  const html = buildHTML(appName, data, THEMES[theme], layout, creatorName, instructions, resolvedInputOrder, resolvedOutputOrder)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${appName.replace(/\s+/g, '-').toLowerCase()}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildHTML(appName: string, data: object, t: typeof THEMES[Theme], layout: Layout, creatorName: string, instructions = '', inputOrder: string[] = [], outputOrder: string[] = []): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeCreator = creatorName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeInstructions = instructions.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const dataJson = JSON.stringify(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${safeTitle}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="${t.acc}">
<style>
:root{--bg1:${t.bg1};--bg2:${t.bg2};--acc:${t.acc};--acc2:${t.acc2};--orb1:${t.orb1};--orb2:${t.orb2}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,var(--bg1) 0%,var(--bg2) 100%);color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;position:relative}
body::before{content:'';position:fixed;width:500px;height:500px;top:-150px;left:-150px;background:radial-gradient(circle,var(--orb1),transparent 70%);border-radius:50%;animation:float 8s ease-in-out infinite;pointer-events:none;z-index:0}
body::after{content:'';position:fixed;width:420px;height:420px;bottom:-100px;right:-100px;background:radial-gradient(circle,var(--orb2),transparent 70%);border-radius:50%;animation:float 10s ease-in-out infinite reverse;pointer-events:none;z-index:0}
.pt{position:fixed;pointer-events:none;animation:star-twinkle var(--dur) ease-in-out infinite;animation-delay:var(--dly);opacity:0.1;z-index:0}
header{background:rgba(18,14,42,0.9);border-bottom:1px solid rgba(255,255,255,0.07);padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);position:relative;z-index:10}
.h-left{display:flex;align-items:center;gap:1rem}
.h-icon{font-size:2rem;line-height:1}
.h-title{font-size:1.4rem;font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite}
.h-sub{font-size:0.7rem;color:rgba(255,255,255,0.28);margin-top:0.125rem}
.abita-badge{font-size:0.62rem;font-weight:800;color:rgba(167,139,250,0.75);border:1px solid rgba(167,139,250,0.2);padding:0.3rem 0.75rem;border-radius:9999px;letter-spacing:0.07em;background:rgba(139,92,246,0.07)}
main{flex:1;display:grid;grid-template-columns:1fr 1px 1fr;padding:2rem;max-width:1040px;margin:0 auto;width:100%;position:relative;z-index:1}
@media(max-width:680px){main{grid-template-columns:1fr;padding:1.25rem}.div-line{display:none}.out-panel{border-top:1px solid rgba(255,255,255,0.06);padding-top:1.5rem;margin-top:0.5rem}}
.in-panel{padding-right:2rem;display:flex;flex-direction:column;gap:1rem}
.out-panel{padding-left:2rem;display:flex;flex-direction:column;gap:0.875rem}
.panel-lbl{font-size:0.63rem;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:rgba(255,255,255,0.2);margin-bottom:0.375rem}
.div-line{background:linear-gradient(to bottom,transparent,var(--orb1),var(--orb2),transparent);width:1px;margin:1.5rem 0}
#output-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:0.875rem}
main.layout-dashboard{display:flex;flex-direction:column;gap:1.25rem;max-width:1040px}
main.layout-dashboard .in-panel{flex-direction:row;flex-wrap:nowrap;overflow-x:auto;padding-right:0;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.06);gap:0.875rem;align-items:flex-start}
main.layout-dashboard .in-panel .in-card{flex:0 0 210px}
main.layout-dashboard .div-line{display:none}
main.layout-dashboard .out-panel{padding-left:0}
main.layout-dashboard #output-cards{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
main.layout-dashboard .out-card{min-height:220px}
main.layout-mobile{display:flex;flex-direction:column;max-width:480px;gap:1.25rem}
main.layout-mobile .div-line{display:none}
main.layout-mobile .in-panel,main.layout-mobile .out-panel{padding:0}
main.layout-mobile #output-cards{grid-template-columns:repeat(2,1fr)}
main.layout-mobile .out-card{min-height:190px}
.in-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:1rem;padding:1.125rem;display:flex;flex-direction:column;gap:0.75rem;transition:border-color 0.3s}
.in-card:hover{border-color:rgba(255,255,255,0.18)}
.in-mdl-ta{width:100%;min-height:3.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:0.5rem;padding:0.5rem 0.65rem;color:#fff;font-size:0.82rem;font-family:inherit;resize:vertical;outline:none;transition:border-color 0.2s}
.in-mdl-ta:focus{border-color:rgba(255,255,255,0.28)}
.in-mdl-ta::placeholder{color:rgba(255,255,255,0.22)}
.img-cam-wrap{position:relative;width:100%;border-radius:0.75rem;overflow:hidden;background:#000;aspect-ratio:4/3}
.img-cam-wrap video{width:100%;height:100%;object-fit:cover;display:block}
.img-cam-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);font-size:0.78rem;color:rgba(255,255,255,0.55);text-align:center;padding:0.75rem}
.img-cam-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;background:#111}
.img-cam-actions{display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.125rem}
.img-cam-btn{padding:0.4rem 0.875rem;border-radius:0.5rem;border:none;background:linear-gradient(90deg,var(--acc),var(--acc2));color:#fff;font-size:0.78rem;font-weight:700;font-family:inherit;cursor:pointer}
.img-upload-lbl{padding:0.4rem 0.875rem;border-radius:0.5rem;border:1.5px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);font-size:0.78rem;font-weight:700;font-family:inherit;cursor:pointer}
.img-pred-display{font-size:0.95rem;font-weight:700;text-align:center;padding:0.2rem 0;color:#fff;min-height:1.4rem}
.img-model-hint{font-size:0.68rem;color:rgba(255,255,255,0.28);text-align:center}
.in-lbl{font-size:0.77rem;font-weight:700;color:rgba(255,255,255,0.48);display:flex;align-items:center;gap:0.4rem}
.slider-wrap{display:flex;flex-direction:column;gap:0.5rem}
.slider-num-row{display:flex;align-items:baseline;gap:0.3rem}
.slider-num{font-size:1.8rem;font-weight:800;color:#fff;line-height:1;font-variant-numeric:tabular-nums;transition:color 0.2s}
.slider-unit{font-size:0.78rem;font-weight:600;color:rgba(255,255,255,0.32)}
input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:9999px;background:linear-gradient(to right,var(--acc) var(--pct,0%),rgba(255,255,255,0.1) var(--pct,0%));outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc2));cursor:pointer;box-shadow:0 0 10px rgba(255,255,255,0.2);transition:transform 0.1s}
input[type=range]:active::-webkit-slider-thumb{transform:scale(1.2)}
.slider-range{display:flex;justify-content:space-between;font-size:0.63rem;color:rgba(255,255,255,0.16)}
.ios-sw{display:flex;align-items:center;gap:0.875rem;cursor:pointer;-webkit-user-select:none;user-select:none}
.sw-track{width:52px;height:28px;border-radius:14px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);position:relative;transition:background 0.3s,border-color 0.3s;flex-shrink:0}
.sw-track .sw-thumb{position:absolute;left:3px;top:3px;width:22px;height:22px;background:#e2e8f0;border-radius:50%;transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 2px 6px rgba(0,0,0,0.4)}
.sw-track.active{background:linear-gradient(90deg,var(--acc),var(--acc2));border-color:transparent}
.sw-track.active .sw-thumb{transform:translateX(24px)}
.sw-lbl{font-size:0.88rem;font-weight:700;transition:color 0.2s}
.txt-inp{width:100%;padding:0.6rem 0.875rem;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:0.6rem;color:#fff;font-size:0.9rem;outline:none;transition:border-color 0.2s,box-shadow 0.2s}
.txt-inp:focus{border-color:rgba(255,255,255,0.3);box-shadow:0 0 0 3px rgba(255,255,255,0.07)}
.txt-inp::placeholder{color:rgba(255,255,255,0.17)}
.out-card{background:rgba(255,255,255,0.025);border:1.5px solid rgba(255,255,255,0.06);border-radius:1.25rem;padding:1.25rem 1rem 1rem;display:flex;flex-direction:column;align-items:center;gap:0.875rem;min-height:185px;transition:background 0.4s,border-color 0.4s,box-shadow 0.4s;position:relative;overflow:hidden}
.out-card.on{background:rgba(255,255,255,0.05);box-shadow:0 4px 28px rgba(255,255,255,0.04)}
.out-visual{flex:1;display:flex;align-items:center;justify-content:center;width:100%;position:relative;overflow:hidden}
.out-footer{display:flex;align-items:center;justify-content:space-between;width:100%}
.out-name{font-size:0.73rem;font-weight:700;color:rgba(255,255,255,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58%}
.status-pill{font-size:0.58rem;font-weight:800;letter-spacing:0.06em;padding:0.2rem 0.55rem;border-radius:9999px;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.07);transition:all 0.35s;white-space:nowrap}
.bulb-glow{position:absolute;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,rgba(253,230,138,0.38),transparent 65%);transform:scale(0);opacity:0;transition:transform 0.6s ease,opacity 0.6s ease;pointer-events:none}
.bulb-card.on .bulb-glow{transform:scale(1.1);opacity:1;animation:glow-pulse 1.8s ease-in-out infinite}
.bulb-svg{position:relative;z-index:1}
.b-glass{fill:#1e1e3a;transition:fill 0.5s,filter 0.5s}
.b-fil{stroke:#2a2a4e;stroke-width:2;fill:none;transition:stroke 0.5s}
.b-base{fill:#242440;transition:fill 0.4s}
.bulb-card.on .b-glass{fill:#fde68a;filter:drop-shadow(0 0 10px rgba(251,191,36,0.9))}
.bulb-card.on .b-fil{stroke:#fffde0}
.bulb-card.on .status-pill{background:rgba(251,191,36,0.15);color:#fbbf24;border-color:rgba(251,191,36,0.28)}
.fan-aura{position:absolute;width:82px;height:82px;border-radius:50%;border:2px solid rgba(45,212,191,0);transition:border-color 0.5s,box-shadow 0.5s}
.fan-card.on .fan-aura{border-color:rgba(45,212,191,0.15);box-shadow:0 0 22px rgba(45,212,191,0.07)}
.fan-svg{position:relative;z-index:1}
.fan-rotor{transition:opacity 0.3s}
.f-blade{fill:#28284a;transition:fill 0.4s}
.f-hub{fill:#303050;transition:fill 0.3s}
.fan-card.on .fan-rotor{animation:fan-spin 0.75s linear infinite;transform-box:fill-box;transform-origin:center}
.fan-card.on .f-blade{fill:#2dd4bf}
.fan-card.on .f-hub{fill:#38a89d}
.fan-card.on .status-pill{background:rgba(45,212,191,0.15);color:#2dd4bf;border-color:rgba(45,212,191,0.28)}
.door-scene{perspective:360px;width:76px;height:108px}
.door-frame{width:100%;height:100%;background:#09091f;border:3px solid #20204a;border-radius:4px 4px 0 0;position:relative;transform-style:preserve-3d}
.door-panel{position:absolute;inset:0;background:linear-gradient(150deg,#38285e,#1a0e3e);transform-origin:left center;transition:transform 0.85s cubic-bezier(0.25,0.46,0.45,0.94);border-radius:3px 3px 0 0}
.door-panel.open{transform:rotateY(-70deg)}
.door-hdl{position:absolute;right:9px;top:50%;width:4px;height:14px;background:#fbbf24;border-radius:2px;transform:translateY(-50%);box-shadow:0 0 6px rgba(251,191,36,0.5)}
.door-floor{position:absolute;bottom:-4px;left:-4px;right:-4px;height:5px;background:#16163a;border-radius:0 0 4px 4px}
.door-card.on .door-frame{border-color:#38386a}
.door-card.on .status-pill{background:rgba(52,211,153,0.15);color:#34d399;border-color:rgba(52,211,153,0.28)}
.alarm-ring{position:absolute;width:54px;height:54px;border-radius:50%;border:2px solid rgba(239,68,68,0.55);opacity:0}
.alarm-card.on .alarm-ring:nth-child(1){animation:alarm-ring 1.2s ease-out infinite 0s}
.alarm-card.on .alarm-ring:nth-child(2){animation:alarm-ring 1.2s ease-out infinite 0.4s}
.alarm-card.on .alarm-ring:nth-child(3){animation:alarm-ring 1.2s ease-out infinite 0.8s}
.alarm-siren{width:54px;height:54px;border-radius:50%;background:rgba(38,18,38,0.85);border:2px solid #261826;display:flex;align-items:center;justify-content:center;font-size:1.5rem;position:relative;z-index:1;transition:background 0.3s,border-color 0.3s,box-shadow 0.3s}
.alarm-card.on .alarm-siren{background:rgba(239,68,68,0.18);border-color:rgba(239,68,68,0.45);box-shadow:0 0 24px rgba(239,68,68,0.22)}
.alarm-card.on{animation:alarm-flash 0.55s ease-in-out infinite alternate}
.alarm-card.on .status-pill{background:rgba(239,68,68,0.15);color:#f87171;border-color:rgba(239,68,68,0.28)}
.flake{position:absolute;font-size:0.7rem;color:#93c5fd;animation:flake-rise 2.2s ease-in infinite;bottom:36px}
.flake:nth-child(1){left:8%;animation-delay:0s}
.flake:nth-child(2){left:26%;animation-delay:0.44s}
.flake:nth-child(3){left:46%;animation-delay:0.88s}
.flake:nth-child(4){left:66%;animation-delay:1.32s}
.flake:nth-child(5){left:84%;animation-delay:1.76s}
.ac-card:not(.on) .flake{opacity:0;animation-play-state:paused}
.ac-card.on .flake{opacity:0.85}
.ac-body{width:88px;height:48px;background:linear-gradient(180deg,#232340,#161628);border:2px solid #2c2c4e;border-radius:8px;position:relative;overflow:hidden;transition:border-color 0.3s}
.ac-grille{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent,transparent 7px,rgba(255,255,255,0.04) 7px,rgba(255,255,255,0.04) 8px);border-radius:6px}
.ac-vent{position:absolute;bottom:0;left:0;right:0;height:14px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;gap:4px;padding:0 8px}
.ac-slot{width:5px;height:5px;background:#343450;border-radius:1px;transition:background 0.3s}
.ac-led{position:absolute;top:7px;right:9px;width:5px;height:5px;border-radius:50%;background:#343450;transition:background 0.3s,box-shadow 0.3s}
.ac-card.on .ac-led{background:#2dd4bf;box-shadow:0 0 7px rgba(45,212,191,0.85)}
.ac-card.on .ac-body{border-color:rgba(147,197,253,0.32)}
.ac-card.on .ac-slot{background:#243a52}
.ac-card.on .status-pill{background:rgba(147,197,253,0.15);color:#93c5fd;border-color:rgba(147,197,253,0.28)}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes star-twinkle{0%,100%{opacity:0.07}50%{opacity:var(--bright,0.55)}}
@keyframes glow-pulse{0%,100%{opacity:0.75;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
@keyframes fan-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes alarm-ring{from{transform:scale(0.5);opacity:0.8}to{transform:scale(2.5);opacity:0}}
@keyframes alarm-flash{from{background:rgba(239,68,68,0.02)}to{background:rgba(239,68,68,0.1)}}
@keyframes flake-rise{0%{transform:translateY(0) rotate(0deg);opacity:0.85}100%{transform:translateY(-56px) rotate(180deg);opacity:0}}
footer{text-align:center;padding:0.875rem;font-size:0.67rem;color:rgba(255,255,255,0.13);border-top:1px solid rgba(255,255,255,0.05);position:relative;z-index:1}
.empty-hint{color:rgba(255,255,255,0.18);font-size:0.82rem;font-style:italic;padding:1.5rem 0;text-align:center}
.splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;background:linear-gradient(135deg,var(--bg1),var(--bg2));transition:opacity 0.6s ease;pointer-events:auto}
.splash.hide{opacity:0;pointer-events:none}
.splash-icon{font-size:4rem;animation:spl-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both}
.splash-title{font-size:2rem;font-weight:900;text-align:center;max-width:80vw;line-height:1.15;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite,spl-in 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both}
.splash-by{font-size:0.85rem;color:rgba(255,255,255,0.45);animation:spl-in 0.5s ease 0.55s both}
.splash-badge{font-size:0.65rem;font-weight:800;color:rgba(167,139,250,0.8);border:1px solid rgba(167,139,250,0.25);padding:0.3rem 0.8rem;border-radius:9999px;background:rgba(139,92,246,0.08);animation:spl-in 0.5s ease 0.75s both}
.splash-skip{position:absolute;top:1rem;right:1rem;font-size:0.7rem;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:inherit;transition:color 0.2s}
.splash-skip:hover{color:rgba(255,255,255,0.6)}
@keyframes spl-in{from{opacity:0;transform:scale(0.7) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
.toast-wrap{position:fixed;top:1rem;right:1rem;z-index:9998;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:240px}
.toast{background:rgba(18,14,42,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.55rem 1rem;font-size:0.78rem;font-weight:600;color:#fff;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);opacity:0;transform:translateX(110%);transition:opacity 0.3s,transform 0.3s;pointer-events:none}
.toast.show{opacity:1;transform:translateX(0)}
.snd-btn{background:none;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;color:rgba(255,255,255,0.4);font-size:0.8rem;padding:0.25rem 0.5rem;cursor:pointer;transition:all 0.2s;font-family:inherit}
.snd-btn:hover{border-color:rgba(255,255,255,0.3);color:rgba(255,255,255,0.8)}
@keyframes card-in{from{opacity:0;transform:scale(0.85) translateY(14px)}to{opacity:1;transform:scale(1) translateY(0)}}
#app-instructions{display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 2rem;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.07);position:relative;z-index:2}
.instr-icon{font-size:1.15rem;flex-shrink:0;opacity:.75;margin-top:.1rem}
.instr-title{font-size:0.63rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.3);margin-bottom:.2rem}
.instr-text{font-size:0.82rem;line-height:1.5;color:rgba(255,255,255,0.7);white-space:pre-wrap}
</style>
</head>
<body>
<div class="splash" id="splash">
  <button class="splash-skip" onclick="hideSplash()">Skip ›</button>
  <span class="splash-icon">🤖</span>
  <div class="splash-title">${safeTitle}</div>
  ${safeCreator ? `<div class="splash-by">An app by ${safeCreator}</div>` : ''}
  <div class="splash-badge">⚡ Made with ABITA</div>
</div>
<div class="toast-wrap" id="toasts"></div>
<header>
  <div class="h-left">
    <span class="h-icon">🤖</span>
    <div>
      <div class="h-title">${safeTitle}</div>
      <div class="h-sub">AI Sandbox for Kids</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:0.5rem">
    <button class="snd-btn" id="snd-toggle" onclick="toggleSound()" title="Toggle sounds">🔊</button>
    <span class="abita-badge">⚡ ABITA</span>
  </div>
</header>
${safeInstructions ? `<section id="app-instructions"><span class="instr-icon">📋</span><div class="instr-body"><p class="instr-title">How this app works</p><p class="instr-text">${safeInstructions}</p></div></section>` : ''}
<main class="layout-${layout}">
  <div class="in-panel">
    <div class="panel-lbl">⬇ Inputs</div>
    <div id="input-cards"></div>
  </div>
  <div class="div-line"></div>
  <div class="out-panel">
    <div class="panel-lbl">⬆ Outputs</div>
    <div id="output-cards"></div>
  </div>
</main>
<footer>${safeCreator ? `An app by ${safeCreator} · ` : ''}Built with ABITA · AI Sandbox for Kids</footer>
<script>
function hideSplash(){var s=document.getElementById('splash');if(!s)return;s.classList.add('hide');setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s);},650);}
setTimeout(hideSplash,2500);
function showToast(msg){var w=document.getElementById('toasts');if(!w)return;var t=document.createElement('div');t.className='toast';t.textContent=msg;w.appendChild(t);requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show');});});setTimeout(function(){t.classList.remove('show');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},400);},2800);}
var _soundOn=true,_actx=null;
function toggleSound(){_soundOn=!_soundOn;var b=document.getElementById('snd-toggle');if(b)b.textContent=_soundOn?'🔊':'🔇';}
function _getCtx(){if(!_actx){try{_actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return _actx;}
function _blip(freq,dur,type){var c=_getCtx();if(!c||!_soundOn)return;var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type||'sine';o.frequency.value=freq;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(0.15,c.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start();o.stop(c.currentTime+dur);}
function _sweep(f1,f2,dur){var c=_getCtx();if(!c||!_soundOn)return;var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(f1,c.currentTime);o.frequency.linearRampToValueAtTime(f2,c.currentTime+dur);g.gain.setValueAtTime(0.13,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start();o.stop(c.currentTime+dur);}
var _fanNode=null;
function _startFan(){var c=_getCtx();if(!c||!_soundOn||_fanNode)return;var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type='sawtooth';o.frequency.value=65;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(0.05,c.currentTime+0.4);o.start();_fanNode={o:o,g:g};}
function _stopFan(){if(!_fanNode)return;var c=_getCtx();if(c){try{_fanNode.g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.5);}catch(e){}}var fn=_fanNode;_fanNode=null;setTimeout(function(){try{fn.o.stop();}catch(e){}},600);}
function playDeviceSound(type,on){if(!_soundOn)return;if(type==='bulb'){on?_blip(900,0.12):_blip(500,0.08);}else if(type==='fan'){on?_startFan():_stopFan();}else if(type==='alarm'&&on){_blip(880,0.12,'square');setTimeout(function(){_blip(880,0.12,'square');},200);setTimeout(function(){_blip(1100,0.12,'square');},400);}else if(type==='door'){on?_sweep(200,800,0.3):_sweep(800,200,0.3);}else if(type==='ac'&&on){_blip(300,0.4,'sawtooth');}}
var _appReady=false;
const APP = ${dataJson};

const state = {
  sensors:    APP.sensors.map(function(s){return Object.assign({},s)}),
  switches:   APP.switches.map(function(s){return Object.assign({},s)}),
  conditions: APP.conditions.map(function(c){return Object.assign({},c,{_out:false})}),
  logic:      APP.logic.map(function(l){return Object.assign({},l,{_out:false})}),
  fans:   APP.fans.map(function(x){return Object.assign({},x,{_on:false})}),
  alarms: APP.alarms.map(function(x){return Object.assign({},x,{_on:false})}),
  acs:    APP.acs.map(function(x){return Object.assign({},x,{_on:false})}),
  bulbs:  APP.bulbs.map(function(x){return Object.assign({},x,{_on:false})}),
  doors:  APP.doors.map(function(x){return Object.assign({},x,{_open:false})}),
  timers: APP.timers.map(function(x){return Object.assign({},x,{_remaining:null,_on:false,_lastInput:false})}),
};

// ── Image-model inference ───────────────────────────────────────────────────
var _imgPredictions={};
var _pendingFiles={};
var _mobileNet=null;
if((APP.imageModels&&APP.imageModels.length)||(APP.imageClusterModels&&APP.imageClusterModels.length)){
  function _loadScript(src,cb){var s=document.createElement('script');s.src=src;s.onload=cb;document.head.appendChild(s);}
  _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js',function(){
    _loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js',function(){
      mobilenet.load({version:2,alpha:0.5}).then(function(net){
        _mobileNet=net;
        APP.imageModels.forEach(function(im){
          var ov=document.getElementById('imgov-'+im.id);
          if(ov) ov.textContent='📷 Click Start Camera to begin';
        });
      }).catch(function(){
        APP.imageModels.forEach(function(im){
          var ov=document.getElementById('imgov-'+im.id);
          if(ov) ov.textContent='⚠ AI failed to load — check internet';
        });
      });
    });
  });
  function _sqD(a,b){var s=0;for(var i=0;i<a.length;i++)s+=(a[i]-b[i])*(a[i]-b[i]);return s;}
  function _knn(vec,knnData,labels,labelIds,k){
    var all=[];
    for(var li=0;li<labelIds.length;li++){
      var d=knnData[labelIds[li]];
      if(!d||!d.values||!d.shape) continue;
      var n=d.shape[0],dim=d.shape[1];
      for(var ei=0;ei<n;ei++) all.push({label:labels[li],dist:_sqD(vec,d.values.slice(ei*dim,(ei+1)*dim))});
    }
    if(!all.length) return null;
    all.sort(function(a,b){return a.dist-b.dist;});
    var top=all.slice(0,Math.min(k,all.length)),weights={};
    labels.forEach(function(l){weights[l]=0;});
    top.forEach(function(x){weights[x.label]+=1/(x.dist+1e-6);});
    var best=labels[0],bestW=-1;
    for(var lab in weights){if(weights[lab]>bestW){bestW=weights[lab];best=lab;}}
    return best;
  }
  function _inferCanvas(im,canEl,cb){
    var t=tf.browser.fromPixels(canEl),feat=_mobileNet.infer(t,true);
    t.dispose();
    feat.data().then(function(data){feat.dispose();cb(_knn(Array.from(data),im.knnData,im.labels,im.labelIds,5));});
  }
  function startImgCam(modelId){
    var vid=document.getElementById('imgcam-'+modelId);
    var ov=document.getElementById('imgov-'+modelId);
    var prev=document.getElementById('imgprev-'+modelId);
    if(!vid) return;
    if(prev) prev.style.display='none';
    vid.style.display='block';
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
      .then(function(s){vid.srcObject=s;if(ov)ov.style.display='none';})
      .catch(function(){
        navigator.mediaDevices.getUserMedia({video:true})
          .then(function(s){vid.srcObject=s;if(ov)ov.style.display='none';})
          .catch(function(){if(ov){ov.style.display='flex';ov.textContent='⚠ Camera blocked — upload a photo';}});
      });
  }
  function uploadImgModel(modelId,file){
    var im=APP.imageModels.find(function(m){return m.id===modelId;});
    if(!im||!_mobileNet){showToast('AI engine still loading — please wait');return;}
    var vid=document.getElementById('imgcam-'+modelId);
    var ov=document.getElementById('imgov-'+modelId);
    var prev=document.getElementById('imgprev-'+modelId);
    var canEl=document.getElementById('imgcap-'+modelId);
    var predEl=document.getElementById('imgpred-'+modelId);
    if(prev&&prev._url) URL.revokeObjectURL(prev._url);
    var url=URL.createObjectURL(file);
    if(prev){prev._url=url;prev.src=url;prev.style.display='block';}
    if(vid) vid.style.display='none';
    if(ov) ov.style.display='none';
    var img=new Image();
    img.onload=function(){
      canEl.width=224;canEl.height=224;
      canEl.getContext('2d').drawImage(img,0,0,224,224);
      _inferCanvas(im,canEl,function(label){
        _imgPredictions[modelId]=label;
        if(predEl) predEl.textContent=label?'🎯 '+label:'Could not classify';
        evaluate();updateOutputs();
      });
    };
    img.src=url;
  }
  setInterval(function(){
    if(!_mobileNet) return;
    APP.imageModels.forEach(function(im){
      var vid=document.getElementById('imgcam-'+im.id);
      if(!vid||!vid.srcObject||vid.readyState<2) return;
      var canEl=document.getElementById('imgcap-'+im.id);
      canEl.width=224;canEl.height=224;
      canEl.getContext('2d').drawImage(vid,0,0,224,224);
      _inferCanvas(im,canEl,function(label){
        if(label!==_imgPredictions[im.id]){
          _imgPredictions[im.id]=label;
          var predEl=document.getElementById('imgpred-'+im.id);
          if(predEl) predEl.textContent=label?'🎯 '+label:'…';
          evaluate();updateOutputs();
        }
      });
    });
    if(APP.imageClusterModels) APP.imageClusterModels.forEach(function(icm){
      var vid=document.getElementById('imgcam-'+icm.id);
      if(!vid||!vid.srcObject||vid.readyState<2) return;
      var canEl=document.getElementById('imgcap-'+icm.id);
      canEl.width=224;canEl.height=224;
      canEl.getContext('2d').drawImage(vid,0,0,224,224);
      var t=tf.browser.fromPixels(canEl),feat=_mobileNet.infer(t,true);
      t.dispose();
      feat.data().then(function(data){
        feat.dispose();
        var label=_nearestCentroid(Array.from(data),icm.centroids,icm.labels);
        if(label!==_imgPredictions[icm.id]){
          _imgPredictions[icm.id]=label;
          var predEl=document.getElementById('imgpred-'+icm.id);
          if(predEl) predEl.textContent=label?'🎯 '+label:'…';
          evaluate();updateOutputs();
        }
      });
    });
  },1000);
  function uploadImgCluster(modelId,file){
    var icm=APP.imageClusterModels.find(function(m){return m.id===modelId;});
    if(!icm||!_mobileNet){showToast('AI engine still loading — please wait');return;}
    var vid=document.getElementById('imgcam-'+modelId);
    var ov=document.getElementById('imgov-'+modelId);
    var prev=document.getElementById('imgprev-'+modelId);
    var canEl=document.getElementById('imgcap-'+modelId);
    var predEl=document.getElementById('imgpred-'+modelId);
    if(prev&&prev._url) URL.revokeObjectURL(prev._url);
    var url=URL.createObjectURL(file);
    if(prev){prev._url=url;prev.src=url;prev.style.display='block';}
    if(vid) vid.style.display='none';
    if(ov) ov.style.display='none';
    var img=new Image();
    img.onload=function(){
      canEl.width=224;canEl.height=224;
      canEl.getContext('2d').drawImage(img,0,0,224,224);
      var t=tf.browser.fromPixels(canEl),feat=_mobileNet.infer(t,true);
      t.dispose();
      feat.data().then(function(data){
        feat.dispose();
        var label=_nearestCentroid(Array.from(data),icm.centroids,icm.labels);
        _imgPredictions[modelId]=label;
        if(predEl) predEl.textContent=label?'🎯 '+label:'Could not classify';
        evaluate();updateOutputs();
      });
    };
    img.src=url;
  }
}

function _nearestCentroid(vec,centroids,labels){
  var best=-1,bestD=Infinity;
  for(var i=0;i<centroids.length;i++){var d=_sqD(vec,centroids[i]);if(d<bestD){bestD=d;best=i;}}
  return best>=0?(labels[best]||null):null;
}
function _clusterTextPredict(tcm,text){
  if(!tcm.vocab||!tcm.vocab.length||!tcm.centroids||!tcm.centroids.length) return null;
  var tokens=tokenizeNB(text);
  if(!tokens.length) return null;
  var tf={};
  tokens.forEach(function(t){tf[t]=(tf[t]||0)+1;});
  var vec=tcm.vocab.map(function(w,i){return (tf[w]||0)*(tcm.idfWeights[i]||0);});
  var norm=Math.sqrt(vec.reduce(function(s,v){return s+v*v;},0));
  if(norm>0) vec=vec.map(function(v){return v/norm;});
  return _nearestCentroid(vec,tcm.centroids,tcm.labels);
}

function evalCond(v,op,t){
  switch(op){
    case '>':  return Number(v)>Number(t);
    case '<':  return Number(v)<Number(t);
    case '>=': return Number(v)>=Number(t);
    case '<=': return Number(v)<=Number(t);
    case '==': return String(v)===String(t);
    case '!=': return String(v)!==String(t);
    case 'contains': return String(v).toLowerCase().includes(String(t).toLowerCase());
    case 'is': return v===t;
    default:   return false;
  }
}
function tokenizeNB(t){
  return t.toLowerCase().replace(/[^a-z0-9\\s]/g,' ').split(/\\s+/).filter(function(w){return w.length>1;});
}
function runNB(modelId,text){
  var m=APP.models.find(function(m){return m.id===modelId;});
  if(!m||!m.vocab.length) return null;
  var tokens=tokenizeNB(text);
  if(!tokens.length) return null;
  var vi={};
  m.vocab.forEach(function(w,i){vi[w]=i;});
  var best=m.labels[0]||null,bestS=-Infinity;
  for(var li=0;li<m.labels.length;li++){
    var lid=m.labelIds[li];
    var s=(m.classLogPriors[lid]||0);
    for(var ti=0;ti<tokens.length;ti++){
      var idx=vi[tokens[ti]];
      if(idx!==undefined&&m.wordLogProbs[lid]) s+=m.wordLogProbs[lid][idx];
    }
    if(s>bestS){bestS=s;best=m.labels[li];}
  }
  return best;
}
function getOut(id){
  if(!id) return false;
  var c=state.conditions.find(function(x){return x.id===id}); if(c) return c._out;
  var s=state.switches.find(function(x){return x.id===id});   if(s) return s.isOn;
  var l=state.logic.find(function(x){return x.id===id});      if(l) return l._out;
  var tm=state.timers.find(function(x){return x.id===id});    if(tm) return tm._on;
  return false;
}
function evaluate(){
  for(var i=0;i<state.conditions.length;i++){
    var c=state.conditions[i];
    if(c.linkedModelId){
      var icm=APP.imageClusterModels&&APP.imageClusterModels.find(function(m){return m.id===c.linkedModelId;});
      if(icm){
        c._out=(_imgPredictions[c.linkedModelId]||null)===c.modelCondition;
      }else{
        var tcm=APP.textClusterModels&&APP.textClusterModels.find(function(m){return m.id===c.linkedModelId;});
        if(tcm){
          var tsinput=tcm.liveSensorId?document.getElementById('sv-'+tcm.liveSensorId):document.getElementById('sv-mdl-'+tcm.id);
          var ttext=tsinput?(tsinput.value||''):'';
          c._out=_clusterTextPredict(tcm,ttext)===c.modelCondition;
        }else{
          var im=APP.imageModels&&APP.imageModels.find(function(m){return m.id===c.linkedModelId;});
          if(im){
            c._out=(_imgPredictions[c.linkedModelId]||null)===c.modelCondition;
          }else{
            var m=APP.models.find(function(m){return m.id===c.linkedModelId;});
            var sinput=m&&m.liveSensorId?document.getElementById('sv-'+m.liveSensorId):document.getElementById('sv-mdl-'+c.linkedModelId);
            var text=sinput?(sinput.value||''):'';
            c._out=runNB(c.linkedModelId,text)===c.modelCondition;
          }
        }
      }
    } else {
      var sen=state.sensors.find(function(s){return s.id===c.linkedSensorId});
      c._out=sen?evalCond(sen.value,c.operator,c.threshold):false;
    }
  }
  for(var ti=0;ti<state.timers.length;ti++){
    var tm=state.timers[ti];
    var up=tm.linkedRuleBlockId?getOut(tm.linkedRuleBlockId):false;
    if(tm.timerMode==='delay-on'){
      if(up&&!tm._lastInput&&tm._remaining===null){ tm._remaining=tm.totalSeconds; }
      else if(!up){ tm._remaining=null; tm._on=false; }
    } else {
      if(up&&!tm._lastInput&&tm._remaining===null){ tm._remaining=tm.totalSeconds; tm._on=true; }
    }
    tm._lastInput=up;
  }
  for(var pass=0;pass<5;pass++){
    for(var j=0;j<state.logic.length;j++){
      var l=state.logic[j]; var a=l.inputs[0]; var b=l.inputs[1];
      if(l.logicType==='and')       l._out=(a&&b)?getOut(a)&&getOut(b):false;
      else if(l.logicType==='or')   l._out=a?getOut(a)||(b?getOut(b):false):false;
      else if(l.logicType==='not')  l._out=a?!getOut(a):true;
    }
  }
  for(var k=0;k<state.fans.length;k++)   state.fans[k]._on=state.fans[k].linkedRuleBlockId?getOut(state.fans[k].linkedRuleBlockId):false;
  for(var k=0;k<state.alarms.length;k++) state.alarms[k]._on=state.alarms[k].linkedRuleBlockId?getOut(state.alarms[k].linkedRuleBlockId):false;
  for(var k=0;k<state.acs.length;k++)    state.acs[k]._on=state.acs[k].linkedRuleBlockId?getOut(state.acs[k].linkedRuleBlockId):false;
  for(var k=0;k<state.bulbs.length;k++)  state.bulbs[k]._on=state.bulbs[k].linkedRuleBlockId?getOut(state.bulbs[k].linkedRuleBlockId):false;
  for(var k=0;k<state.doors.length;k++)  state.doors[k]._open=state.doors[k].linkedRuleBlockId?getOut(state.doors[k].linkedRuleBlockId):false;
}
function updateOutputs(){
  var wasOn;
  for(var i=0;i<state.bulbs.length;i++){
    var b=state.bulbs[i]; var el=document.getElementById('out-'+b.id); if(!el) continue;
    wasOn=el.classList.contains('on');
    el.className='out-card bulb-card'+(b._on?' on':'');
    document.getElementById('st-'+b.id).textContent=b._on?'● ON':'○ OFF';
    if(_appReady&&b._on!==wasOn){showToast((b._on?'💡 ':'🌑 ')+b.name+(b._on?' turned ON':' turned OFF'));playDeviceSound('bulb',b._on);}
  }
  for(var i=0;i<state.fans.length;i++){
    var f=state.fans[i]; var el=document.getElementById('out-'+f.id); if(!el) continue;
    wasOn=el.classList.contains('on');
    el.className='out-card fan-card'+(f._on?' on':'');
    document.getElementById('st-'+f.id).textContent=f._on?'● SPINNING':'○ OFF';
    if(_appReady&&f._on!==wasOn){showToast((f._on?'🌀 ':'💤 ')+f.name+(f._on?' turned ON':' turned OFF'));playDeviceSound('fan',f._on);}
  }
  for(var i=0;i<state.doors.length;i++){
    var d=state.doors[i]; var el=document.getElementById('out-'+d.id); if(!el) continue;
    wasOn=el.classList.contains('on');
    el.className='out-card door-card'+(d._open?' on':'');
    var dp=document.getElementById('dp-'+d.id); if(dp) dp.classList.toggle('open',d._open);
    document.getElementById('st-'+d.id).textContent=d._open?'● OPEN':'○ CLOSED';
    if(_appReady&&d._open!==wasOn){showToast((d._open?'🚪 ':'🔒 ')+d.name+(d._open?' opened':' closed'));playDeviceSound('door',d._open);}
  }
  for(var i=0;i<state.alarms.length;i++){
    var a=state.alarms[i]; var el=document.getElementById('out-'+a.id); if(!el) continue;
    wasOn=el.classList.contains('on');
    el.className='out-card alarm-card'+(a._on?' on':'');
    document.getElementById('st-'+a.id).textContent=a._on?'● ACTIVE':'○ OFF';
    if(_appReady&&a._on!==wasOn){showToast((a._on?'🚨 ':'🔕 ')+a.name+(a._on?' is ACTIVE':' turned off'));playDeviceSound('alarm',a._on);}
  }
  for(var i=0;i<state.acs.length;i++){
    var a=state.acs[i]; var el=document.getElementById('out-'+a.id); if(!el) continue;
    wasOn=el.classList.contains('on');
    el.className='out-card ac-card'+(a._on?' on':'');
    document.getElementById('st-'+a.id).textContent=a._on?'● COOLING':'○ OFF';
    if(_appReady&&a._on!==wasOn){showToast((a._on?'❄️ ':'🌫️ ')+a.name+(a._on?' is COOLING':' turned off'));playDeviceSound('ac',a._on);}
  }
}
function fmtTime(s){var m=Math.floor(s/60),sec=s%60;return m+':'+(sec<10?'0':'')+sec;}
function updateTimerDisplay(tm){
  var numEl=document.getElementById('tc-'+tm.id);
  var stEl=document.getElementById('ts-'+tm.id);
  if(!numEl||!stEl) return;
  if(tm._remaining!==null&&tm._remaining>0){
    numEl.textContent=fmtTime(tm._remaining); stEl.textContent='⏳ Running…';
  } else if(tm._on){
    numEl.textContent='0:00'; stEl.textContent='✅ Done';
  } else {
    numEl.textContent=fmtTime(tm.totalSeconds); stEl.textContent='⬛ Idle';
  }
}
function refresh(){
  evaluate(); updateOutputs();
  for(var i=0;i<state.timers.length;i++) updateTimerDisplay(state.timers[i]);
}

var PT_BG='${t.ptBg}',PT_W=${t.ptW},PT_H=${t.ptH},PT_RAD='${t.ptRad}';
(function initParticles(){
  for(var i=0;i<22;i++){
    var s=document.createElement('div');s.className='pt';
    s.style.cssText='background:'+PT_BG+';width:'+PT_W+'px;height:'+PT_H+'px;border-radius:'+PT_RAD
      +';top:'+(Math.random()*100).toFixed(1)+'%;left:'+(Math.random()*100).toFixed(1)+'%'
      +';--dur:'+(Math.random()*4+3).toFixed(1)+'s;--dly:'+(Math.random()*7).toFixed(1)+'s'
      +';--bright:'+(Math.random()*0.45+0.3).toFixed(2);
    document.body.appendChild(s);
  }
})();

setInterval(function(){
  var changed=false;
  for(var i=0;i<state.timers.length;i++){
    var tm=state.timers[i];
    if(tm._remaining!==null&&tm._remaining>0){
      tm._remaining--; changed=true;
      updateTimerDisplay(tm);
      if(tm._remaining<=0){
        tm._remaining=null;
        if(tm.timerMode==='duration'){ tm._on=false; }
        else{ var up=tm.linkedRuleBlockId?getOut(tm.linkedRuleBlockId):false; tm._on=up; }
      }
    }
  }
  if(changed){ evaluate(); updateOutputs(); }
},1000);

var inputCont=document.getElementById('input-cards');
inputCont.style.cssText='display:flex;flex-direction:column;gap:0.75rem';
var ICONS={temperature:'🌡️',light:'☀️',motion:'👁️',humidity:'💧','text-input':'📝'};
var UNITS={temperature:'°C',light:'%',humidity:'%'};
var TINTS={temperature:'rgba(251,146,60,0.85)',light:'rgba(250,204,21,0.85)',humidity:'rgba(96,165,250,0.85)'};
function setVal(id,val){var s=state.sensors.find(function(x){return x.id===id});if(s){s.value=val;refresh();}}

if(!state.sensors.length&&!state.switches.length){
  inputCont.innerHTML='<p class="empty-hint">No inputs connected.</p>';
}

for(var si=0;si<state.sensors.length;si++){
  (function(sensor){
    var icon=ICONS[sensor.sensorType]||'📡';
    var card=document.createElement('div'); card.className='in-card'; card.id='in-'+sensor.id;
    if(sensor.sensorType==='motion'){
      var on=sensor.value===true||sensor.value==='true';
      card.innerHTML=
        '<div class="in-lbl">'+icon+' '+sensor.name+'</div>'+
        '<div class="ios-sw" onclick="'+
          'var s=state.sensors.find(function(x){return x.id===\\''+sensor.id+'\\';});'+
          'var nv=!(s.value===true||s.value===\\'true\\');'+
          's.value=nv;'+
          'var t=document.getElementById(\\'mt-'+sensor.id+'\\');'+
          'nv?t.classList.add(\\'active\\'):t.classList.remove(\\'active\\');'+
          'document.getElementById(\\'ml-'+sensor.id+'\\').textContent=nv?\\'Motion Detected\\':\\'No Motion\\';'+
          'document.getElementById(\\'ml-'+sensor.id+'\\').style.color=nv?\\'#fff\\':\\'rgba(255,255,255,0.32)\\';'+
          'refresh()">'+
          '<span class="sw-track'+(on?' active':'')+'" id="mt-'+sensor.id+'"><span class="sw-thumb"></span></span>'+
          '<span class="sw-lbl" id="ml-'+sensor.id+'" style="color:'+(on?'#fff':'rgba(255,255,255,0.32)')+'">'+
            (on?'Motion Detected':'No Motion')+'</span>'+
        '</div>';
    } else if(sensor.sensorType==='text-input'){
      card.innerHTML=
        '<div class="in-lbl">'+icon+' '+sensor.name+'</div>'+
        '<input class="txt-inp" type="text" placeholder="Type something…" value="'+String(sensor.value||'')+'" '+
          'oninput="setVal(\\''+sensor.id+'\\',this.value)">';
    } else {
      var min=sensor.min!==undefined?sensor.min:0;
      var max=sensor.max!==undefined?sensor.max:100;
      var val=Number(sensor.value)||0;
      var unit=sensor.unit||UNITS[sensor.sensorType]||'';
      var tint=TINTS[sensor.sensorType]||'rgba(167,139,250,0.85)';
      var pct=max>min?Math.round(((val-min)/(max-min))*100):0;
      card.innerHTML=
        '<div class="in-lbl">'+icon+' '+sensor.name+'</div>'+
        '<div class="slider-wrap">'+
          '<div class="slider-num-row">'+
            '<span class="slider-num" id="lbl-'+sensor.id+'" style="color:'+tint+'">'+val+'</span>'+
            '<span class="slider-unit">'+unit+'</span>'+
          '</div>'+
          '<input type="range" min="'+min+'" max="'+max+'" value="'+val+'" style="--pct:'+pct+'%" '+
            'oninput="'+
              'var pct=Math.round(((this.value-('+min+'))/'+( max - min )+')*100);'+
              'this.style.setProperty(\\'--pct\\',pct+\\'%\\');'+
              'document.getElementById(\\'lbl-'+sensor.id+'\\').textContent=this.value;'+
              'setVal(\\''+sensor.id+'\\',Number(this.value))'+
            '">'+
          '<div class="slider-range"><span>'+min+unit+'</span><span>'+max+unit+'</span></div>'+
        '</div>';
    }
    inputCont.appendChild(card);
  })(state.sensors[si]);
}

for(var wi=0;wi<state.switches.length;wi++){
  (function(sw){
    var card=document.createElement('div'); card.className='in-card'; card.id='in-'+sw.id;
    card.innerHTML=
      '<div class="in-lbl">🎚️ '+sw.name+'</div>'+
      '<div class="ios-sw" onclick="'+
        'var s=state.switches.find(function(x){return x.id===\\''+sw.id+'\\';});'+
        's.isOn=!s.isOn;'+
        'var t=document.getElementById(\\'swt-'+sw.id+'\\');'+
        's.isOn?t.classList.add(\\'active\\'):t.classList.remove(\\'active\\');'+
        'document.getElementById(\\'swl-'+sw.id+'\\').textContent=s.isOn?\\'ON\\':\\'OFF\\';'+
        'document.getElementById(\\'swl-'+sw.id+'\\').style.color=s.isOn?\\'#fff\\':\\'rgba(255,255,255,0.32)\\';'+
        'refresh()">'+
        '<span class="sw-track'+(sw.isOn?' active':'')+'" id="swt-'+sw.id+'"><span class="sw-thumb"></span></span>'+
        '<span class="sw-lbl" id="swl-'+sw.id+'" style="color:'+(sw.isOn?'#fff':'rgba(255,255,255,0.32)')+'">'+
          (sw.isOn?'ON':'OFF')+'</span>'+
      '</div>';
    inputCont.appendChild(card);
  })(state.switches[wi]);
}

for(var tmi=0;tmi<state.timers.length;tmi++){
  (function(tm){
    var card=document.createElement('div'); card.className='in-card'; card.id='in-'+tm.id;
    card.innerHTML=
      '<div class="in-lbl">⏱️ '+tm.name+'</div>'+
      '<div style="display:flex;align-items:baseline;gap:0.5rem">'+
        '<span class="slider-num" id="tc-'+tm.id+'">'+fmtTime(tm.totalSeconds)+'</span>'+
        '<span class="slider-unit" id="ts-'+tm.id+'">⬛ Idle</span>'+
      '</div>';
    inputCont.appendChild(card);
  })(state.timers[tmi]);
}

// Inline text inputs for text models that have no live sensor in this export
var _sensorIds=state.sensors.map(function(s){return s.id;});
APP.models.forEach(function(m){
  if(m.liveSensorId&&_sensorIds.indexOf(m.liveSensorId)>=0) return;
  var card=document.createElement('div'); card.className='in-card'; card.id='in-'+m.id;
  var lbl=document.createElement('div'); lbl.className='in-lbl'; lbl.textContent='📝 '+m.name; card.appendChild(lbl);
  var ta=document.createElement('textarea'); ta.id='sv-mdl-'+m.id; ta.className='in-mdl-ta';
  ta.placeholder='Type text to classify…';
  card.appendChild(ta);
  var sendBtn=document.createElement('button'); sendBtn.className='img-cam-btn'; sendBtn.textContent='→ Send';
  sendBtn.style.marginTop='0.35rem';
  sendBtn.onclick=function(){evaluate();updateOutputs();};
  card.appendChild(sendBtn);
  inputCont.appendChild(card);
});
if(APP.textClusterModels) APP.textClusterModels.forEach(function(tcm){
  if(tcm.liveSensorId&&_sensorIds.indexOf(tcm.liveSensorId)>=0) return;
  var card=document.createElement('div'); card.className='in-card'; card.id='in-'+tcm.id;
  var lbl=document.createElement('div'); lbl.className='in-lbl'; lbl.textContent='📝 '+tcm.name; card.appendChild(lbl);
  var ta=document.createElement('textarea'); ta.id='sv-mdl-'+tcm.id; ta.className='in-mdl-ta';
  ta.placeholder='Type text to group…';
  card.appendChild(ta);
  var sendBtn=document.createElement('button'); sendBtn.className='img-cam-btn'; sendBtn.textContent='→ Send';
  sendBtn.style.marginTop='0.35rem';
  sendBtn.onclick=function(){evaluate();updateOutputs();};
  card.appendChild(sendBtn);
  inputCont.appendChild(card);
});

if(APP.imageModels&&APP.imageModels.length){
  APP.imageModels.forEach(function(im){
    var card=document.createElement('div'); card.className='in-card'; card.id='in-'+im.id;
    var lbl=document.createElement('div'); lbl.className='in-lbl'; lbl.textContent='📷 '+im.name; card.appendChild(lbl);
    var wrap=document.createElement('div'); wrap.className='img-cam-wrap';
    var vid=document.createElement('video'); vid.id='imgcam-'+im.id; vid.autoplay=true; vid.playsInline=true; vid.muted=true; wrap.appendChild(vid);
    var prev=document.createElement('img'); prev.id='imgprev-'+im.id; prev.className='img-cam-preview'; prev.alt=''; wrap.appendChild(prev);
    var can=document.createElement('canvas'); can.id='imgcap-'+im.id; can.style.display='none'; wrap.appendChild(can);
    var ov=document.createElement('div'); ov.id='imgov-'+im.id; ov.className='img-cam-ov'; ov.textContent='⏳ Loading AI engine…'; wrap.appendChild(ov);
    card.appendChild(wrap);
    var actions=document.createElement('div'); actions.className='img-cam-actions';
    var startBtn=document.createElement('button'); startBtn.className='img-cam-btn'; startBtn.textContent='📷 Start Camera';
    (function(mid){startBtn.onclick=function(){startImgCam(mid);};})(im.id);
    actions.appendChild(startBtn);
    var uplLbl=document.createElement('label'); uplLbl.className='img-upload-lbl'; uplLbl.textContent='📁 Upload Photo';
    var fileInp=document.createElement('input'); fileInp.type='file'; fileInp.accept='image/*'; fileInp.style.display='none';
    (function(mid){
      fileInp.onchange=function(){
        if(!this.files[0]) return;
        _pendingFiles[mid]=this.files[0];
        var prev=document.getElementById('imgprev-'+mid);
        var vid=document.getElementById('imgcam-'+mid);
        var ov=document.getElementById('imgov-'+mid);
        var predEl=document.getElementById('imgpred-'+mid);
        var pBtn=document.getElementById('imgpbtn-'+mid);
        if(prev&&prev._url) URL.revokeObjectURL(prev._url);
        var url=URL.createObjectURL(this.files[0]);
        if(prev){prev._url=url;prev.src=url;prev.style.display='block';}
        if(vid) vid.style.display='none';
        if(ov) ov.style.display='none';
        if(predEl) predEl.textContent='Photo selected — click Predict 🎯';
        if(pBtn) pBtn.style.display='inline-flex';
      };
    })(im.id);
    uplLbl.appendChild(fileInp); actions.appendChild(uplLbl);
    var pBtn=document.createElement('button'); pBtn.id='imgpbtn-'+im.id; pBtn.className='img-cam-btn'; pBtn.textContent='🎯 Predict'; pBtn.style.display='none';
    (function(mid){pBtn.onclick=function(){if(_pendingFiles[mid])uploadImgModel(mid,_pendingFiles[mid]);};})(im.id);
    actions.appendChild(pBtn); card.appendChild(actions);
    var predEl=document.createElement('div'); predEl.id='imgpred-'+im.id; predEl.className='img-pred-display'; predEl.textContent='Waiting for camera…'; card.appendChild(predEl);
    var hint=document.createElement('div'); hint.className='img-model-hint'; hint.textContent='Recognises: '+im.labels.join(', '); card.appendChild(hint);
    inputCont.appendChild(card);
  });
}

if(APP.imageClusterModels&&APP.imageClusterModels.length){
  APP.imageClusterModels.forEach(function(icm){
    var card=document.createElement('div'); card.className='in-card'; card.id='in-'+icm.id;
    var lbl=document.createElement('div'); lbl.className='in-lbl'; lbl.textContent='📷 '+icm.name; card.appendChild(lbl);
    var wrap=document.createElement('div'); wrap.className='img-cam-wrap';
    var vid=document.createElement('video'); vid.id='imgcam-'+icm.id; vid.autoplay=true; vid.playsInline=true; vid.muted=true; wrap.appendChild(vid);
    var prev=document.createElement('img'); prev.id='imgprev-'+icm.id; prev.className='img-cam-preview'; prev.alt=''; wrap.appendChild(prev);
    var can=document.createElement('canvas'); can.id='imgcap-'+icm.id; can.style.display='none'; wrap.appendChild(can);
    var ov=document.createElement('div'); ov.id='imgov-'+icm.id; ov.className='img-cam-ov'; ov.textContent='⏳ Loading AI engine…'; wrap.appendChild(ov);
    card.appendChild(wrap);
    var actions=document.createElement('div'); actions.className='img-cam-actions';
    var startBtn=document.createElement('button'); startBtn.className='img-cam-btn'; startBtn.textContent='📷 Start Camera';
    (function(mid){startBtn.onclick=function(){startImgCam(mid);};})(icm.id);
    actions.appendChild(startBtn);
    var uplLbl=document.createElement('label'); uplLbl.className='img-upload-lbl'; uplLbl.textContent='📁 Upload Photo';
    var fileInp=document.createElement('input'); fileInp.type='file'; fileInp.accept='image/*'; fileInp.style.display='none';
    (function(mid){
      fileInp.onchange=function(){
        if(!this.files[0]) return;
        _pendingFiles[mid]=this.files[0];
        var prev=document.getElementById('imgprev-'+mid);
        var vid=document.getElementById('imgcam-'+mid);
        var ov=document.getElementById('imgov-'+mid);
        var predEl=document.getElementById('imgpred-'+mid);
        var pBtn=document.getElementById('imgpbtn-'+mid);
        if(prev&&prev._url) URL.revokeObjectURL(prev._url);
        var url=URL.createObjectURL(this.files[0]);
        if(prev){prev._url=url;prev.src=url;prev.style.display='block';}
        if(vid) vid.style.display='none';
        if(ov) ov.style.display='none';
        if(predEl) predEl.textContent='Photo selected — click Predict 🎯';
        if(pBtn) pBtn.style.display='inline-flex';
      };
    })(icm.id);
    uplLbl.appendChild(fileInp); actions.appendChild(uplLbl);
    var pBtn=document.createElement('button'); pBtn.id='imgpbtn-'+icm.id; pBtn.className='img-cam-btn'; pBtn.textContent='🎯 Predict'; pBtn.style.display='none';
    (function(mid){pBtn.onclick=function(){if(_pendingFiles[mid])uploadImgCluster(mid,_pendingFiles[mid]);};})(icm.id);
    actions.appendChild(pBtn); card.appendChild(actions);
    var predEl=document.createElement('div'); predEl.id='imgpred-'+icm.id; predEl.className='img-pred-display'; predEl.textContent='Waiting for camera…'; card.appendChild(predEl);
    var hint=document.createElement('div'); hint.className='img-model-hint'; hint.textContent='Groups: '+icm.labels.join(', '); card.appendChild(hint);
    inputCont.appendChild(card);
  });
}

var outCont=document.getElementById('output-cards');
var hasOut=state.bulbs.length||state.fans.length||state.doors.length||state.alarms.length||state.acs.length;
if(!hasOut){ outCont.innerHTML='<p class="empty-hint">No outputs connected.</p>'; }
var _outIdx=0;

for(var bi=0;bi<state.bulbs.length;bi++){
  var b=state.bulbs[bi];
  var el=document.createElement('div'); el.id='out-'+b.id; el.className='out-card bulb-card';
  el.style.cssText='animation:card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both;animation-delay:'+(_outIdx*0.08)+'s';_outIdx++;
  el.innerHTML=
    '<div class="out-visual">'+
      '<div class="bulb-glow"></div>'+
      '<svg class="bulb-svg" viewBox="0 0 80 100" width="66">'+
        '<ellipse cx="40" cy="36" rx="27" ry="27" class="b-glass"/>'+
        '<path d="M29 36 Q33 27 37 36 Q40 27 43 36 Q47 27 51 36" class="b-fil"/>'+
        '<rect x="27" y="63" width="26" height="6" rx="2" class="b-base"/>'+
        '<rect x="29" y="69" width="22" height="4" rx="1" class="b-base"/>'+
        '<path d="M30 73 L31 82 Q40 87 49 82 L50 73 Z" class="b-base"/>'+
      '</svg>'+
    '</div>'+
    '<div class="out-footer">'+
      '<span class="out-name">'+b.name+'</span>'+
      '<span class="status-pill" id="st-'+b.id+'">○ OFF</span>'+
    '</div>';
  outCont.appendChild(el);
}

for(var fi=0;fi<state.fans.length;fi++){
  var f=state.fans[fi];
  var el=document.createElement('div'); el.id='out-'+f.id; el.className='out-card fan-card';
  el.style.cssText='animation:card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both;animation-delay:'+(_outIdx*0.08)+'s';_outIdx++;
  el.innerHTML=
    '<div class="out-visual">'+
      '<div class="fan-aura"></div>'+
      '<svg class="fan-svg" viewBox="0 0 60 60" width="70">'+
        '<g class="fan-rotor">'+
          '<path class="f-blade" d="M30,30 Q22,20 24,8 Q30,3 36,8 Q38,20 30,30"/>'+
          '<path class="f-blade" d="M30,30 Q22,20 24,8 Q30,3 36,8 Q38,20 30,30" transform="rotate(90,30,30)"/>'+
          '<path class="f-blade" d="M30,30 Q22,20 24,8 Q30,3 36,8 Q38,20 30,30" transform="rotate(180,30,30)"/>'+
          '<path class="f-blade" d="M30,30 Q22,20 24,8 Q30,3 36,8 Q38,20 30,30" transform="rotate(270,30,30)"/>'+
          '<circle cx="30" cy="30" r="5.5" class="f-hub"/>'+
          '<circle cx="30" cy="30" r="2.5" fill="#4a4a68"/>'+
        '</g>'+
      '</svg>'+
    '</div>'+
    '<div class="out-footer">'+
      '<span class="out-name">'+f.name+'</span>'+
      '<span class="status-pill" id="st-'+f.id+'">○ OFF</span>'+
    '</div>';
  outCont.appendChild(el);
}

for(var di=0;di<state.doors.length;di++){
  var d=state.doors[di];
  var el=document.createElement('div'); el.id='out-'+d.id; el.className='out-card door-card';
  el.style.cssText='animation:card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both;animation-delay:'+(_outIdx*0.08)+'s';_outIdx++;
  el.innerHTML=
    '<div class="out-visual">'+
      '<div class="door-scene">'+
        '<div class="door-frame">'+
          '<div class="door-panel" id="dp-'+d.id+'">'+
            '<div class="door-hdl"></div>'+
          '</div>'+
          '<div class="door-floor"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="out-footer">'+
      '<span class="out-name">'+d.name+'</span>'+
      '<span class="status-pill" id="st-'+d.id+'">○ CLOSED</span>'+
    '</div>';
  outCont.appendChild(el);
}

for(var ai=0;ai<state.alarms.length;ai++){
  var a=state.alarms[ai];
  var el=document.createElement('div'); el.id='out-'+a.id; el.className='out-card alarm-card';
  el.style.cssText='animation:card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both;animation-delay:'+(_outIdx*0.08)+'s';_outIdx++;
  el.innerHTML=
    '<div class="out-visual">'+
      '<div class="alarm-ring"></div>'+
      '<div class="alarm-ring"></div>'+
      '<div class="alarm-ring"></div>'+
      '<div class="alarm-siren">🚨</div>'+
    '</div>'+
    '<div class="out-footer">'+
      '<span class="out-name">'+a.name+'</span>'+
      '<span class="status-pill" id="st-'+a.id+'">○ OFF</span>'+
    '</div>';
  outCont.appendChild(el);
}

for(var ci=0;ci<state.acs.length;ci++){
  var ac=state.acs[ci];
  var el=document.createElement('div'); el.id='out-'+ac.id; el.className='out-card ac-card';
  el.style.cssText='animation:card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both;animation-delay:'+(_outIdx*0.08)+'s';_outIdx++;
  el.innerHTML=
    '<div class="out-visual">'+
      '<span class="flake">❄</span><span class="flake">❄</span><span class="flake">❄</span>'+
      '<span class="flake">❄</span><span class="flake">❄</span>'+
      '<div class="ac-body">'+
        '<div class="ac-grille"></div>'+
        '<div class="ac-led"></div>'+
        '<div class="ac-vent">'+
          '<div class="ac-slot"></div><div class="ac-slot"></div><div class="ac-slot"></div>'+
          '<div class="ac-slot"></div><div class="ac-slot"></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<div class="out-footer">'+
      '<span class="out-name">'+ac.name+'</span>'+
      '<span class="status-pill" id="st-'+ac.id+'">○ OFF</span>'+
    '</div>';
  outCont.appendChild(el);
}

var _inputOrder=${JSON.stringify(inputOrder)};
var _outputOrder=${JSON.stringify(outputOrder)};
_inputOrder.forEach(function(id){var c=document.getElementById('in-'+id);if(c&&c.parentNode===inputCont)inputCont.appendChild(c);});
_outputOrder.forEach(function(id){var c=document.getElementById('out-'+id);if(c&&c.parentNode===outCont)outCont.appendChild(c);});
refresh();
_appReady=true;
<\/script>
</body>
</html>`
}

// ── Standalone AI Model Export ──────────────────────────────────────────────

export function exportAIModel(
  appName = 'My AI Model',
  selectedIds?: Set<string>,
  theme: Theme = 'space',
  creatorName = '',
  instructions = '',
): void {
  const keep = (id: string) => !selectedIds || selectedIds.has(id)
  const modelState = useModelStore.getState()

  const allSelected = modelState.modelBlocks.filter(b => keep(b.id) && b.trainedModelId)
  const primaryType = allSelected[0]?.modelType ?? 'text-supervised'

  let html: string
  if (primaryType === 'image-supervised' || primaryType === 'image-classifier') {
    const models = allSelected.map(mb => {
      const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
      return {
        id: mb.id,
        name: mb.name,
        labels: tm?.labels ?? [],
        labelIds: tm?.labelIds ?? [],
        knnData: tm?.knnData ?? {},
      }
    })
    html = buildImageModelHTML(appName, models, THEMES[theme], creatorName, instructions)
  } else if (primaryType === 'text-unsupervised' || primaryType === 'image-unsupervised') {
    const mb = allSelected[0]
    const tm = modelState.trainedModels.find(m => m.id === mb?.trainedModelId)
    html = buildClusterHTML(appName, {
      id: mb?.id ?? '',
      name: mb?.name ?? appName,
      modelType: primaryType,
      labels: tm?.labels ?? [],
      centroids: tm?.clusterCentroids ?? [],
      vocab: tm?.clusterVocab,
      idfWeights: tm?.clusterIdfWeights,
    }, THEMES[theme], creatorName, instructions)
  } else {
    const models = allSelected
      .filter(mb => mb.modelType === 'text-supervised')
      .map(mb => {
        const tm = modelState.trainedModels.find(m => m.id === mb.trainedModelId)
        return {
          id: mb.id,
          name: mb.name,
          vocab: tm?.textVocab ?? [],
          wordLogProbs: tm?.nbWordLogProbs ?? {},
          classLogPriors: tm?.nbClassLogPriors ?? {},
          labels: tm?.labels ?? [],
          labelIds: tm?.labelIds ?? [],
        }
      })
    html = buildAIModelHTML(appName, models, THEMES[theme], creatorName, instructions)
  }
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${appName.replace(/\s+/g, '-').toLowerCase()}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildAIModelHTML(
  appName: string,
  models: Array<{
    id: string; name: string;
    vocab: string[]; wordLogProbs: Record<string, number[]>;
    classLogPriors: Record<string, number>;
    labels: string[]; labelIds: string[];
  }>,
  t: typeof THEMES[Theme],
  creatorName: string,
  instructions = '',
): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeCreator = creatorName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeInstructions = instructions.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const modelsJson = JSON.stringify(models)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${safeTitle}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="${t.acc}">
<style>
:root{--bg1:${t.bg1};--bg2:${t.bg2};--acc:${t.acc};--acc2:${t.acc2};--orb1:${t.orb1};--orb2:${t.orb2}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,var(--bg1) 0%,var(--bg2) 100%);color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;position:relative}
body::before{content:'';position:fixed;width:500px;height:500px;top:-150px;left:-150px;background:radial-gradient(circle,var(--orb1),transparent 70%);border-radius:50%;animation:float 8s ease-in-out infinite;pointer-events:none;z-index:0}
body::after{content:'';position:fixed;width:420px;height:420px;bottom:-100px;right:-100px;background:radial-gradient(circle,var(--orb2),transparent 70%);border-radius:50%;animation:float 10s ease-in-out infinite reverse;pointer-events:none;z-index:0}
.pt{position:fixed;pointer-events:none;animation:star-twinkle var(--dur) ease-in-out infinite;animation-delay:var(--dly);opacity:0.1;z-index:0}
header{background:rgba(18,14,42,0.9);border-bottom:1px solid rgba(255,255,255,0.07);padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);position:relative;z-index:10}
.h-left{display:flex;align-items:center;gap:1rem}
.h-icon{font-size:2rem;line-height:1}
.h-title{font-size:1.4rem;font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite}
.h-sub{font-size:0.7rem;color:rgba(255,255,255,0.28);margin-top:0.125rem}
.abita-badge{font-size:0.62rem;font-weight:800;color:rgba(167,139,250,0.75);border:1px solid rgba(167,139,250,0.2);padding:0.3rem 0.75rem;border-radius:9999px;letter-spacing:0.07em;background:rgba(139,92,246,0.07)}
main{flex:1;display:flex;flex-direction:column;align-items:center;gap:1.5rem;padding:2rem;max-width:640px;margin:0 auto;width:100%;position:relative;z-index:1}
.model-card{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:1.25rem;padding:1.5rem;display:flex;flex-direction:column;gap:1.125rem}
.model-name{font-size:1rem;font-weight:800;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.model-hint{font-size:0.73rem;color:rgba(255,255,255,0.32)}
.input-area{display:flex;flex-direction:column;gap:0.625rem}
.ai-textarea{width:100%;min-height:72px;padding:0.75rem 1rem;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:0.75rem;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;resize:vertical;transition:border-color 0.2s,box-shadow 0.2s}
.ai-textarea:focus{border-color:rgba(255,255,255,0.3);box-shadow:0 0 0 3px rgba(255,255,255,0.07)}
.ai-textarea::placeholder{color:rgba(255,255,255,0.2)}
.predict-btn{align-self:flex-start;padding:0.55rem 1.25rem;border-radius:0.625rem;border:none;background:linear-gradient(90deg,var(--acc),var(--acc2));color:#fff;font-size:0.85rem;font-weight:800;font-family:inherit;cursor:pointer;transition:opacity 0.15s,transform 0.1s}
.predict-btn:hover{opacity:0.9}
.predict-btn:active{transform:scale(0.97)}
.results{display:flex;flex-direction:column;gap:0.5rem;min-height:0}
.result-row{display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.625rem;border-radius:0.5rem;transition:background 0.2s}
.result-row.best{background:rgba(255,255,255,0.06)}
.result-lbl{font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.55);width:90px;flex-shrink:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;text-transform:capitalize}
.result-row.best .result-lbl{color:#fff}
.bar-wrap{flex:1;height:8px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width 0.45s cubic-bezier(0.4,0,0.2,1)}
.result-pct{font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.4);width:36px;text-align:right;flex-shrink:0}
.result-row.best .result-pct{color:var(--acc2)}
.result-tag{display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.75rem;border-radius:9999px;font-size:0.72rem;font-weight:800;background:linear-gradient(90deg,var(--acc)22,var(--acc2)22);border:1px solid rgba(255,255,255,0.12);color:#fff}
.waiting{font-size:0.78rem;color:rgba(255,255,255,0.22);font-style:italic}
footer{text-align:center;padding:0.875rem;font-size:0.67rem;color:rgba(255,255,255,0.13);border-top:1px solid rgba(255,255,255,0.05);position:relative;z-index:1}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes star-twinkle{0%,100%{opacity:0.07}50%{opacity:var(--bright,0.55)}}
.splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;background:linear-gradient(135deg,var(--bg1),var(--bg2));transition:opacity 0.6s ease;pointer-events:auto}
.splash.hide{opacity:0;pointer-events:none}
.splash-icon{font-size:4rem;animation:spl-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both}
.splash-title{font-size:2rem;font-weight:900;text-align:center;max-width:80vw;line-height:1.15;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite,spl-in 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both}
.splash-by{font-size:0.85rem;color:rgba(255,255,255,0.45);animation:spl-in 0.5s ease 0.55s both}
.splash-badge{font-size:0.65rem;font-weight:800;color:rgba(167,139,250,0.8);border:1px solid rgba(167,139,250,0.25);padding:0.3rem 0.8rem;border-radius:9999px;background:rgba(139,92,246,0.08);animation:spl-in 0.5s ease 0.75s both}
.splash-skip{position:absolute;top:1rem;right:1rem;font-size:0.7rem;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:inherit;transition:color 0.2s}
.splash-skip:hover{color:rgba(255,255,255,0.6)}
@keyframes spl-in{from{opacity:0;transform:scale(0.7) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
.toast-wrap{position:fixed;top:1rem;right:1rem;z-index:9998;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:240px}
.toast{background:rgba(18,14,42,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.55rem 1rem;font-size:0.78rem;font-weight:600;color:#fff;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);opacity:0;transform:translateX(110%);transition:opacity 0.3s,transform 0.3s;pointer-events:none}
.toast.show{opacity:1;transform:translateX(0)}
.snd-btn{background:none;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;color:rgba(255,255,255,0.4);font-size:0.8rem;padding:0.25rem 0.5rem;cursor:pointer;transition:all 0.2s;font-family:inherit}
.snd-btn:hover{border-color:rgba(255,255,255,0.3);color:rgba(255,255,255,0.8)}
#app-instructions{display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 2rem;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.07);position:relative;z-index:2}
.instr-icon{font-size:1.15rem;flex-shrink:0;opacity:.75;margin-top:.1rem}
.instr-title{font-size:0.63rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.3);margin-bottom:.2rem}
.instr-text{font-size:0.82rem;line-height:1.5;color:rgba(255,255,255,0.7);white-space:pre-wrap}
</style>
</head>
<body>
<div class="splash" id="splash">
  <button class="splash-skip" onclick="hideSplash()">Skip ›</button>
  <span class="splash-icon">🧠</span>
  <div class="splash-title">${safeTitle}</div>
  ${safeCreator ? `<div class="splash-by">Made by ${safeCreator}</div>` : ''}
  <div class="splash-badge">⚡ Made with ABITA</div>
</div>
<div class="toast-wrap" id="toasts"></div>
<header>
  <div class="h-left">
    <span class="h-icon">🧠</span>
    <div>
      <div class="h-title">${safeTitle}</div>
      <div class="h-sub">AI Model — Made with ABITA</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:0.5rem">
    <button class="snd-btn" id="snd-toggle" onclick="toggleSound()" title="Toggle sounds">🔊</button>
    <span class="abita-badge">⚡ ABITA</span>
  </div>
</header>
${safeInstructions ? `<section id="app-instructions"><span class="instr-icon">📋</span><div class="instr-body"><p class="instr-title">How this app works</p><p class="instr-text">${safeInstructions}</p></div></section>` : ''}
<main id="cards"></main>
<footer>${safeCreator ? `Made by ${safeCreator} · ` : ''}Built with ABITA · AI Sandbox for Kids</footer>
<script>
function hideSplash(){var s=document.getElementById('splash');if(!s)return;s.classList.add('hide');setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s);},650);}
setTimeout(hideSplash,2500);
function showToast(msg){var w=document.getElementById('toasts');if(!w)return;var t=document.createElement('div');t.className='toast';t.textContent=msg;w.appendChild(t);requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show');});});setTimeout(function(){t.classList.remove('show');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},400);},2800);}
var _soundOn=true,_actx=null;
function toggleSound(){_soundOn=!_soundOn;var b=document.getElementById('snd-toggle');if(b)b.textContent=_soundOn?'🔊':'🔇';}
function _getCtx(){if(!_actx){try{_actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return _actx;}
function _blip(freq,dur,type){var c=_getCtx();if(!c||!_soundOn)return;var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type||'sine';o.frequency.value=freq;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(0.15,c.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start();o.stop(c.currentTime+dur);}
var MODELS = ${modelsJson};

function tokenizeNB(t){
  return t.toLowerCase().replace(/[^a-z0-9\\s]/g,' ').split(/\\s+/).filter(function(w){return w.length>1;});
}
function runNBFull(modelId,text){
  var m=MODELS.find(function(m){return m.id===modelId;});
  if(!m||!m.vocab.length) return null;
  if(!m.wordLogProbs||Object.keys(m.wordLogProbs).length===0) return {error:'nodata'};
  var vi={};
  m.vocab.forEach(function(w,i){vi[w]=i;});
  var tokens=tokenizeNB(text);
  var scores=[];
  for(var li=0;li<m.labels.length;li++){
    var lid=m.labelIds[li];
    var s=(m.classLogPriors[lid]!==undefined?m.classLogPriors[lid]:Math.log(1/m.labels.length));
    var lp=m.wordLogProbs[lid]||[];
    for(var ti=0;ti<tokens.length;ti++){var idx=vi[tokens[ti]];if(idx!==undefined)s+=lp[idx]||0;}
    scores.push(s);
  }
  var maxS=Math.max.apply(null,scores);
  var exps=scores.map(function(s){return Math.exp(s-maxS);});
  var sum=exps.reduce(function(a,b){return a+b;},0);
  var probs=exps.map(function(e){return e/sum;});
  var bestI=probs.indexOf(Math.max.apply(null,probs));
  return {labels:m.labels,probs:probs,bestLabel:m.labels[bestI]};
}
function predict(modelId,inputId,resultsId){
  var text=document.getElementById(inputId).value||'';
  var res=runNBFull(modelId,text);
  var el=document.getElementById(resultsId);
  if(res&&res.error==='nodata'){
    el.innerHTML='<span class="waiting">⚠ Model needs retraining — go back to ABITA and retrain this model.</span>';
    return;
  }
  if(!res||!text.trim()){
    el.innerHTML='<span class="waiting">Type something above and click Predict ✨</span>';
    return;
  }
  var sorted=res.labels.map(function(l,i){return{l:l,p:res.probs[i]};}).sort(function(a,b){return b.p-a.p;});
  var html='<div class="result-tag">🎯 Predicted: '+res.bestLabel+'</div>';
  for(var i=0;i<sorted.length;i++){
    var isBest=sorted[i].l===res.bestLabel;
    var pct=Math.round(sorted[i].p*100);
    html+='<div class="result-row'+(isBest?' best':'')+'">'+
      '<span class="result-lbl">'+sorted[i].l+'</span>'+
      '<div class="bar-wrap"><div class="bar-fill" style="width:'+pct+'%"></div></div>'+
      '<span class="result-pct">'+pct+'%</span>'+
    '</div>';
  }
  el.innerHTML=html;
  showToast('🎯 '+res.bestLabel+' — '+Math.round(sorted[0].p*100)+'% confident');
  _blip(660,0.15);
}

var PT_BG='${t.ptBg}',PT_W=${t.ptW},PT_H=${t.ptH},PT_RAD='${t.ptRad}';
(function initParticles(){
  for(var i=0;i<22;i++){
    var s=document.createElement('div');s.className='pt';
    s.style.cssText='background:'+PT_BG+';width:'+PT_W+'px;height:'+PT_H+'px;border-radius:'+PT_RAD
      +';top:'+(Math.random()*100).toFixed(1)+'%;left:'+(Math.random()*100).toFixed(1)+'%'
      +';--dur:'+(Math.random()*4+3).toFixed(1)+'s;--dly:'+(Math.random()*7).toFixed(1)+'s'
      +';--bright:'+(Math.random()*0.45+0.3).toFixed(2);
    document.body.appendChild(s);
  }
})();

var cards=document.getElementById('cards');
for(var mi=0;mi<MODELS.length;mi++){
  (function(m){
    var inputId='ai-input-'+m.id;
    var resultsId='ai-results-'+m.id;
    var mId=m.id;
    var div=document.createElement('div');
    div.className='model-card';
    div.innerHTML=
      '<div>'+
        '<div class="model-name">🤖 '+m.name+'</div>'+
        '<div class="model-hint">This model was trained to recognise '+m.labels.length+' categories: '+m.labels.join(', ')+'</div>'+
      '</div>'+
      '<div class="input-area">'+
        '<textarea class="ai-textarea" id="'+inputId+'" placeholder="Type some text and see what this AI thinks…"></textarea>'+
        '<button class="predict-btn" onclick="predict(\\''+mId+'\\',\\''+inputId+'\\',\\''+resultsId+'\\')">Predict ✨</button>'+
      '</div>'+
      '<div class="results" id="'+resultsId+'"><span class="waiting">Type something above and click Predict ✨</span></div>';
    cards.appendChild(div);
  })(MODELS[mi]);
}
<\/script>
</body>
</html>`
}

// ── Image Model Export (CDN TF.js + MobileNet + KNN) ────────────────────────

function buildImageModelHTML(
  appName: string,
  models: Array<{
    id: string; name: string;
    labels: string[]; labelIds: string[];
    knnData: Record<string, { values: number[]; shape: number[] }>;
  }>,
  t: typeof THEMES[Theme],
  creatorName: string,
  instructions = '',
): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeCreator = creatorName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeInstructions = instructions.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const modelsJson = JSON.stringify(models)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📷</text></svg>">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${safeTitle}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="${t.acc}">
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js"><\/script>
<style>
:root{--bg1:${t.bg1};--bg2:${t.bg2};--acc:${t.acc};--acc2:${t.acc2};--orb1:${t.orb1};--orb2:${t.orb2}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,var(--bg1) 0%,var(--bg2) 100%);color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;position:relative}
body::before{content:'';position:fixed;width:500px;height:500px;top:-150px;left:-150px;background:radial-gradient(circle,var(--orb1),transparent 70%);border-radius:50%;animation:float 8s ease-in-out infinite;pointer-events:none;z-index:0}
body::after{content:'';position:fixed;width:420px;height:420px;bottom:-100px;right:-100px;background:radial-gradient(circle,var(--orb2),transparent 70%);border-radius:50%;animation:float 10s ease-in-out infinite reverse;pointer-events:none;z-index:0}
.pt{position:fixed;pointer-events:none;animation:star-twinkle var(--dur) ease-in-out infinite;animation-delay:var(--dly);opacity:0.1;z-index:0}
header{background:rgba(18,14,42,0.9);border-bottom:1px solid rgba(255,255,255,0.07);padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);position:relative;z-index:10}
.h-left{display:flex;align-items:center;gap:1rem}
.h-icon{font-size:2rem;line-height:1}
.h-title{font-size:1.4rem;font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite}
.h-sub{font-size:0.7rem;color:rgba(255,255,255,0.28);margin-top:0.125rem}
.abita-badge{font-size:0.62rem;font-weight:800;color:rgba(167,139,250,0.75);border:1px solid rgba(167,139,250,0.2);padding:0.3rem 0.75rem;border-radius:9999px;letter-spacing:0.07em;background:rgba(139,92,246,0.07)}
main{flex:1;display:flex;flex-direction:column;align-items:center;gap:1.5rem;padding:2rem;max-width:660px;margin:0 auto;width:100%;position:relative;z-index:1}
.model-card{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:1.25rem;padding:1.5rem;display:flex;flex-direction:column;gap:1.125rem}
.model-name{font-size:1rem;font-weight:800;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.model-hint{font-size:0.73rem;color:rgba(255,255,255,0.32)}
.cam-wrap{position:relative;width:100%;max-width:400px;margin:0 auto;border-radius:1rem;overflow:hidden;background:#000;aspect-ratio:4/3}
.cam-wrap video{width:100%;height:100%;object-fit:cover;display:block}
.cam-wrap canvas{display:none}
.cam-preview{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;background:#111}
.cam-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);font-size:0.85rem;color:rgba(255,255,255,0.6);text-align:center;padding:1rem}
.cam-actions{display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center}
.predict-btn{padding:0.55rem 1.25rem;border-radius:0.625rem;border:none;background:linear-gradient(90deg,var(--acc),var(--acc2));color:#fff;font-size:0.85rem;font-weight:800;font-family:inherit;cursor:pointer;transition:opacity 0.15s,transform 0.1s}
.predict-btn:hover{opacity:0.9}
.predict-btn:active{transform:scale(0.97)}
.upload-btn{padding:0.55rem 1.25rem;border-radius:0.625rem;border:1.5px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.75);font-size:0.82rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.15s}
.upload-btn:hover{border-color:rgba(255,255,255,0.35);color:#fff}
.results{display:flex;flex-direction:column;gap:0.5rem;min-height:0}
.result-row{display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.625rem;border-radius:0.5rem;transition:background 0.2s}
.result-row.best{background:rgba(255,255,255,0.06)}
.result-lbl{font-size:0.8rem;font-weight:700;color:rgba(255,255,255,0.55);width:90px;flex-shrink:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;text-transform:capitalize}
.result-row.best .result-lbl{color:#fff}
.bar-wrap{flex:1;height:8px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width 0.45s cubic-bezier(0.4,0,0.2,1)}
.result-pct{font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.4);width:36px;text-align:right;flex-shrink:0}
.result-row.best .result-pct{color:var(--acc2)}
.result-tag{display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.75rem;border-radius:9999px;font-size:0.72rem;font-weight:800;background:linear-gradient(90deg,var(--acc)22,var(--acc2)22);border:1px solid rgba(255,255,255,0.12);color:#fff}
.waiting{font-size:0.78rem;color:rgba(255,255,255,0.22);font-style:italic}
.loading-bar{height:3px;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:2px;width:0%;transition:width 0.5s}
footer{text-align:center;padding:0.875rem;font-size:0.67rem;color:rgba(255,255,255,0.13);border-top:1px solid rgba(255,255,255,0.05);position:relative;z-index:1}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes star-twinkle{0%,100%{opacity:0.07}50%{opacity:var(--bright,0.55)}}
.splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;background:linear-gradient(135deg,var(--bg1),var(--bg2));transition:opacity 0.6s ease;pointer-events:auto}
.splash.hide{opacity:0;pointer-events:none}
.splash-icon{font-size:4rem;animation:spl-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both}
.splash-title{font-size:2rem;font-weight:900;text-align:center;max-width:80vw;line-height:1.15;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite,spl-in 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both}
.splash-by{font-size:0.85rem;color:rgba(255,255,255,0.45);animation:spl-in 0.5s ease 0.55s both}
.splash-badge{font-size:0.65rem;font-weight:800;color:rgba(167,139,250,0.8);border:1px solid rgba(167,139,250,0.25);padding:0.3rem 0.8rem;border-radius:9999px;background:rgba(139,92,246,0.08);animation:spl-in 0.5s ease 0.75s both}
.splash-skip{position:absolute;top:1rem;right:1rem;font-size:0.7rem;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:inherit;transition:color 0.2s}
.splash-skip:hover{color:rgba(255,255,255,0.6)}
@keyframes spl-in{from{opacity:0;transform:scale(0.7) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
.toast-wrap{position:fixed;top:1rem;right:1rem;z-index:9998;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:240px}
.toast{background:rgba(18,14,42,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.55rem 1rem;font-size:0.78rem;font-weight:600;color:#fff;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);opacity:0;transform:translateX(110%);transition:opacity 0.3s,transform 0.3s;pointer-events:none}
.toast.show{opacity:1;transform:translateX(0)}
.snd-btn{background:none;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;color:rgba(255,255,255,0.4);font-size:0.8rem;padding:0.25rem 0.5rem;cursor:pointer;transition:all 0.2s;font-family:inherit}
.snd-btn:hover{border-color:rgba(255,255,255,0.3);color:rgba(255,255,255,0.8)}
#app-instructions{display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 2rem;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.07);position:relative;z-index:2}
.instr-icon{font-size:1.15rem;flex-shrink:0;opacity:.75;margin-top:.1rem}
.instr-title{font-size:0.63rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.3);margin-bottom:.2rem}
.instr-text{font-size:0.82rem;line-height:1.5;color:rgba(255,255,255,0.7);white-space:pre-wrap}
</style>
</head>
<body>
<div class="splash" id="splash">
  <button class="splash-skip" onclick="hideSplash()">Skip ›</button>
  <span class="splash-icon">📷</span>
  <div class="splash-title">${safeTitle}</div>
  ${safeCreator ? `<div class="splash-by">Made by ${safeCreator}</div>` : ''}
  <div class="splash-badge">⚡ Made with ABITA</div>
</div>
<div class="toast-wrap" id="toasts"></div>
<header>
  <div class="h-left">
    <span class="h-icon">📷</span>
    <div>
      <div class="h-title">${safeTitle}</div>
      <div class="h-sub">Image Classifier — Made with ABITA</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:0.5rem">
    <button class="snd-btn" id="snd-toggle" onclick="toggleSound()" title="Toggle sounds">🔊</button>
    <span class="abita-badge">⚡ ABITA</span>
  </div>
</header>
${safeInstructions ? `<section id="app-instructions"><span class="instr-icon">📋</span><div class="instr-body"><p class="instr-title">How this app works</p><p class="instr-text">${safeInstructions}</p></div></section>` : ''}
<main id="cards">
  <div id="init-status" style="font-size:0.8rem;color:rgba(255,255,255,0.35);text-align:center;padding-top:1rem">
    <div style="margin-bottom:0.5rem">Loading AI vision engine… (requires internet)</div>
    <div class="loading-bar" id="init-bar"></div>
  </div>
</main>
<footer>${safeCreator ? `Made by ${safeCreator} · ` : ''}Built with ABITA · AI Sandbox for Kids</footer>
<script>
function hideSplash(){var s=document.getElementById('splash');if(!s)return;s.classList.add('hide');setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s);},650);}
setTimeout(hideSplash,2500);
function showToast(msg){var w=document.getElementById('toasts');if(!w)return;var t=document.createElement('div');t.className='toast';t.textContent=msg;w.appendChild(t);requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show');});});setTimeout(function(){t.classList.remove('show');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},400);},2800);}
var _soundOn=true,_actx=null;
function toggleSound(){_soundOn=!_soundOn;var b=document.getElementById('snd-toggle');if(b)b.textContent=_soundOn?'🔊':'🔇';}
function _getCtx(){if(!_actx){try{_actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return _actx;}
function _blip(freq,dur,type){var c=_getCtx();if(!c||!_soundOn)return;var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type||'sine';o.frequency.value=freq;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(0.15,c.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start();o.stop(c.currentTime+dur);}

var MODELS = ${modelsJson};
var _mobileNet = null;

// KNN inference — pure JS, no extra deps
function knnPredict(queryVec, knnData, labels, labelIds, k) {
  k = k || 5;
  var dists = [];
  for (var lid in knnData) {
    var values = knnData[lid].values;
    var shape = knnData[lid].shape; // [n, 1024]
    var n = shape[0], dim = shape[1];
    for (var row = 0; row < n; row++) {
      var d = 0;
      for (var j = 0; j < dim; j++) { var diff = queryVec[j] - values[row * dim + j]; d += diff * diff; }
      dists.push({ lid: lid, d: d });
    }
  }
  dists.sort(function(a, b) { return a.d - b.d; });
  var weights = {};
  var totalWeight = 0;
  for (var i = 0; i < Math.min(k, dists.length); i++) {
    var w = 1 / (dists[i].d + 1e-6);
    weights[dists[i].lid] = (weights[dists[i].lid] || 0) + w;
    totalWeight += w;
  }
  var result = labelIds.map(function(lid, i) {
    return { label: labels[i], labelId: lid, p: totalWeight > 0 ? (weights[lid] || 0) / totalWeight : 0 };
  });
  result.sort(function(a, b) { return b.p - a.p; });
  return result;
}

function showResults(resultsId, sorted) {
  var el = document.getElementById(resultsId);
  if (!el) return;
  var bestLabel = sorted[0].label;
  var html = '<div class="result-tag">🎯 ' + bestLabel + '</div>';
  for (var i = 0; i < sorted.length; i++) {
    var isBest = sorted[i].label === bestLabel;
    var pct = Math.round(sorted[i].p * 100);
    html += '<div class="result-row' + (isBest ? ' best' : '') + '">' +
      '<span class="result-lbl">' + sorted[i].label + '</span>' +
      '<div class="bar-wrap"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="result-pct">' + pct + '%</span>' +
      '</div>';
  }
  el.innerHTML = html;
  showToast('🎯 ' + bestLabel + ' — ' + Math.round(sorted[0].p * 100) + '% confident');
  _blip(660, 0.15);
}

async function predictFrame(modelIdx) {
  var m = MODELS[modelIdx];
  var videoEl = document.getElementById('cam-' + modelIdx);
  var canvasEl = document.getElementById('cap-' + modelIdx);
  var resultsId = 'res-' + modelIdx;
  var overlayEl = document.getElementById('ov-' + modelIdx);
  if (!_mobileNet) { if (overlayEl) overlayEl.textContent = 'AI engine still loading…'; return; }
  if (overlayEl) overlayEl.style.display = 'none';
  var ctx2d = canvasEl.getContext('2d');
  canvasEl.width = 224; canvasEl.height = 224;
  ctx2d.drawImage(videoEl, 0, 0, 224, 224);
  try {
    var imgTensor = tf.browser.fromPixels(canvasEl);
    var features = _mobileNet.infer(imgTensor, true);
    var featureValues = Array.from(await features.data());
    imgTensor.dispose(); features.dispose();
    var sorted = knnPredict(featureValues, m.knnData, m.labels, m.labelIds, 5);
    showResults(resultsId, sorted);
  } catch(e) {
    document.getElementById(resultsId).innerHTML = '<span class="waiting">Prediction failed — try again</span>';
  }
}

async function predictUpload(modelIdx, file) {
  var m = MODELS[modelIdx];
  var canvasEl = document.getElementById('cap-' + modelIdx);
  var videoEl = document.getElementById('cam-' + modelIdx);
  var previewEl = document.getElementById('prev-' + modelIdx);
  var ovEl = document.getElementById('ov-' + modelIdx);
  var resultsId = 'res-' + modelIdx;
  if (!_mobileNet) { showToast('AI engine still loading — please wait'); return; }
  if (previewEl._prevUrl) { URL.revokeObjectURL(previewEl._prevUrl); }
  var url = URL.createObjectURL(file);
  previewEl._prevUrl = url;
  previewEl.src = url;
  previewEl.style.display = 'block';
  if (videoEl) videoEl.style.display = 'none';
  if (ovEl) ovEl.style.display = 'none';
  var img = new Image();
  img.onload = async function() {
    var ctx2d = canvasEl.getContext('2d');
    canvasEl.width = 224; canvasEl.height = 224;
    ctx2d.drawImage(img, 0, 0, 224, 224);
    try {
      var imgTensor = tf.browser.fromPixels(canvasEl);
      var features = _mobileNet.infer(imgTensor, true);
      var featureValues = Array.from(await features.data());
      imgTensor.dispose(); features.dispose();
      var sorted = knnPredict(featureValues, m.knnData, m.labels, m.labelIds, 5);
      showResults(resultsId, sorted);
    } catch(e) {
      document.getElementById(resultsId).innerHTML = '<span class="waiting">Prediction failed — try again</span>';
    }
  };
  img.src = url;
}

var PT_BG='${t.ptBg}',PT_W=${t.ptW},PT_H=${t.ptH},PT_RAD='${t.ptRad}';
(function initParticles(){
  for(var i=0;i<22;i++){
    var s=document.createElement('div');s.className='pt';
    s.style.cssText='background:'+PT_BG+';width:'+PT_W+'px;height:'+PT_H+'px;border-radius:'+PT_RAD
      +';top:'+(Math.random()*100).toFixed(1)+'%;left:'+(Math.random()*100).toFixed(1)+'%'
      +';--dur:'+(Math.random()*4+3).toFixed(1)+'s;--dly:'+(Math.random()*7).toFixed(1)+'s'
      +';--bright:'+(Math.random()*0.45+0.3).toFixed(2);
    document.body.appendChild(s);
  }
})();

// Load MobileNet then build cards
var bar = document.getElementById('init-bar');
if (bar) bar.style.width = '20%';
mobilenet.load({ version: 2, alpha: 0.5 }).then(function(net) {
  _mobileNet = net;
  var status = document.getElementById('init-status');
  if (status) status.style.display = 'none';
  var cards = document.getElementById('cards');
  MODELS.forEach(function(m, mi) {
    var div = document.createElement('div');
    div.className = 'model-card';
    div.innerHTML =
      '<div>' +
        '<div class="model-name">📷 ' + m.name + '</div>' +
        '<div class="model-hint">Trained to recognise ' + m.labels.length + ' things: ' + m.labels.join(', ') + '</div>' +
      '</div>' +
      '<div class="cam-wrap">' +
        '<video id="cam-' + mi + '" autoplay playsinline muted></video>' +
        '<img id="prev-' + mi + '" class="cam-preview" alt="" />' +
        '<canvas id="cap-' + mi + '" style="display:none"></canvas>' +
        '<div class="cam-overlay" id="ov-' + mi + '">📷 Click "Start Camera" to begin</div>' +
      '</div>' +
      '<div class="cam-actions">' +
        '<button class="predict-btn" onclick="startCam(' + mi + ')">📷 Start Camera</button>' +
        '<button class="predict-btn" onclick="predictFrame(' + mi + ')">Predict ✨</button>' +
        '<label class="upload-btn">📁 Upload Photo<input type="file" accept="image/*" style="display:none" onchange="predictUpload(' + mi + ',this.files[0])"></label>' +
      '</div>' +
      '<div class="results" id="res-' + mi + '"><span class="waiting">Start camera or upload a photo, then click Predict ✨</span></div>';
    cards.appendChild(div);
  });
}).catch(function(e) {
  var status = document.getElementById('init-status');
  if (status) status.innerHTML = '<span style="color:rgba(255,80,80,0.8)">⚠ Could not load AI engine — check your internet connection and reload</span>';
});

function startCam(mi) {
  var videoEl = document.getElementById('cam-' + mi);
  var ovEl = document.getElementById('ov-' + mi);
  var previewEl = document.getElementById('prev-' + mi);
  if (previewEl) { previewEl.style.display = 'none'; }
  if (videoEl) videoEl.style.display = 'block';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) { videoEl.srcObject = stream; if (ovEl) ovEl.style.display = 'none'; })
    .catch(function() {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) { videoEl.srcObject = stream; if (ovEl) ovEl.style.display = 'none'; })
        .catch(function() { if (ovEl) ovEl.textContent = '⚠ Camera access denied — use "Upload Photo" instead'; });
    });
}
<\/script>
</body>
</html>`
}

// ── Cluster Explorer Export (text: pure JS; image: CDN TF.js) ───────────────

function buildClusterHTML(
  appName: string,
  model: {
    id: string; name: string;
    modelType: string;
    labels: string[];
    centroids: number[][];
    vocab?: string[];
    idfWeights?: number[];
  },
  t: typeof THEMES[Theme],
  creatorName: string,
  instructions = '',
): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeCreator = creatorName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeInstructions = instructions.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  const isImage = model.modelType === 'image-unsupervised'
  const icon = isImage ? '🔍' : '🔍'
  const centroidsJson = JSON.stringify(model.centroids)
  const labelsJson = JSON.stringify(model.labels)
  const vocabJson = JSON.stringify(model.vocab ?? [])
  const idfJson = JSON.stringify(model.idfWeights ?? [])

  const cdnScripts = isImage ? `
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js"><\/script>` : ''

  const inputSection = isImage ? `
      '<div class="cam-wrap">' +
        '<video id="cluster-cam" autoplay playsinline muted></video>' +
        '<canvas id="cluster-cap" style="display:none"></canvas>' +
        '<div class="cam-overlay" id="cluster-ov">📷 Click Start Camera to begin</div>' +
      '</div>' +
      '<div class="cam-actions">' +
        '<button class="predict-btn" onclick="startClusterCam()">📷 Start Camera</button>' +
        '<button class="predict-btn" onclick="clusterFrame()">Find My Group ✨</button>' +
        '<label class="upload-btn">📁 Upload Photo<input type="file" accept="image/*" style="display:none" onchange="clusterUpload(this.files[0])"></label>' +
      '</div>' +` : `
      '<div class="input-area">' +
        '<textarea class="ai-textarea" id="cluster-input" placeholder="Type something here to find which group it belongs to…"></textarea>' +
        '<button class="predict-btn" onclick="clusterText()">Find My Group ✨</button>' +
      '</div>' +`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${icon}</text></svg>">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${safeTitle}">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="${t.acc}">${cdnScripts}
<style>
:root{--bg1:${t.bg1};--bg2:${t.bg2};--acc:${t.acc};--acc2:${t.acc2};--orb1:${t.orb1};--orb2:${t.orb2}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,var(--bg1) 0%,var(--bg2) 100%);color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;position:relative}
body::before{content:'';position:fixed;width:500px;height:500px;top:-150px;left:-150px;background:radial-gradient(circle,var(--orb1),transparent 70%);border-radius:50%;animation:float 8s ease-in-out infinite;pointer-events:none;z-index:0}
body::after{content:'';position:fixed;width:420px;height:420px;bottom:-100px;right:-100px;background:radial-gradient(circle,var(--orb2),transparent 70%);border-radius:50%;animation:float 10s ease-in-out infinite reverse;pointer-events:none;z-index:0}
.pt{position:fixed;pointer-events:none;animation:star-twinkle var(--dur) ease-in-out infinite;animation-delay:var(--dly);opacity:0.1;z-index:0}
header{background:rgba(18,14,42,0.9);border-bottom:1px solid rgba(255,255,255,0.07);padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);position:relative;z-index:10}
.h-left{display:flex;align-items:center;gap:1rem}
.h-icon{font-size:2rem;line-height:1}
.h-title{font-size:1.4rem;font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite}
.h-sub{font-size:0.7rem;color:rgba(255,255,255,0.28);margin-top:0.125rem}
.abita-badge{font-size:0.62rem;font-weight:800;color:rgba(167,139,250,0.75);border:1px solid rgba(167,139,250,0.2);padding:0.3rem 0.75rem;border-radius:9999px;letter-spacing:0.07em;background:rgba(139,92,246,0.07)}
main{flex:1;display:flex;flex-direction:column;align-items:center;gap:1.5rem;padding:2rem;max-width:660px;margin:0 auto;width:100%;position:relative;z-index:1}
.cluster-card{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:1.25rem;padding:1.5rem;display:flex;flex-direction:column;gap:1.125rem}
.card-title{font-size:1rem;font-weight:800;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.card-hint{font-size:0.73rem;color:rgba(255,255,255,0.32)}
.input-area{display:flex;flex-direction:column;gap:0.625rem}
.ai-textarea{width:100%;min-height:80px;padding:0.75rem 1rem;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:0.75rem;color:#fff;font-size:0.88rem;font-family:inherit;outline:none;resize:vertical;transition:border-color 0.2s}
.ai-textarea:focus{border-color:rgba(255,255,255,0.3)}
.ai-textarea::placeholder{color:rgba(255,255,255,0.2)}
.predict-btn{padding:0.55rem 1.25rem;border-radius:0.625rem;border:none;background:linear-gradient(90deg,var(--acc),var(--acc2));color:#fff;font-size:0.85rem;font-weight:800;font-family:inherit;cursor:pointer;transition:opacity 0.15s,transform 0.1s;align-self:flex-start}
.predict-btn:hover{opacity:0.9}
.predict-btn:active{transform:scale(0.97)}
.cam-wrap{position:relative;width:100%;max-width:400px;margin:0 auto;border-radius:1rem;overflow:hidden;background:#000;aspect-ratio:4/3}
.cam-wrap video{width:100%;height:100%;object-fit:cover;display:block}
.cam-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);font-size:0.85rem;color:rgba(255,255,255,0.6);text-align:center;padding:1rem}
.cam-actions{display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center}
.upload-btn{padding:0.55rem 1.25rem;border-radius:0.625rem;border:1.5px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.75);font-size:0.82rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.15s}
.upload-btn:hover{border-color:rgba(255,255,255,0.35);color:#fff}
.result-box{padding:1rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.875rem;display:flex;flex-direction:column;gap:0.75rem}
.result-group{font-size:1.4rem;font-weight:900;background:linear-gradient(90deg,var(--acc),var(--acc2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.result-conf{font-size:0.75rem;color:rgba(255,255,255,0.38)}
.cluster-pills{display:flex;flex-wrap:wrap;gap:0.5rem}
.cluster-pill{font-size:0.72rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:9999px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.55)}
.cluster-pill.active{background:linear-gradient(90deg,var(--acc)33,var(--acc2)33);border-color:rgba(255,255,255,0.25);color:#fff}
.waiting{font-size:0.78rem;color:rgba(255,255,255,0.22);font-style:italic}
.loading-bar{height:3px;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:2px;width:0%;transition:width 0.5s}
footer{text-align:center;padding:0.875rem;font-size:0.67rem;color:rgba(255,255,255,0.13);border-top:1px solid rgba(255,255,255,0.05);position:relative;z-index:1}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes star-twinkle{0%,100%{opacity:0.07}50%{opacity:var(--bright,0.55)}}
.splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;background:linear-gradient(135deg,var(--bg1),var(--bg2));transition:opacity 0.6s ease;pointer-events:auto}
.splash.hide{opacity:0;pointer-events:none}
.splash-icon{font-size:4rem;animation:spl-in 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s both}
.splash-title{font-size:2rem;font-weight:900;text-align:center;max-width:80vw;line-height:1.15;background:linear-gradient(90deg,var(--acc),var(--acc2),var(--acc));background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 3s linear infinite,spl-in 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both}
.splash-by{font-size:0.85rem;color:rgba(255,255,255,0.45);animation:spl-in 0.5s ease 0.55s both}
.splash-badge{font-size:0.65rem;font-weight:800;color:rgba(167,139,250,0.8);border:1px solid rgba(167,139,250,0.25);padding:0.3rem 0.8rem;border-radius:9999px;background:rgba(139,92,246,0.08);animation:spl-in 0.5s ease 0.75s both}
.splash-skip{position:absolute;top:1rem;right:1rem;font-size:0.7rem;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:inherit;transition:color 0.2s}
.splash-skip:hover{color:rgba(255,255,255,0.6)}
@keyframes spl-in{from{opacity:0;transform:scale(0.7) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
.toast-wrap{position:fixed;top:1rem;right:1rem;z-index:9998;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:240px}
.toast{background:rgba(18,14,42,0.92);border:1px solid rgba(255,255,255,0.1);border-radius:0.75rem;padding:0.55rem 1rem;font-size:0.78rem;font-weight:600;color:#fff;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);opacity:0;transform:translateX(110%);transition:opacity 0.3s,transform 0.3s;pointer-events:none}
.toast.show{opacity:1;transform:translateX(0)}
.snd-btn{background:none;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;color:rgba(255,255,255,0.4);font-size:0.8rem;padding:0.25rem 0.5rem;cursor:pointer;transition:all 0.2s;font-family:inherit}
.snd-btn:hover{border-color:rgba(255,255,255,0.3);color:rgba(255,255,255,0.8)}
#app-instructions{display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 2rem;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.07);position:relative;z-index:2}
.instr-icon{font-size:1.15rem;flex-shrink:0;opacity:.75;margin-top:.1rem}
.instr-title{font-size:0.63rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.3);margin-bottom:.2rem}
.instr-text{font-size:0.82rem;line-height:1.5;color:rgba(255,255,255,0.7);white-space:pre-wrap}
</style>
</head>
<body>
<div class="splash" id="splash">
  <button class="splash-skip" onclick="hideSplash()">Skip ›</button>
  <span class="splash-icon">${icon}</span>
  <div class="splash-title">${safeTitle}</div>
  ${safeCreator ? `<div class="splash-by">Made by ${safeCreator}</div>` : ''}
  <div class="splash-badge">⚡ Made with ABITA</div>
</div>
<div class="toast-wrap" id="toasts"></div>
<header>
  <div class="h-left">
    <span class="h-icon">${icon}</span>
    <div>
      <div class="h-title">${safeTitle}</div>
      <div class="h-sub">Cluster Explorer — Made with ABITA</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:0.5rem">
    <button class="snd-btn" id="snd-toggle" onclick="toggleSound()" title="Toggle sounds">🔊</button>
    <span class="abita-badge">⚡ ABITA</span>
  </div>
</header>
${safeInstructions ? `<section id="app-instructions"><span class="instr-icon">📋</span><div class="instr-body"><p class="instr-title">How this app works</p><p class="instr-text">${safeInstructions}</p></div></section>` : ''}
<main id="main-content"></main>
<footer>${safeCreator ? `Made by ${safeCreator} · ` : ''}Built with ABITA · AI Sandbox for Kids</footer>
<script>
function hideSplash(){var s=document.getElementById('splash');if(!s)return;s.classList.add('hide');setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s);},650);}
setTimeout(hideSplash,2500);
function showToast(msg){var w=document.getElementById('toasts');if(!w)return;var t=document.createElement('div');t.className='toast';t.textContent=msg;w.appendChild(t);requestAnimationFrame(function(){requestAnimationFrame(function(){t.classList.add('show');});});setTimeout(function(){t.classList.remove('show');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},400);},2800);}
var _soundOn=true,_actx=null;
function toggleSound(){_soundOn=!_soundOn;var b=document.getElementById('snd-toggle');if(b)b.textContent=_soundOn?'🔊':'🔇';}
function _getCtx(){if(!_actx){try{_actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return _actx;}
function _blip(freq,dur,type){var c=_getCtx();if(!c||!_soundOn)return;var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type||'sine';o.frequency.value=freq;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(0.15,c.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);o.start();o.stop(c.currentTime+dur);}

var CENTROIDS = ${centroidsJson};
var LABELS = ${labelsJson};
var VOCAB = ${vocabJson};
var IDF = ${idfJson};
var IS_IMAGE = ${isImage ? 'true' : 'false'};
var _mobileNet = null;
var _previewReady = false;

// Cosine similarity for nearest-centroid search
function cosSim(a, b) {
  var dot = 0, na = 0, nb = 0;
  for (var i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  var denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-9 ? 0 : dot / denom;
}

function nearestCentroid(vec) {
  var best = 0, bestSim = -Infinity;
  for (var c = 0; c < CENTROIDS.length; c++) {
    var s = cosSim(vec, CENTROIDS[c]);
    if (s > bestSim) { bestSim = s; best = c; }
  }
  // Build softmax-style confidence from similarities
  var sims = CENTROIDS.map(function(cent) { return cosSim(vec, cent); });
  var maxS = Math.max.apply(null, sims);
  var exps = sims.map(function(s) { return Math.exp((s - maxS) * 10); });
  var sum = exps.reduce(function(a, b) { return a + b; }, 0);
  var probs = exps.map(function(e) { return e / sum; });
  return { bestIdx: best, probs: probs };
}

function showClusterResult(bestIdx, probs) {
  var el = document.getElementById('cluster-result');
  if (!el) return;
  var bestLabel = LABELS[bestIdx];
  var conf = Math.round(probs[bestIdx] * 100);
  var pillsHtml = LABELS.map(function(lbl, i) {
    return '<span class="cluster-pill' + (i === bestIdx ? ' active' : '') + '">' + lbl + ' ' + Math.round(probs[i]*100) + '%</span>';
  }).join('');
  el.innerHTML =
    '<div class="result-box">' +
      '<div class="result-group">📍 ' + bestLabel + '</div>' +
      '<div class="result-conf">Similarity: ' + conf + '%</div>' +
      '<div class="cluster-pills">' + pillsHtml + '</div>' +
    '</div>';
  showToast('📍 Best match: ' + bestLabel);
  _blip(550, 0.18);
}

// ── Text clustering ──────────────────────────────────────────────────────────
function tokenize(t) { return t.toLowerCase().replace(/[^a-z0-9\\s]/g,' ').split(/\\s+/).filter(function(w){return w.length>1;}); }
function tfidfVec(text) {
  var tokens = tokenize(text);
  return VOCAB.map(function(w, j) {
    var count = tokens.filter(function(t) { return t === w; }).length;
    var tf = tokens.length > 0 ? count / tokens.length : 0;
    return tf * (IDF[j] || 0);
  });
}
function clusterText() {
  var text = document.getElementById('cluster-input').value || '';
  if (!text.trim()) { showToast('⚠ Type something first!'); return; }
  if (!VOCAB.length) { showToast('⚠ No vocabulary data'); return; }
  if (IDF.length !== VOCAB.length) { showToast('⚠ Model data incomplete — please retrain'); return; }
  var vec = tfidfVec(text);
  var res = nearestCentroid(vec);
  showClusterResult(res.bestIdx, res.probs);
}

// ── Image clustering ─────────────────────────────────────────────────────────
async function clusterFrame() {
  var canvasEl = document.getElementById('cluster-cap');
  if (!_mobileNet) { showToast('AI engine still loading…'); return; }
  if (!_previewReady) {
    // Live camera capture
    var videoEl = document.getElementById('cluster-cam');
    var ovEl = document.getElementById('cluster-ov');
    if (!videoEl || !videoEl.srcObject) { showToast('Start the camera first!'); return; }
    if (ovEl) ovEl.style.display = 'none';
    canvasEl.width = 224; canvasEl.height = 224;
    canvasEl.getContext('2d').drawImage(videoEl, 0, 0, 224, 224);
  }
  _previewReady = false;
  try {
    var imgTensor = tf.browser.fromPixels(canvasEl);
    var features = _mobileNet.infer(imgTensor, true);
    var vec = Array.from(await features.data());
    imgTensor.dispose(); features.dispose();
    var res = nearestCentroid(vec);
    showClusterResult(res.bestIdx, res.probs);
  } catch(e) { showToast('Prediction failed — try again'); }
}

function clusterUpload(file) {
  if (!_mobileNet) { showToast('AI engine still loading — please wait'); return; }
  var prevEl = document.getElementById('cluster-prev');
  var vidEl  = document.getElementById('cluster-cam');
  var ovEl   = document.getElementById('cluster-ov');
  var canEl  = document.getElementById('cluster-cap');
  if (prevEl && prevEl._url) URL.revokeObjectURL(prevEl._url);
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function() {
    canEl.width = 224; canEl.height = 224;
    canEl.getContext('2d').drawImage(img, 0, 0, 224, 224);
    if (prevEl) { prevEl._url = url; prevEl.src = url; prevEl.style.display = 'block'; }
    if (vidEl) vidEl.style.display = 'none';
    if (ovEl) ovEl.style.display = 'none';
    _previewReady = true;
    var resEl = document.getElementById('cluster-result');
    if (resEl) resEl.innerHTML = '<span class="waiting">Image ready! Press <strong>Find My Group ✨</strong></span>';
  };
  img.src = url;
}

function startClusterCam() {
  _previewReady = false;
  var prevEl = document.getElementById('cluster-prev');
  var videoEl = document.getElementById('cluster-cam');
  var ovEl = document.getElementById('cluster-ov');
  if (prevEl) prevEl.style.display = 'none';
  if (videoEl) videoEl.style.display = 'block';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) { videoEl.srcObject = stream; if (ovEl) ovEl.style.display = 'none'; })
    .catch(function() {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) { videoEl.srcObject = stream; if (ovEl) ovEl.style.display = 'none'; })
        .catch(function() { if (ovEl) ovEl.textContent = '⚠ Camera access denied — use Upload Photo instead'; });
    });
}

var PT_BG='${t.ptBg}',PT_W=${t.ptW},PT_H=${t.ptH},PT_RAD='${t.ptRad}';
(function initParticles(){
  for(var i=0;i<22;i++){
    var s=document.createElement('div');s.className='pt';
    s.style.cssText='background:'+PT_BG+';width:'+PT_W+'px;height:'+PT_H+'px;border-radius:'+PT_RAD
      +';top:'+(Math.random()*100).toFixed(1)+'%;left:'+(Math.random()*100).toFixed(1)+'%'
      +';--dur:'+(Math.random()*4+3).toFixed(1)+'s;--dly:'+(Math.random()*7).toFixed(1)+'s'
      +';--bright:'+(Math.random()*0.45+0.3).toFixed(2);
    document.body.appendChild(s);
  }
})();

function buildUI() {
  var container = document.getElementById('main-content');
  var clusterListHtml = LABELS.map(function(l, i) {
    return '<span class="cluster-pill">' + l + '</span>';
  }).join('');
  var inputHtml = IS_IMAGE ?
    '<div class="cam-wrap">' +
      '<video id="cluster-cam" autoplay playsinline muted></video>' +
      '<canvas id="cluster-cap" style="display:none"></canvas>' +
      '<img id="cluster-prev" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;background:#111" alt="" />' +
      '<div class="cam-overlay" id="cluster-ov">📷 Click Start Camera to begin</div>' +
    '</div>' +
    '<div class="cam-actions">' +
      '<button class="predict-btn" onclick="startClusterCam()">📷 Start Camera</button>' +
      '<button class="predict-btn" onclick="clusterFrame()">Find My Group ✨</button>' +
      '<label class="upload-btn">📁 Upload Photo<input type="file" accept="image/*" style="display:none" onchange="clusterUpload(this.files[0])"></label>' +
    '</div>'
    :
    '<div class="input-area">' +
      '<textarea class="ai-textarea" id="cluster-input" placeholder="Type something here to find which group it belongs to…"></textarea>' +
      '<button class="predict-btn" onclick="clusterText()">Find My Group ✨</button>' +
    '</div>';
  container.innerHTML =
    '<div class="cluster-card">' +
      '<div>' +
        '<div class="card-title">' + (IS_IMAGE ? '📷' : '📝') + ' ${model.name.replace(/'/g, "\\'")}</div>' +
        '<div class="card-hint">This model grouped things into ' + LABELS.length + ' clusters: ' + clusterListHtml + '</div>' +
      '</div>' +
      inputHtml +
      '<div id="cluster-result"><span class="waiting">' + (IS_IMAGE ? 'Point camera at something or upload a photo' : 'Type something above') + ', then click Find My Group ✨</span></div>' +
    '</div>';
  if (IS_IMAGE) {
    document.getElementById('init-status') && (document.getElementById('init-status').style.display = 'none');
  }
}

${isImage ? `
// Load MobileNet then build image UI
var initDiv = document.createElement('div');
initDiv.id = 'init-status';
initDiv.style.cssText = 'font-size:0.8rem;color:rgba(255,255,255,0.35);text-align:center;padding-top:1rem';
initDiv.innerHTML = '<div style="margin-bottom:0.5rem">Loading AI vision engine… (requires internet)</div><div class="loading-bar" id="init-bar"></div>';
document.getElementById('main-content').appendChild(initDiv);
mobilenet.load({ version: 2, alpha: 0.5 }).then(function(net) {
  _mobileNet = net;
  var s = document.getElementById('init-status');
  if (s) s.style.display = 'none';
  buildUI();
}).catch(function() {
  var s = document.getElementById('init-status');
  if (s) s.innerHTML = '<span style="color:rgba(255,80,80,0.8)">⚠ Could not load AI engine — check internet and reload</span>';
});` : `buildUI();`}
<\/script>
</body>
</html>`
}
