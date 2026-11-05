import { GuideKind, KINDS, kindFromName } from './blocks'

/**
 * Turns a Guided Lab's "## Instructions" (markdown written for kids) into checkable actions,
 * e.g. "Connect the **IF Condition** to the **Fan**." → { type: 'connect', from: 'condition', to: 'fan' }.
 * Lines we can't check become 'manual' (the kid taps ✓ Done).
 */

export type LabAction =
  | { type: 'add'; kind: GuideKind; n: number }
  | { type: 'connect'; from: GuideKind; to: GuideKind; n: number }
  | { type: 'props'; kind: GuideKind }
  | { type: 'switch'; on: boolean; n: number }
  | { type: 'motion'; detected: boolean }
  | { type: 'sensorValue'; kind: GuideKind; value: number }
  | { type: 'text'; value: string }
  | { type: 'condOp'; op: string; value?: string | number | boolean }
  | { type: 'condValue'; value: string | number | boolean }
  | { type: 'manual' }

export interface LabLine {
  /** The line as kids read it (markdown bold removed). */
  text: string
  /** The same line with its **bold** kept, for showing. */
  md: string
  /** Follow-up lines of the same step ("Observe the result. The Alarm should stay silent."), shown smaller. */
  note?: string
  action: LabAction
}

const bolds = (line: string) => Array.from(line.matchAll(/\*\*(.+?)\*\*/g)).map((m) => m[1].trim())
const plain = (line: string) => line.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
/** "IF Condition-->**X**" → "IF Condition → **X**", "**NOT Gate**from" → "**NOT Gate** from". */
const tidy = (line: string) =>
  line
    .replace(/\s*(?:-->|—>|–>|->|→)\s*/g, ' → ')
    .replace(/\*\*([^*]+?)\*\*(?=[A-Za-z])/g, '**$1** ')
    .replace(/\s+/g, ' ')
    .trim()

// ── sections ─────────────────────────────────────────────────────────────────

export interface LabSections {
  /** Text before the first "##" heading. */
  intro: string
  goal: string
  problem: string
  instructions: string
  /** One item per ✅ line / bullet of "Expected Result" or "Success Criteria". */
  expected: string[]
  /** One item per line of "What You Learned". */
  learned: string[]
  /** Every other section (Learning Tip, Think Like an AI Engineer, …), as markdown with its heading. */
  rest: string
}

type SectionKey = 'goal' | 'problem' | 'instructions' | 'expected' | 'learned'

/** "## 🎯 Goal" / "## Objective" → 'goal', "## ✅ Success Criteria" → 'expected', … */
function sectionKey(heading: string): SectionKey | null {
  const h = heading.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (h === 'goal' || h === 'objective' || h === 'goals' || h === 'objectives') return 'goal'
  if (h === 'problem') return 'problem'
  if (h === 'instructions') return 'instructions'
  if (/^(expected results?|success criteria)$/.test(h)) return 'expected'
  if (h === 'what you learned') return 'learned'
  return null
}

const listItems = (body: string) =>
  body
    .split('\n')
    .map((l) => l.trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/^✅\s*/, '').trim())
    .filter(Boolean)

/** Split a Guided Lab's markdown into the parts the lab card shows in its own places. */
export function splitLab(md: string): LabSections {
  const bodies: Record<SectionKey, string[]> = { goal: [], problem: [], instructions: [], expected: [], learned: [] }
  const intro: string[] = []
  const rest: string[] = []
  let cur: string[] = intro
  let inFence = false
  for (const raw of md.split('\n')) {
    if (raw.trim().startsWith('```')) inFence = !inFence
    const m = !inFence && raw.match(/^##\s+(.+)$/)
    if (m) {
      const key = sectionKey(m[1])
      if (key) cur = bodies[key]
      else {
        cur = rest
        rest.push(raw)
      }
      continue
    }
    cur.push(raw)
  }
  // Lessons often have runs of blank lines; one blank line is enough on a kid's screen.
  const join = (a: string[]) => a.join('\n').replace(/\n[ \t]*(\n[ \t]*)+/g, '\n\n').trim()
  return {
    intro: join(intro),
    goal: join(bodies.goal),
    problem: join(bodies.problem),
    instructions: join(bodies.instructions),
    expected: listItems(join(bodies.expected)),
    learned: listItems(join(bodies.learned)),
    rest: join(rest),
  }
}

/** Lines that start a new action, even in the middle of a Step. */
const ACTION_START =
  /^(drag|add|connect|double-click|configure|set|type|enter|turn|click|go to|now type|change|trigger|move|select|open|rename|press)\b/i

/** One instruction: a line of text, or the arrows of a ```diagram block ("Switch → OR Gate"). */
type RawInstruction = { line: string; note?: string } | { arrows: Array<[string, string]> }

/** Pull just the instruction lines out of the lab markdown. */
function instructionLines(md: string): RawInstruction[] {
  const out: RawInstruction[] = []
  let fence: Array<[string, string]> | null = null
  let joinNext = false
  /** Lines pushed since the last "**Step N:**" marker (-1 = the lab has no Step markers). */
  let inStep = -1
  for (const raw of splitLab(md).instructions.split('\n')) {
    const l = raw.trim()
    if (l.startsWith('```')) {
      if (fence) {
        if (fence.length) out.push({ arrows: fence })
        fence = null
      } else {
        // "Connect:" right before a diagram is just its label.
        const last = out.at(-1)
        if (last && 'line' in last && /^connect\s*:?$/i.test(plain(last.line))) out.pop()
        fence = []
      }
      joinNext = false
      continue
    }
    if (fence) {
      const parts = l.split(/\s*(?:→|->)\s*/)
      if (parts.length === 2 && parts[0] && parts[1]) fence.push([parts[0], parts[1]])
      continue
    }
    if (!l || l.startsWith('✅')) continue
    // "**Step 1:**" on its own line, or "**Step 1:** Drag …" — keep only the instruction text.
    const body = l
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^\*\*\s*Step\s*\d+\s*:?\s*\*\*\s*/i, '')
      .trim()
    const isMarker = /^\**\s*Step\s*\d+\s*:?\s*\**$/i.test(body) || !body
    if (isMarker) {
      joinNext = false
      inStep = 0
      continue
    }
    const last = out.at(-1)
    // A bold "**Text Input → IF Condition**" line is a connection, like a diagram arrow.
    const arrow = body.match(/^\*\*([^*]+?)\s*(?:→|->)\s*([^*]+?)\*\*$/)
    if (arrow) {
      if (last && 'arrows' in last && inStep > 0) last.arrows.push([arrow[1].trim(), arrow[2].trim()])
      else {
        if (last && 'line' in last && /^connect\s*:?$/i.test(plain(last.line))) out.pop()
        out.push({ arrows: [[arrow[1].trim(), arrow[2].trim()]] })
      }
      joinNext = false
      if (inStep >= 0) inStep++
      continue
    }
    // "Configure the **IF Condition**:" + "**Light Level > 70%**" on the next line → one step.
    // Inside a Step, "Observe the result." / "The Alarm should …" just add to the step's line.
    const followUp = inStep > 0 && last && 'line' in last && !ACTION_START.test(plain(body))
    if (joinNext && last && 'line' in last) last.line = `${last.line} ${body}`
    else if (followUp && last && 'line' in last) last.note = last.note ? `${last.note} ${body}` : body
    else out.push({ line: body })
    joinNext = /(:|→|->)\s*\**$/.test(body)
    if (inStep >= 0) inStep++
  }
  return out
}

const countWord = (s: string) =>
  /\ball three\b|\bthree\b/i.test(s) ? 3 : /\bboth\b|\btwo\b/i.test(s) ? 2 : 1

function parseCondition(expr: string): { op: string; value: string | number | boolean } | null {
  const e = expr.trim()
  // "Contains: MONEY", "Equals: Pakistan"
  const named = e.match(/^(contains|equals)\s*:?\s+(.+)$/i)
  if (named) return { op: named[1].toLowerCase() === 'contains' ? 'contains' : '==', value: named[2].trim() }
  if (/^motion detected$/i.test(e)) return { op: 'is', value: true }
  if (/^no motion$/i.test(e)) return { op: 'is', value: false }
  const m = e.match(/(>=|<=|!=|==|=|>|<)\s*(.+)$/)
  if (!m) return null
  const op = m[1] === '=' ? '==' : m[1]
  const num = parseFloat(m[2])
  return { op, value: Number.isNaN(num) ? m[2].replace(/[°C]+$/g, '').trim() : num }
}

export function parseLab(md: string): LabLine[] {
  const adds: Partial<Record<GuideKind, number>> = {}
  const links: Record<string, number> = {}
  const result: LabLine[] = []
  const connect = (from: GuideKind, to: GuideKind, n = 1): LabAction => {
    const key = `${from}>${to}`
    links[key] = (links[key] ?? 0) + n
    return { type: 'connect', from, to, n: links[key] }
  }

  for (const item of instructionLines(md)) {
    if ('arrows' in item) {
      // A diagram often repeats a link an earlier step already asked for — only new links count.
      const before = new Set(Object.keys(links))
      for (const [a, b] of item.arrows) {
        const from = kindFromName(a)
        const to = kindFromName(b)
        const md = `Connect **${a}** to **${b}**.`
        if (!from || !to) {
          result.push({ text: plain(md), md, action: { type: 'manual' } })
          continue
        }
        if (before.has(`${from}>${to}`)) continue
        result.push({ text: plain(md), md, action: connect(from, to) })
      }
      continue
    }

    const line = tidy(item.line)
    const text = plain(line)
    const names = bolds(line)
    const kinds = names.map(kindFromName)
    let action: LabAction = { type: 'manual' }

    if (/^(drag|add)\b/i.test(text) && kinds.some(Boolean)) {
      const kind = kinds.find(Boolean)!
      adds[kind] = (adds[kind] ?? 0) + 1
      action = { type: 'add', kind, n: adds[kind]! }
      // "Drag an IF Condition and connect with the Temperature Sensor" → two steps.
      const split = line.search(/\s+and connect\b/i)
      const otherAt = kinds.findIndex((k) => k && k !== kind)
      if (split > 0 && otherAt >= 0) {
        const other = kinds[otherAt]!
        const addMd = `${line.slice(0, split)}.`
        result.push({ text: plain(addMd), md: addMd, action })
        const intoAdded = !!KINDS[kind].in && !!KINDS[other].out
        const addedName = names[kinds.indexOf(kind)]
        const otherName = names[otherAt]
        const md = intoAdded ? `Connect the **${otherName}** to the **${addedName}**.` : `Connect the **${addedName}** to the **${otherName}**.`
        result.push({ text: plain(md), md, action: intoAdded ? connect(other, kind) : connect(kind, other) })
        continue
      }
    } else if (/^connect\b/i.test(text)) {
      // Split on the last " to " in the raw line, and sort the bold names by which side they're on.
      const toIdx = line.toLowerCase().lastIndexOf(' to ')
      const before = plain(line.slice(0, toIdx))
      const after = plain(line.slice(toIdx))
      const positioned = Array.from(line.matchAll(/\*\*(.+?)\*\*/g)).map((m) => ({ name: m[1].trim(), at: m.index ?? 0 }))
      const fromKinds = positioned.filter((p) => p.at < toIdx).map((p) => kindFromName(p.name)).filter(Boolean) as GuideKind[]
      const toKind = positioned.filter((p) => p.at > toIdx).map((p) => kindFromName(p.name)).filter(Boolean).at(-1) as GuideKind | undefined
      const from = fromKinds[0]
      if (from && toKind) {
        action = connect(from, toKind, Math.max(fromKinds.length, countWord(before), countWord(after)))
      }
    } else if (/move the slider to|slider to/i.test(text)) {
      const v = parseFloat((text.match(/slider to\s*(-?\d+(\.\d+)?)/i) ?? [])[1] ?? '')
      const kind: GuideKind = /humidity/i.test(text) ? 'sensor-humidity' : /light/i.test(text) ? 'sensor-light' : 'sensor-temperature'
      if (!Number.isNaN(v)) action = { type: 'sensorValue', kind, value: v }
    } else if (/^double-click/i.test(text)) {
      const kind = kinds.find(Boolean)
      if (/no motion/i.test(text)) action = { type: 'motion', detected: false }
      else if (/motion detected/i.test(text)) action = { type: 'motion', detected: true }
      else if (kind) action = { type: 'props', kind }
    } else if (/^configure\b/i.test(text) && names.length) {
      // "Configure the IF Condition --> Temperature > 30°C" / "Configure it as: Contains: MONEY" set the
      // condition; plain "Configure the IF Condition" just opens it.
      const kind = kinds.find(Boolean)
      const c = names.length > 1 || !kind ? parseCondition(names.at(-1)!) : null
      if (c) action = { type: 'condOp', op: c.op, value: c.value }
      else if (kind) action = { type: 'props', kind }
    } else if (/^turn\b/i.test(text) && /switch/i.test(text)) {
      const on = /\bON\b/.test(text)
      action = { type: 'switch', on, n: on ? countWord(text) : 1 }
    } else if (/^(change|trigger|click)\b/i.test(text) && /motion/i.test(text)) {
      // "Change the Motion Sensor to Motion Detected", "Trigger Motion", "Click the No Motion button…"
      action = { type: 'motion', detected: !/to\s+no motion/i.test(text) }
    } else if (/^set the (if )?condition to/i.test(text)) {
      const expr = names.at(-1) ?? text.replace(/^set the (if )?condition to\s*(→|->)?/i, '')
      const c = parseCondition(expr)
      if (c) action = { type: 'condOp', op: c.op, value: c.value }
    } else if (/dropdown,? select/i.test(text)) {
      const opName = (names.at(-1) ?? '').toLowerCase()
      const op = opName === 'contains' ? 'contains' : opName === 'equals' ? '==' : opName
      if (op) action = { type: 'condOp', op }
    } else if (/value to compare.*type|field,? type/i.test(text)) {
      const v = names.at(-1)
      if (v) action = { type: 'condValue', value: v }
    } else if (/^enter\b/i.test(text)) {
      const v = names[0]
      if (v) action = { type: 'text', value: v }
    } else if (/^(now )?type\b|^go to the text input\b.*\btype\b/i.test(text)) {
      // "Go to the Text Input and type: MONEY", "Now type: mOneY"
      const v = names.filter((n) => !kindFromName(n)).at(-1)
      if (v) action = { type: 'text', value: v }
    } else if (/^(motion detected|no motion)$/i.test(text)) {
      action = { type: 'condOp', op: 'is', value: /^motion detected$/i.test(text) }
    }

    result.push({ text, md: line, note: item.note ? tidy(item.note) : undefined, action })
  }
  return result
}

/** A lab only gets the guide if most of its lines are checkable. */
export const isGuidable = (lines: LabLine[]) =>
  lines.length > 0 && lines.filter((l) => l.action.type !== 'manual').length / lines.length >= 0.5

/** What the app will check for this step, in words (for the Curriculum Admin's Guide check). */
export function describeAction(a: LabAction): string {
  const L = (k: GuideKind) => KINDS[k].label
  const times = (n: number) => (n > 1 ? ` (${n} in total)` : '')
  switch (a.type) {
    case 'add':
      return `A new ${L(a.kind)} is on the canvas${times(a.n)}`
    case 'connect':
      return `${L(a.from)} → ${L(a.to)} is connected${times(a.n)}`
    case 'props':
      return `${L(a.kind)} settings are open (double-clicked)`
    case 'condOp':
      return a.op === 'is'
        ? `IF Condition is set to ${a.value ? 'Motion Detected' : 'No Motion'}`
        : `IF Condition is set to ${a.op}${a.value !== undefined ? ` ${a.value}` : ''}`
    case 'condValue':
      return `IF Condition value is ${a.value}`
    case 'switch':
      return a.on ? `A Switch is turned ON${a.n > 1 ? ` (${a.n} switches)` : ''}` : 'A Switch is turned OFF'
    case 'motion':
      return `Motion Sensor shows ${a.detected ? 'Motion Detected' : 'No Motion'}`
    case 'sensorValue':
      return `${L(a.kind)} slider is at ${a.value}`
    case 'text':
      return `Text Input holds “${a.value}”`
    case 'manual':
      return 'Manual: kid taps “✓ I did it”'
  }
}
