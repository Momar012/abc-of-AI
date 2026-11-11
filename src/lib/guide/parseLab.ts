import { GuideKind, KINDS, kindFromName } from './blocks'

/**
 * Turns a Guided Lab's "## Instructions" (markdown written for kids) into checkable actions,
 * e.g. "Connect the **IF Condition** to the **Fan**." → { type: 'connect', from: 'condition', to: 'fan' }.
 * Lines we can't check become 'manual' (the kid taps ✓ Done).
 */

export type LabAction =
  | { type: 'add'; kind: GuideKind; n: number }
  /** n = links of this kind pair so far. spec = which blocks, when the lesson says ("Switch C", "the second AND"). */
  | { type: 'connect'; from: GuideKind; to: GuideKind; n: number; spec?: LinkSpec }
  /** Settings are open on this kind of block. n = which one this lab made (2 = "the second / new one"); 0 = any. */
  | { type: 'props'; kind: GuideKind; n?: number }
  | { type: 'switch'; on: boolean; n: number }
  | { type: 'motion'; detected: boolean }
  | { type: 'sensorValue'; kind: GuideKind; value: number }
  | { type: 'text'; value: string }
  /** via = the sensor wired into the IF this step is about ("Humidity > 70%" → the Humidity IF). */
  | { type: 'condOp'; op: string; value?: string | number | boolean; via?: GuideKind }
  | { type: 'condValue'; value: string | number | boolean }
  // ── data & model labs ──
  /** "Open ABITA": already true. */
  | { type: 'auto' }
  /** A tab of the left Data Panel is showing. */
  | { type: 'tab'; tab: DataTab }
  /** The Data Bank holds at least n items. */
  | { type: 'bank'; n: number }
  /** A Label Data block has these labels. */
  | { type: 'labels'; names: string[] }
  /** Some Data Bank items are selected (or already dragged into a Label Data block). */
  | { type: 'select' }
  /** A Label Data block holds at least n items. */
  | { type: 'items'; n: number }
  /** A Label Data block's items all have a label. */
  | { type: 'allLabelled' }
  /** The dataset / model name box holds this name (or it's already saved under it). */
  | { type: 'name'; what: 'dataset' | 'model'; value: string }
  /** A dataset / model is saved with this name ('save' = the Save button step, 'list' = find it in the panel). */
  | { type: 'saved'; what: 'dataset' | 'model'; name: string; via: 'save' | 'list' }
  /** A saved dataset was dragged from the Datasets tab onto the canvas. */
  | { type: 'dsCanvas'; name: string }
  /** A model has started training (done = finished). */
  | { type: 'train'; done: boolean }
  // ── text labs: paste a table, then test the model ──
  /** The kid copied the step's table (📋 Copy table, or Ctrl + C). */
  | { type: 'copy' }
  /** k new Labelled blocks hold at least n pasted sentences, every one with a label (k = 1st / 2nd paste). */
  | { type: 'paste'; n: number; k: number }
  /** A dataset is plugged into a model's amber test dot. */
  | { type: 'testLink' }
  /** The model's test has started (done = finished). */
  | { type: 'runTest'; done: boolean }
  /** ↗ Expand Results is open. */
  | { type: 'results' }
  | { type: 'manual' }

/**
 * Which blocks a connect step means. fromN / toN = the 1st, 2nd, 3rd block of that kind made in
 * this lab ("the second AND", "Switch C"); fromVia / toVia = an IF Condition fed by this sensor
 * ("the Motion IF Condition", "IF Condition (Light)"). k = how many such links this step asks for.
 */
export interface LinkSpec {
  fromN?: number
  toN?: number
  fromVia?: GuideKind
  toVia?: GuideKind
  k: number
}

/** A table shown under its step (e.g. sentences to copy and paste). */
export interface LabTable {
  head: string[]
  rows: string[][]
}

export type DataTab = 'bank' | 'saved' | 'models'

export interface LabLine {
  /** The line as kids read it (markdown bold removed). */
  text: string
  /** The same line with its **bold** kept, for showing. */
  md: string
  /** Follow-up lines of the same step ("Observe the result. The Alarm should stay silent."), shown smaller. */
  note?: string
  /** A table that belongs to this step, shown under it with a 📋 Copy table button. */
  table?: LabTable
  action: LabAction
}

/** "| a | b |" → ["a", "b"]. */
const tableCells = (line: string) =>
  line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

/** Markdown table lines → head + rows (the "|---|---|" line dropped). */
function toTable(lines: string[]): LabTable | undefined {
  const rows = lines.filter((l) => !/^[\s|:-]+$/.test(l)).map(tableCells)
  if (rows.length < 2) return undefined
  return { head: rows[0], rows: rows.slice(1) }
}

/** Spreadsheet-style text (tab between columns) for the clipboard, so 📋 Paste reads it. */
export const tableToTsv = (t: LabTable) => t.rows.map((r) => r.join('\t')).join('\n')

const bolds = (line: string) => Array.from(line.matchAll(/\*\*(.+?)\*\*/g)).map((m) => m[1].trim())
const plain = (line: string) => line.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
/** "IF Condition-->**X**" → "IF Condition → **X**", "**NOT Gate**from" → "**NOT Gate** from". */
const tidy = (line: string) =>
  line
    .replace(/\s*(?:-->|—>|–>|->|→)\s*/g, ' → ')
    // "**Cat**s" → "**Cat** s"-style spacing, matching bold spans in order so "**Cat** or **Dog**"
    // isn't mis-paired as "** or **".
    .replace(/\*\*([^*]+?)\*\*/g, (m, _s, off: number, str: string) => (/[A-Za-z]/.test(str[off + m.length] ?? '') ? `${m} ` : m))
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
  /** 🤔 / 👉 lines under "Expected Result": thoughts for the finish card, not things to test. */
  outro: string[]
  /** Every other section (Learning Tip, Think Like an AI Engineer, …), as markdown with its heading. */
  rest: string
}

type SectionKey = 'goal' | 'problem' | 'instructions' | 'expected' | 'criteria' | 'learned'

/** "## 🎯 Goal" / "## Objective" → 'goal', "## ✅ Success Criteria" → 'expected', … */
function sectionKey(heading: string): SectionKey | null {
  const h = heading.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (h === 'goal' || h === 'objective' || h === 'goals' || h === 'objectives') return 'goal'
  if (h === 'problem') return 'problem'
  if (h === 'instructions') return 'instructions'
  if (/^expected results?$/.test(h)) return 'expected'
  if (h === 'success criteria') return 'criteria'
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
  const bodies: Record<SectionKey, string[]> = { goal: [], problem: [], instructions: [], expected: [], criteria: [], learned: [] }
  const intro: string[] = []
  const rest: string[] = []
  let cur: string[] = intro
  let inFence = false
  for (const raw of md.split('\n')) {
    if (raw.trim().startsWith('```')) inFence = !inFence
    const m = !inFence && raw.match(/^##\s+(.+)$/)
    // Some lessons write a heading as a bold line ("**What You Learned**"); only known sections count,
    // so "**MONEY**" or "**Step 1:**" stay ordinary lines.
    const bold = !inFence && !m && raw.trim().match(/^\*\*([^*]+?)\*\*:?$/)
    if (bold && sectionKey(bold[1])) {
      cur = bodies[sectionKey(bold[1])!]
      continue
    }
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
  // With a "Success Criteria" list, that's what kids test, and "Expected Result" is just thoughts.
  const criteria = listItems(join(bodies.criteria))
  const expectedRaw = listItems(join(bodies.expected))
  const isThought = (t: string) => criteria.length > 0 || /^(🤔|👉)/u.test(t)
  const expected = [...criteria, ...expectedRaw]
  return {
    intro: join(intro),
    goal: join(bodies.goal),
    problem: join(bodies.problem),
    instructions: join(bodies.instructions),
    expected: criteria.length ? criteria : expectedRaw.filter((t) => !isThought(t)),
    learned: listItems(join(bodies.learned)),
    outro: expectedRaw.filter(isThought).map((t) => t.replace(/^(🤔|👉)\s*/u, '')),
    rest: join(rest),
  }
}

/** Lines that start a new action, even in the middle of a Step. */
const ACTION_START =
  /^(drag|add|connect|double-click|configure|set|type|enter|turn|click|go to|now type|change|trigger|move|select|open|rename|press|create)\b/i

/** One instruction: a line of text, or the arrows of a ```diagram block ("Switch → OR Gate"). */
type RawInstruction = { line: string; note?: string; table?: string[] } | { arrows: Array<[string, string]> }

/** Pull just the instruction lines out of the lab markdown. */
function instructionLines(md: string): RawInstruction[] {
  const out: RawInstruction[] = []
  let fence: Array<[string, string]> | null = null
  let joinNext = false
  /** The line being joined onto is a list ("Create two labels:" + "- Cat" + "- Dog"). */
  let listJoin = false
  /** Where a joined line goes: the step's own line, or its 👀 note. */
  let joinInto: 'line' | 'note' = 'line'
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
    // A table belongs to the step above it ("Tap 📋 Copy table to copy the sentences below.").
    if (l.startsWith('|')) {
      const owner = out.at(-1)
      if (owner && 'line' in owner) (owner.table ??= []).push(l)
      joinNext = false
      continue
    }
    const isItem = /^[-*]\s+/.test(l)
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
    const joining: boolean = !!(joinNext && last && 'line' in last)
    if (joining && joinInto === 'note' && last && 'line' in last) last.note = `${last.note ?? ''}${listJoin ? ',' : ''} ${body}`.trim()
    else if (joining && last && 'line' in last) last.line = `${last.line}${listJoin ? ',' : ''} ${body}`
    else if (followUp && last && 'line' in last) {
      last.note = last.note ? `${last.note} ${body}` : body
      joinInto = 'note'
    } else {
      out.push({ line: body })
      joinInto = 'line'
    }
    // A list right after "…:" belongs to that line, item after item.
    listJoin = joining && isItem
    joinNext = /(:|→|->)\s*\**$/.test(body) || listJoin
    if (inStep >= 0) inStep++
  }
  return out
}

/** Which block a "Double-click the … X" step means: "first" = 1, "second" = 2, "new"/"another" = the
 *  latest one this lab added, plain "the X" = 0 (any X). */
const whichOne = (s: string, added: number) =>
  /\bfirst\b/i.test(s) ? 1 : /\bsecond\b/i.test(s) ? 2 : /\bthird\b/i.test(s) ? 3 : /\b(new|another)\b/i.test(s) ? added : 0

/** "the second AND" → 2, "Switch C" → 3 (one side of a connect line). 0 = the lesson doesn't say. */
const ordinalIn = (side: string, kind: GuideKind) => {
  const n = /\bfirst\b/i.test(side) ? 1 : /\bsecond\b/i.test(side) ? 2 : /\bthird\b/i.test(side) ? 3 : 0
  if (n) return n
  const letter = kind === 'switch' ? side.match(/\bswitch ([abc])\b/i) : null
  return letter ? 'abc'.indexOf(letter[1].toLowerCase()) + 1 : 0
}

/** The sensor a phrase names besides the IF itself: "Motion IF Condition", "IF Condition (Light)", "Humidity > 70%". */
const SENSOR_WORDS: Array<[RegExp, GuideKind]> = [
  [/\btemperature\b/i, 'sensor-temperature'],
  [/\bhumidity\b/i, 'sensor-humidity'],
  [/\blight\b/i, 'sensor-light'],
  [/\bmotion\b/i, 'sensor-motion'],
  [/\btext\b/i, 'sensor-text'],
]
const sensorIn = (s: string): GuideKind | undefined => SENSOR_WORDS.find(([re]) => re.test(s))?.[1]

/** Which blocks one connect line means, or undefined when it doesn't say (any block of that kind). */
function linkSpec(from: GuideKind, to: GuideKind, before: string, after: string, k: number, oneSource: boolean): LinkSpec | undefined {
  const spec: LinkSpec = { k }
  // "Connect Switch A and Switch B to…" names two sources: only the target is specific.
  const fromN = oneSource ? ordinalIn(before, from) : 0
  const toN = ordinalIn(after, to)
  if (fromN) spec.fromN = fromN
  if (toN) spec.toN = toN
  // Only an IF Condition can be "the Light one"; "Connect the Temperature Sensor…" is the sensor itself.
  if (from === 'condition') spec.fromVia = sensorIn(before)
  if (to === 'condition') spec.toVia = sensorIn(after)
  return spec.fromN || spec.toN || spec.fromVia || spec.toVia ? spec : undefined
}

const countWord = (s: string) =>
  /\ball three\b|\bthree\b/i.test(s) ? 3 : /\bboth\b|\btwo\b/i.test(s) ? 2 : 1

function parseCondition(expr: string): { op: string; value: string | number | boolean; via?: GuideKind } | null {
  const e = expr.trim()
  // "Contains: MONEY", "Equals: Pakistan"
  const named = e.match(/^(contains|equals)\s*:?\s+(.+)$/i)
  if (named) return { op: named[1].toLowerCase() === 'contains' ? 'contains' : '==', value: named[2].trim() }
  if (/^motion detected$/i.test(e)) return { op: 'is', value: true, via: 'sensor-motion' }
  if (/^no motion$/i.test(e)) return { op: 'is', value: false, via: 'sensor-motion' }
  const m = e.match(/(>=|<=|!=|==|=|>|<)\s*(.+)$/)
  if (!m) return null
  const op = m[1] === '=' ? '==' : m[1]
  const num = parseFloat(m[2])
  // "Humidity > 70%": the IF this is about is the one wired to the Humidity sensor.
  const via = sensorIn(e.slice(0, m.index))
  return { op, value: Number.isNaN(num) ? m[2].replace(/[°C]+$/g, '').trim() : num, ...(via ? { via } : {}) }
}

/** A condOp action from a parsed condition (keeps `via` only when the lesson named the sensor). */
const condAction = (c: NonNullable<ReturnType<typeof parseCondition>>): LabAction =>
  c.via ? { type: 'condOp', op: c.op, value: c.value, via: c.via } : { type: 'condOp', op: c.op, value: c.value }

/** "From the Models menu, drag…" / "Under 2 · Train, click…" → "drag…" / "click…". */
const LEAD_IN = /^(from|under|in) (the )?[^,]{1,40},\s*/i

interface DataCtx {
  bankN: number
  dataset?: string
  model?: string
  lastConnect?: LabAction
  /** Rows in the last table a step showed (how many sentences the next paste should bring). */
  tableRows?: number
  /** Pastes so far (the 2nd paste must land in a 2nd Labelled block). */
  pastes: number
}

const numberIn = (s: string) => {
  const m = s.match(/\b(\d+)\b/)
  return m ? Number(m[1]) : null
}

/**
 * Data & model lab lines (Data Bank, Label Data, saving, training). Returns null for anything
 * else, so rule-based labs parse exactly as before.
 */
function dataAction(
  text: string,
  t: string,
  names: string[],
  kinds: Array<GuideKind | null>,
  ctx: DataCtx,
  connect: (from: GuideKind, to: GuideKind) => LabAction
): LabAction | null {
  if (/^open abita\.?$/i.test(t)) return { type: 'auto' }
  // ── text labs ──
  if (/\bcopy table\b|^copy the\b.*\btable\b/i.test(t)) return { type: 'copy' }
  if (/\bclick\b.*\bpaste\b/i.test(t) && ctx.tableRows) {
    ctx.pastes += 1
    return { type: 'paste', n: ctx.tableRows, k: ctx.pastes }
  }
  // "Drag from the amber dot on **Test Data** to the amber dot on the **Model**": the test link.
  if (/^drag from the (lower |bottom )?amber dot\b/i.test(t)) return { type: 'testLink' }
  if (/^click\b.*\brun test\b/i.test(t)) return { type: 'runTest', done: false }
  if (/^wait for the test(ing)?\b/i.test(t)) return { type: 'runTest', done: true }
  if (/^click\b.*\bexpand results\b/i.test(t)) return { type: 'results' }
  if (/^(go to|open) the data (panel|bank)\b/i.test(t)) return { type: 'tab', tab: 'bank' }
  if (/^open the datasets tab\b/i.test(t)) return { type: 'tab', tab: 'saved' }
  if (/^open the (my )?models tab\b/i.test(t)) return { type: 'tab', tab: 'models' }
  if (/^click:? add data\b/i.test(t)) return { type: 'bank', n: 1 }
  if (/^upload\b.*\bdata bank\b/i.test(t)) {
    ctx.bankN = numberIn(t) ?? ctx.bankN
    return { type: 'bank', n: Math.max(1, ctx.bankN) }
  }
  if (/^check that .*\bappear in the data bank\b/i.test(t)) return { type: 'bank', n: Math.max(1, ctx.bankN) }
  if (/^create (\w+ )?labels?\b/i.test(t)) {
    const labelNames = names.filter((n) => !kindFromName(n))
    return labelNames.length ? { type: 'labels', names: labelNames } : null
  }
  if (/^select\b.*\bdata bank\b/i.test(t)) return { type: 'select' }
  if (/\binto the items\b/i.test(t)) return { type: 'items', n: 2 }
  if (/assign the correct label to every|every (image|item) has been labell?ed/i.test(t)) return { type: 'allLabelled' }

  // "Under Save Dataset, enter the dataset name:" / "In the Save Dataset section, enter the name:"
  const nameAsk = text.match(/\benter the (dataset |model )?name\b/i)
  if (nameAsk && names.length && (nameAsk[1] || /\bsave (dataset|data|to my models)\b/i.test(text))) {
    const what = /model/i.test(nameAsk[1] ?? text) ? 'model' : 'dataset'
    const value = names.at(-1)!
    ctx[what] = value
    return { type: 'name', what, value }
  }
  if (/^click:?\b.*\bsave data(set)?\b/i.test(t))
    return ctx.dataset ? { type: 'saved', what: 'dataset', name: ctx.dataset, via: 'save' } : null
  if (/^click:?\b.*\bsave name\b/i.test(t)) return ctx.model ? { type: 'saved', what: 'model', name: ctx.model, via: 'save' } : null
  const listed = t.match(/^check that (.+?) appears in the (list of saved |)(datasets|models)\b/i)
  if (listed) {
    const what = /dataset/i.test(listed[3]) ? 'dataset' : 'model'
    const name = names[0] ?? listed[1]
    ctx[what] = name
    return { type: 'saved', what, name, via: 'list' }
  }
  if (/^locate\b/i.test(t) && names.length) {
    ctx.dataset = names.at(-1)!
    return { type: 'saved', what: 'dataset', name: ctx.dataset, via: 'list' }
  }
  // "Drag **CatDog Labelled Dataset** onto the canvas" (a saved dataset, not a block from a menu)
  const inT = names.filter((n) => t.includes(n))
  if (/^drag\b.*\bonto the canvas\b/i.test(t) && inT.length && !inT.some((n) => kindFromName(n))) {
    const name = inT.find((n) => /dataset/i.test(n) || n === ctx.dataset)
    if (name) {
      ctx.dataset = name
      return { type: 'dsCanvas', name }
    }
  }
  // "drag from the violet dot on **X Dataset** to the teal dot on the **Image Supervised Model**"
  const dots = t.match(/drag from the .*?dot on (.+?) to the .*?dot on (.+)$/i)
  if (dots) {
    const side = (raw: string): GuideKind | null => {
      const n = names.find((x) => raw.includes(x) && !/dot$/i.test(x)) ?? raw
      const k = kindFromName(n)
      if (k) return k
      if (/unlabell?ed/i.test(n)) return 'unlabelled'
      return /dataset/i.test(n) ? 'labelled' : null
    }
    const from = side(dots[1])
    const to = side(dots[2])
    if (from && to) return (ctx.lastConnect = connect(from, to))
  }
  if (/^verify\b.*\bconnected\b/i.test(t) && ctx.lastConnect) return ctx.lastConnect
  if (/^click\b.*\btrain model\b/i.test(t)) return { type: 'train', done: false }
  if (/^observe the training\b/i.test(t)) return { type: 'train', done: false }
  if (/^wait for the training\b/i.test(t) || (/^verify\b/i.test(t) && /training complete/i.test(t))) return { type: 'train', done: true }
  if (/^scroll to\b.*\bsave to my models\b/i.test(t)) return { type: 'train', done: true }
  return null
}

export function parseLab(md: string): LabLine[] {
  const ctx: DataCtx = { bankN: 0, pastes: 0 }
  const adds: Partial<Record<GuideKind, number>> = {}
  const links: Record<string, number> = {}
  const result: LabLine[] = []
  const connect = (from: GuideKind, to: GuideKind, n = 1, spec?: LinkSpec): LabAction => {
    const key = `${from}>${to}`
    links[key] = (links[key] ?? 0) + n
    return spec ? { type: 'connect', from, to, n: links[key], spec } : { type: 'connect', from, to, n: links[key] }
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
        result.push({ text: plain(md), md, action: connect(from, to, 1, linkSpec(from, to, a, b, 1, true)) })
      }
      continue
    }

    const line = tidy(item.line)
    const text = plain(line)
    const table = item.table ? toTable(item.table) : undefined
    if (table) ctx.tableRows = table.rows.length
    const names = bolds(line)
    const kinds = names.map(kindFromName)
    let action: LabAction = { type: 'manual' }
    const t = text.replace(LEAD_IN, '')
    const data = dataAction(text, t, names, kinds, ctx, (from, to) => connect(from, to))

    if (data) {
      action = data
    } else if (/^(drag|add)\b/i.test(t) && kinds.some(Boolean)) {
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
        // The block just added is the one to wire up (the 2nd IF, not the 1st that's already connected).
        const justAdded: LinkSpec = intoAdded ? { toN: adds[kind]!, k: 1 } : { fromN: adds[kind]!, k: 1 }
        result.push({
          text: plain(md),
          md,
          action: intoAdded ? connect(other, kind, 1, adds[kind]! > 1 ? justAdded : undefined) : connect(kind, other, 1, adds[kind]! > 1 ? justAdded : undefined),
        })
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
        const k = Math.max(fromKinds.length, countWord(before), countWord(after))
        action = connect(from, toKind, k, linkSpec(from, toKind, before, after, k, fromKinds.length === 1))
      }
    } else if (/move the slider to|slider to/i.test(text)) {
      const v = parseFloat((text.match(/slider to\s*(-?\d+(\.\d+)?)/i) ?? [])[1] ?? '')
      const kind: GuideKind = /humidity/i.test(text) ? 'sensor-humidity' : /light/i.test(text) ? 'sensor-light' : 'sensor-temperature'
      if (!Number.isNaN(v)) action = { type: 'sensorValue', kind, value: v }
    } else if (/^double-click/i.test(text)) {
      const kind = kinds.find(Boolean)
      if (/no motion/i.test(text)) action = { type: 'motion', detected: false }
      else if (/motion detected/i.test(text)) action = { type: 'motion', detected: true }
      else if (kind) action = { type: 'props', kind, n: whichOne(text, adds[kind] ?? 0) }
    } else if (/^configure\b/i.test(text) && names.length) {
      // "Configure the IF Condition --> Temperature > 30°C" / "Configure it as: Contains: MONEY" set the
      // condition; plain "Configure the IF Condition" just opens it.
      const kind = kinds.find(Boolean)
      const c = names.length > 1 || !kind ? parseCondition(names.at(-1)!) : null
      if (c) action = condAction(c)
      else if (kind) action = { type: 'props', kind, n: whichOne(text, adds[kind] ?? 0) }
    } else if (/^turn\b/i.test(text) && /switch/i.test(text)) {
      const on = /\bON\b/.test(text)
      action = { type: 'switch', on, n: on ? countWord(text) : 1 }
    } else if (/^(change|trigger|click)\b/i.test(text) && /motion/i.test(text)) {
      // "Change the Motion Sensor to Motion Detected", "Trigger Motion", "Click the No Motion button…"
      action = { type: 'motion', detected: !/to\s+no motion/i.test(text) }
    } else if (/^set the (if )?condition to/i.test(text)) {
      const expr = names.at(-1) ?? text.replace(/^set the (if )?condition to\s*(→|->)?/i, '')
      const c = parseCondition(expr)
      if (c) action = condAction(c)
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
      action = { type: 'condOp', op: 'is', value: /^motion detected$/i.test(text), via: 'sensor-motion' }
    }

    result.push({ text, md: line, note: item.note ? tidy(item.note) : undefined, table, action })
  }
  return result
}

export const TAB_LABEL: Record<DataTab, string> = { bank: '📁 Data', saved: '📋 Datasets', models: '🤖 Models' }

/** A lab only gets the guide if most of its lines are checkable. */
export const isGuidable = (lines: LabLine[]) =>
  lines.length > 0 && lines.filter((l) => l.action.type !== 'manual').length / lines.length >= 0.5

const ORDINAL = ['', 'first', 'second', 'third', 'fourth']

/** "the second ∧ AND", "the 📋 IF Condition for 💡 Light Level", or just "the 🎚️ Switch". */
export function blockWords(kind: GuideKind, n?: number, via?: GuideKind): string {
  const label = KINDS[kind].label
  if (via) return `the ${label} for ${KINDS[via].label}`
  return n ? `the ${ORDINAL[n] ?? `#${n}`} ${label}` : `the ${label}`
}

/** What the app will check for this step, in words (for the Curriculum Admin's Guide check). */
export function describeAction(a: LabAction): string {
  const L = (k: GuideKind) => KINDS[k].label
  const times = (n: number) => (n > 1 ? ` (${n} in total)` : '')
  switch (a.type) {
    case 'add':
      return `A new ${L(a.kind)} is on the canvas${times(a.n)}`
    case 'connect': {
      if (!a.spec) return `${L(a.from)} → ${L(a.to)} is connected${times(a.n)}`
      const s = a.spec
      return `${blockWords(a.from, s.fromN, s.fromVia)} → ${blockWords(a.to, s.toN, s.toVia)} is connected${s.k > 1 ? ` (${s.k} links)` : ''}`
    }
    case 'props':
      return `${L(a.kind)} settings are open (double-clicked)`
    case 'condOp': {
      const on = a.via ? ` (the IF for ${L(a.via)})` : ''
      return a.op === 'is'
        ? `IF Condition${on} is set to ${a.value ? 'Motion Detected' : 'No Motion'}`
        : `IF Condition${on} is set to ${a.op}${a.value !== undefined ? ` ${a.value}` : ''}`
    }
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
    case 'auto':
      return 'Ticks by itself (nothing to check)'
    case 'tab':
      return `The ${TAB_LABEL[a.tab]} tab of the Data Panel is open`
    case 'bank':
      return `The Data Bank has at least ${a.n} item${a.n > 1 ? 's' : ''}`
    case 'labels':
      return `A Label Data block has the labels ${a.names.map((n) => `“${n}”`).join(' and ')}`
    case 'select':
      return 'Some Data Bank items are selected'
    case 'items':
      return `A Label Data block holds at least ${a.n} items`
    case 'allLabelled':
      return 'Every item in the Label Data block has a label'
    case 'name':
      return `The ${a.what} name box says “${a.value}”`
    case 'saved':
      return `A ${a.what} called “${a.name}” is saved${a.via === 'list' ? ` (shown in the ${a.what === 'dataset' ? 'Datasets' : 'Models'} tab)` : ''}`
    case 'dsCanvas':
      return `The saved dataset “${a.name}” is on the canvas`
    case 'train':
      return a.done ? 'A model shows Training complete' : 'A model has started training'
    case 'copy':
      return 'Kid copied the table (📋 Copy table or Ctrl + C)'
    case 'paste':
      return `${a.k > 1 ? `${a.k} new Labelled blocks each hold` : 'A new Labelled block holds'} at least ${a.n} pasted sentences, all labelled`
    case 'testLink':
      return "A dataset is plugged into a model's amber test dot"
    case 'runTest':
      return a.done ? 'The model has finished testing' : 'The model has started testing'
    case 'results':
      return '↗ Expand Results is open'
    case 'manual':
      return 'Manual: kid taps “✓ I did it”'
  }
}
