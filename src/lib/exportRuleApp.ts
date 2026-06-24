import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useModelStore } from '@/store/useModelStore'

export function validateExportSelection(selectedIds: Set<string>): {
  valid: boolean
  reason: 'ok' | 'no-outputs' | 'unconnected-output' | 'incomplete-chain' | 'untrained-model' | 'unsupported-model-type'
} {
  const rule = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const modelState = useModelStore.getState()

  // Early check: any selected condition using a model must be trained + text-supervised
  for (const cond of rule.conditionBlocks.filter(c => selectedIds.has(c.id) && c.linkedModelId)) {
    const mb = modelState.modelBlocks.find(b => b.id === cond.linkedModelId)
    if (!mb || mb.status !== 'trained' || !mb.trainedModelId) {
      return { valid: false, reason: 'untrained-model' }
    }
    if (mb.modelType !== 'text-supervised') {
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
        return !!mb?.liveLinkedSensorId && selectedIds.has(mb.liveLinkedSensorId)
      }
      return false
    }

    if (rule.switchBlocks.some(b => b.id === id)) return true
    if (rule.sensorBlocks.some(b => b.id === id)) return true

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
  reason: 'ok' | 'no-model' | 'untrained-model' | 'unsupported-type'
} {
  const modelState = useModelStore.getState()
  const selected = modelState.modelBlocks.filter(b => selectedIds.has(b.id))
  if (selected.length === 0) return { valid: false, reason: 'no-model' }
  for (const mb of selected) {
    if (mb.status !== 'trained' || !mb.trainedModelId) return { valid: false, reason: 'untrained-model' }
    if (mb.modelType !== 'text-supervised') return { valid: false, reason: 'unsupported-type' }
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
    models,
  }

  const html = buildHTML(appName, data, THEMES[theme], layout)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${appName.replace(/\s+/g, '-').toLowerCase()}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildHTML(appName: string, data: object, t: typeof THEMES[Theme], layout: Layout): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const dataJson = JSON.stringify(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
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
</style>
</head>
<body>
<header>
  <div class="h-left">
    <span class="h-icon">🤖</span>
    <div>
      <div class="h-title">${safeTitle}</div>
      <div class="h-sub">AI Sandbox for Kids</div>
    </div>
  </div>
  <span class="abita-badge">⚡ ABITA</span>
</header>
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
<footer>Built with ABITA · AI Sandbox for Kids</footer>
<script>
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
};

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
  var vi={};
  m.vocab.forEach(function(w,i){vi[w]=i;});
  var tokens=tokenizeNB(text);
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
  return false;
}
function evaluate(){
  for(var i=0;i<state.conditions.length;i++){
    var c=state.conditions[i];
    if(c.linkedModelId){
      var m=APP.models.find(function(m){return m.id===c.linkedModelId;});
      var text=m&&m.liveSensorId?((document.getElementById('sv-'+m.liveSensorId)||{}).value||''):'';
      c._out=runNB(c.linkedModelId,text)===c.modelCondition;
    } else {
      var sen=state.sensors.find(function(s){return s.id===c.linkedSensorId});
      c._out=sen?evalCond(sen.value,c.operator,c.threshold):false;
    }
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
  for(var i=0;i<state.bulbs.length;i++){
    var b=state.bulbs[i]; var el=document.getElementById('out-'+b.id); if(!el) continue;
    el.className='out-card bulb-card'+(b._on?' on':'');
    document.getElementById('st-'+b.id).textContent=b._on?'● ON':'○ OFF';
  }
  for(var i=0;i<state.fans.length;i++){
    var f=state.fans[i]; var el=document.getElementById('out-'+f.id); if(!el) continue;
    el.className='out-card fan-card'+(f._on?' on':'');
    document.getElementById('st-'+f.id).textContent=f._on?'● SPINNING':'○ OFF';
  }
  for(var i=0;i<state.doors.length;i++){
    var d=state.doors[i]; var el=document.getElementById('out-'+d.id); if(!el) continue;
    el.className='out-card door-card'+(d._open?' on':'');
    var dp=document.getElementById('dp-'+d.id); if(dp) dp.classList.toggle('open',d._open);
    document.getElementById('st-'+d.id).textContent=d._open?'● OPEN':'○ CLOSED';
  }
  for(var i=0;i<state.alarms.length;i++){
    var a=state.alarms[i]; var el=document.getElementById('out-'+a.id); if(!el) continue;
    el.className='out-card alarm-card'+(a._on?' on':'');
    document.getElementById('st-'+a.id).textContent=a._on?'● ACTIVE':'○ OFF';
  }
  for(var i=0;i<state.acs.length;i++){
    var a=state.acs[i]; var el=document.getElementById('out-'+a.id); if(!el) continue;
    el.className='out-card ac-card'+(a._on?' on':'');
    document.getElementById('st-'+a.id).textContent=a._on?'● COOLING':'○ OFF';
  }
}
function refresh(){ evaluate(); updateOutputs(); }

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
    var card=document.createElement('div'); card.className='in-card';
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
    var card=document.createElement('div'); card.className='in-card';
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

var outCont=document.getElementById('output-cards');
var hasOut=state.bulbs.length||state.fans.length||state.doors.length||state.alarms.length||state.acs.length;
if(!hasOut){ outCont.innerHTML='<p class="empty-hint">No outputs connected.</p>'; }

for(var bi=0;bi<state.bulbs.length;bi++){
  var b=state.bulbs[bi];
  var el=document.createElement('div'); el.id='out-'+b.id; el.className='out-card bulb-card';
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

refresh();
<\/script>
</body>
</html>`
}

// ── Standalone AI Model Export ──────────────────────────────────────────────

export function exportAIModel(
  appName = 'My AI Model',
  selectedIds?: Set<string>,
  theme: Theme = 'space',
): void {
  const keep = (id: string) => !selectedIds || selectedIds.has(id)
  const modelState = useModelStore.getState()

  const models = modelState.modelBlocks
    .filter(b => keep(b.id) && b.modelType === 'text-supervised' && b.trainedModelId)
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

  const html = buildAIModelHTML(appName, models, THEMES[theme])
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
): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const modelsJson = JSON.stringify(models)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
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
</style>
</head>
<body>
<header>
  <div class="h-left">
    <span class="h-icon">🧠</span>
    <div>
      <div class="h-title">${safeTitle}</div>
      <div class="h-sub">AI Model — Made with ABITA</div>
    </div>
  </div>
  <span class="abita-badge">⚡ ABITA</span>
</header>
<main id="cards"></main>
<footer>Built with ABITA · AI Sandbox for Kids</footer>
<script>
var MODELS = ${modelsJson};

function tokenizeNB(t){
  return t.toLowerCase().replace(/[^a-z0-9\\s]/g,' ').split(/\\s+/).filter(function(w){return w.length>1;});
}
function runNBFull(modelId,text){
  var m=MODELS.find(function(m){return m.id===modelId;});
  if(!m||!m.vocab.length) return null;
  var vi={};
  m.vocab.forEach(function(w,i){vi[w]=i;});
  var tokens=tokenizeNB(text);
  var scores=[];
  for(var li=0;li<m.labels.length;li++){
    var lid=m.labelIds[li];
    var s=(m.classLogPriors[lid]||0);
    for(var ti=0;ti<tokens.length;ti++){
      var idx=vi[tokens[ti]];
      if(idx!==undefined&&m.wordLogProbs[lid]) s+=m.wordLogProbs[lid][idx];
    }
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
