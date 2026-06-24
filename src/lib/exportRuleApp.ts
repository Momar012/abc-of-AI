import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'

export function exportRuleApp(appName = 'My AI App', selectedIds?: Set<string>): void {
  const rule = useRuleStore.getState()
  const workflow = useWorkflowStore.getState()
  const keep = (id: string) => !selectedIds || selectedIds.has(id)

  const data = {
    sensors: rule.sensorBlocks.filter(s => keep(s.id)).map(s => ({
      id: s.id, name: s.name, sensorType: s.sensorType,
      value: s.value, min: s.min ?? 0, max: s.max ?? 100, unit: s.unit ?? '',
    })),
    switches: rule.switchBlocks.filter(s => keep(s.id)).map(s => ({
      id: s.id, name: s.name, isOn: s.isOn,
    })),
    conditions: rule.conditionBlocks.filter(c => keep(c.id)).map(c => ({
      id: c.id, name: c.name, linkedSensorId: c.linkedSensorId,
      operator: c.operator, threshold: c.threshold,
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
  }

  const html = buildHTML(appName, data)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${appName.replace(/\s+/g, '-').toLowerCase()}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildHTML(appName: string, data: object): string {
  const safeTitle = appName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const dataJson = JSON.stringify(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Made with ABITA</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0c0a1e;color:#e2e8f0;min-height:100vh;display:flex;flex-direction:column}
header{background:rgba(30,27,75,0.92);border-bottom:1px solid rgba(255,255,255,0.1);padding:1rem 1.5rem;display:flex;align-items:center;gap:0.875rem;backdrop-filter:blur(20px)}
.header-icon{font-size:2rem;line-height:1}
.header-title{font-size:1.25rem;font-weight:800;background:linear-gradient(135deg,#a78bfa,#2dd4bf);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.header-sub{font-size:0.75rem;color:rgba(255,255,255,0.35);margin-top:0.125rem}
main{flex:1;display:grid;grid-template-columns:1fr auto 1fr;gap:0;padding:2rem;max-width:960px;margin:0 auto;width:100%}
@media(max-width:640px){main{grid-template-columns:1fr;padding:1rem}}
.panel{display:flex;flex-direction:column;gap:1rem}
.panel-title{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.3);margin-bottom:0.25rem}
.arrow{display:flex;align-items:center;justify-content:center;padding:0 1.5rem;font-size:1.5rem;color:rgba(255,255,255,0.15)}
@media(max-width:640px){.arrow{padding:0.5rem 0;transform:rotate(90deg)}}
.card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:0.875rem;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:0.625rem}
.card-name{font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.6);display:flex;align-items:center;gap:0.4rem}

/* Sliders */
.slider-wrap{display:flex;flex-direction:column;gap:0.4rem}
.slider-val{font-size:1.25rem;font-weight:700;color:#fff}
input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:9999px;background:rgba(255,255,255,0.12);outline:none;cursor:pointer}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#2dd4bf);cursor:pointer;box-shadow:0 0 8px rgba(139,92,246,0.5)}

/* Toggle buttons */
.toggle-btn{padding:0.5rem 1.25rem;border-radius:9999px;border:1.5px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s;text-align:center}
.toggle-btn.active{background:linear-gradient(135deg,rgba(139,92,246,0.3),rgba(45,212,191,0.2));border-color:rgba(139,92,246,0.6);color:#fff;box-shadow:0 0 12px rgba(139,92,246,0.25)}

/* Text input */
.text-inp{width:100%;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.15);border-radius:0.5rem;color:#fff;font-size:0.9rem;outline:none;transition:border-color 0.2s}
.text-inp:focus{border-color:rgba(139,92,246,0.6)}
.text-inp::placeholder{color:rgba(255,255,255,0.25)}

/* Output cards */
.out-card{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);border-radius:0.875rem;padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;transition:all 0.3s}
.out-card.on{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.18)}
.out-icon{font-size:1.75rem;line-height:1;transition:all 0.3s;flex-shrink:0}
.out-info{flex:1}
.out-name{font-size:0.8rem;font-weight:600;color:rgba(255,255,255,0.5)}
.out-state{font-size:1rem;font-weight:700;color:rgba(255,255,255,0.25);margin-top:0.125rem;transition:color 0.3s}
.out-card.on .out-state{color:#fff}

/* Bulb */
.out-card.bulb.on .out-icon{filter:drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 20px #f59e0b)}
.out-card.bulb.on .out-state{color:#fbbf24}

/* Fan */
@keyframes spin{to{transform:rotate(360deg)}}
.out-card.fan.on .out-icon{animation:spin 0.8s linear infinite}
.out-card.fan.on .out-state{color:#2dd4bf}

/* Alarm */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.out-card.alarm.on .out-icon{animation:pulse 0.6s ease-in-out infinite}
.out-card.alarm.on{border-color:rgba(239,68,68,0.5);background:rgba(239,68,68,0.08)}
.out-card.alarm.on .out-state{color:#f87171}

/* AC */
.out-card.ac.on .out-icon{filter:drop-shadow(0 0 8px #60a5fa)}
.out-card.ac.on .out-state{color:#60a5fa}

/* Door */
.out-card.door.on .out-state{color:#34d399}

footer{text-align:center;padding:1rem;font-size:0.7rem;color:rgba(255,255,255,0.18);border-top:1px solid rgba(255,255,255,0.06)}
.empty-hint{color:rgba(255,255,255,0.2);font-size:0.8rem;font-style:italic;padding:0.5rem 0}
</style>
</head>
<body>
<header>
  <span class="header-icon">🤖</span>
  <div>
    <div class="header-title">${safeTitle}</div>
    <div class="header-sub">Made with ABITA · AI Sandbox for Kids</div>
  </div>
</header>
<main>
  <div class="panel" id="inputs-panel">
    <div class="panel-title">⬇️ Inputs</div>
    <div id="input-cards"></div>
  </div>
  <div class="arrow">→</div>
  <div class="panel" id="outputs-panel">
    <div class="panel-title">⬆️ Outputs</div>
    <div id="output-cards" style="display:flex;flex-direction:column;gap:0.75rem"></div>
  </div>
</main>
<footer>Built with ABITA · AI Sandbox for Kids</footer>
<script>
const APP = ${dataJson};

// ── Mutable state ─────────────────────────────────────────
const state = {
  sensors:    APP.sensors.map(s => Object.assign({}, s)),
  switches:   APP.switches.map(s => Object.assign({}, s)),
  conditions: APP.conditions.map(c => Object.assign({}, c, {_out: false})),
  logic:      APP.logic.map(l => Object.assign({}, l, {_out: false})),
  fans:   APP.fans.map(x => Object.assign({}, x, {_on: false})),
  alarms: APP.alarms.map(x => Object.assign({}, x, {_on: false})),
  acs:    APP.acs.map(x => Object.assign({}, x, {_on: false})),
  bulbs:  APP.bulbs.map(x => Object.assign({}, x, {_on: false})),
  doors:  APP.doors.map(x => Object.assign({}, x, {_open: false})),
};

// ── Evaluation engine ─────────────────────────────────────
function evalCond(value, op, threshold) {
  switch(op) {
    case '>':        return Number(value) > Number(threshold);
    case '<':        return Number(value) < Number(threshold);
    case '>=':       return Number(value) >= Number(threshold);
    case '<=':       return Number(value) <= Number(threshold);
    case '==':       return String(value) === String(threshold);
    case '!=':       return String(value) !== String(threshold);
    case 'contains': return String(value).toLowerCase().includes(String(threshold).toLowerCase());
    case 'is':       return value === threshold;
    default:         return false;
  }
}

function getOut(id) {
  if (!id) return false;
  const c = state.conditions.find(x => x.id === id); if (c) return c._out;
  const s = state.switches.find(x => x.id === id);   if (s) return s.isOn;
  const l = state.logic.find(x => x.id === id);       if (l) return l._out;
  return false;
}

function evaluate() {
  for (const c of state.conditions) {
    const sensor = state.sensors.find(s => s.id === c.linkedSensorId);
    c._out = sensor ? evalCond(sensor.value, c.operator, c.threshold) : false;
  }
  for (let i = 0; i < 5; i++) {
    for (const l of state.logic) {
      const [a, b] = l.inputs;
      if (l.logicType === 'and')  l._out = (a && b) ? getOut(a) && getOut(b) : false;
      else if (l.logicType === 'or')  l._out = a ? getOut(a) || (b ? getOut(b) : false) : false;
      else if (l.logicType === 'not') l._out = a ? !getOut(a) : true;
    }
  }
  for (const x of [...state.fans, ...state.alarms, ...state.acs, ...state.bulbs])
    x._on = x.linkedRuleBlockId ? getOut(x.linkedRuleBlockId) : false;
  for (const d of state.doors)
    d._open = d.linkedRuleBlockId ? getOut(d.linkedRuleBlockId) : false;
}

// ── UI update ─────────────────────────────────────────────
function updateOutputs() {
  for (const b of state.bulbs) {
    const el = document.getElementById('out-'+b.id);
    if (!el) continue;
    el.className = 'out-card bulb' + (b._on ? ' on' : '');
    el.querySelector('.out-state').textContent = b._on ? '💡 ON' : 'OFF';
  }
  for (const f of state.fans) {
    const el = document.getElementById('out-'+f.id);
    if (!el) continue;
    el.className = 'out-card fan' + (f._on ? ' on' : '');
    el.querySelector('.out-state').textContent = f._on ? 'SPINNING' : 'OFF';
  }
  for (const d of state.doors) {
    const el = document.getElementById('out-'+d.id);
    if (!el) continue;
    el.className = 'out-card door' + (d._open ? ' on' : '');
    el.querySelector('.out-state').textContent = d._open ? 'OPEN' : 'CLOSED';
  }
  for (const a of state.alarms) {
    const el = document.getElementById('out-'+a.id);
    if (!el) continue;
    el.className = 'out-card alarm' + (a._on ? ' on' : '');
    el.querySelector('.out-state').textContent = a._on ? '🚨 ACTIVE' : 'OFF';
  }
  for (const a of state.acs) {
    const el = document.getElementById('out-'+a.id);
    if (!el) continue;
    el.className = 'out-card ac' + (a._on ? ' on' : '');
    el.querySelector('.out-state').textContent = a._on ? '❄️ COOLING' : 'OFF';
  }
}

function refresh() { evaluate(); updateOutputs(); }

// ── Input UI builder ──────────────────────────────────────
const inputContainer = document.getElementById('input-cards');
inputContainer.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem';

const SENSOR_ICONS = {
  temperature:'🌡️', light:'☀️', motion:'👁️', humidity:'💧', 'text-input':'📝'
};
const SENSOR_UNITS = {
  temperature:'°C', light:'%', motion:'', humidity:'%', 'text-input':''
};

function setVal(id, val) {
  const s = state.sensors.find(x => x.id === id);
  if (s) { s.value = val; refresh(); }
}
function setSw(id, val) {
  const s = state.switches.find(x => x.id === id);
  if (s) { s.isOn = val; refresh(); }
}

if (state.sensors.length === 0 && state.switches.length === 0) {
  inputContainer.innerHTML = '<p class="empty-hint">No inputs in this app.</p>';
}

for (const sensor of state.sensors) {
  const icon = SENSOR_ICONS[sensor.sensorType] || '📡';
  const card = document.createElement('div');
  card.className = 'card';

  if (sensor.sensorType === 'motion') {
    const isActive = sensor.value === true || sensor.value === 'true';
    card.innerHTML =
      '<div class="card-name">' + icon + ' ' + sensor.name + '</div>' +
      '<button id="btn-'+sensor.id+'" class="toggle-btn' + (isActive ? ' active' : '') + '" onclick="' +
        'const s=state.sensors.find(x=>x.id===\\''+sensor.id+'\\');' +
        'const nv=!(s.value===true||s.value===\\'true\\');' +
        's.value=nv;' +
        'this.textContent=nv?\\'👁️ Motion Detected\\':\\'No Motion\\';' +
        'this.className=\\'toggle-btn\\'+(nv?\\' active\\':\\'\\');' +
        'refresh()" >' +
      (isActive ? '👁️ Motion Detected' : 'No Motion') + '</button>';
  } else if (sensor.sensorType === 'text-input') {
    card.innerHTML =
      '<div class="card-name">' + icon + ' ' + sensor.name + '</div>' +
      '<input class="text-inp" type="text" placeholder="Type here…" value="' + String(sensor.value || '') + '" ' +
        'oninput="setVal(\\''+sensor.id+'\\',this.value)" />';
  } else {
    const min = sensor.min ?? 0;
    const max = sensor.max ?? 100;
    const val = Number(sensor.value) || 0;
    const unit = sensor.unit || SENSOR_UNITS[sensor.sensorType] || '';
    card.innerHTML =
      '<div class="card-name">' + icon + ' ' + sensor.name + '</div>' +
      '<div class="slider-wrap">' +
        '<div class="slider-val" id="lbl-'+sensor.id+'">' + val + ' ' + unit + '</div>' +
        '<input type="range" min="'+min+'" max="'+max+'" value="'+val+'" ' +
          'oninput="document.getElementById(\\'lbl-'+sensor.id+'\\').textContent=this.value+\\' '+unit+'\\';setVal(\\''+sensor.id+'\\',Number(this.value))" />' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:rgba(255,255,255,0.25)">' +
          '<span>'+min+unit+'</span><span>'+max+unit+'</span>' +
        '</div>' +
      '</div>';
  }
  inputContainer.appendChild(card);
}

for (const sw of state.switches) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML =
    '<div class="card-name">🎚️ ' + sw.name + '</div>' +
    '<button id="btn-'+sw.id+'" class="toggle-btn' + (sw.isOn ? ' active' : '') + '" onclick="' +
      'const s=state.switches.find(x=>x.id===\\''+sw.id+'\\');' +
      's.isOn=!s.isOn;' +
      'this.textContent=s.isOn?\\'ON\\':\\'OFF\\';' +
      'this.className=\\'toggle-btn\\'+(s.isOn?\\' active\\':\\'\\');' +
      'refresh()">' +
    (sw.isOn ? 'ON' : 'OFF') +
    '</button>';
  inputContainer.appendChild(card);
}

// ── Output UI builder ─────────────────────────────────────
const outputContainer = document.getElementById('output-cards');

const OUT_DEFS = [
  ...state.bulbs.map(x  => ({...x, kind:'bulb',  icon:'💡', label: x.name})),
  ...state.fans.map(x   => ({...x, kind:'fan',   icon:'🌀', label: x.name})),
  ...state.doors.map(x  => ({...x, kind:'door',  icon:'🚪', label: x.name})),
  ...state.alarms.map(x => ({...x, kind:'alarm', icon:'🚨', label: x.name})),
  ...state.acs.map(x    => ({...x, kind:'ac',    icon:'❄️', label: x.name})),
];

if (OUT_DEFS.length === 0) {
  outputContainer.innerHTML = '<p class="empty-hint">No outputs in this app.</p>';
}

for (const def of OUT_DEFS) {
  const el = document.createElement('div');
  el.id = 'out-' + def.id;
  el.className = 'out-card ' + def.kind;
  el.innerHTML =
    '<div class="out-icon">' + def.icon + '</div>' +
    '<div class="out-info">' +
      '<div class="out-name">' + def.label + '</div>' +
      '<div class="out-state">OFF</div>' +
    '</div>';
  outputContainer.appendChild(el);
}

// ── Initial evaluation ────────────────────────────────────
refresh();
<\/script>
</body>
</html>`
}
