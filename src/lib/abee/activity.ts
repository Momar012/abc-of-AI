import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useRLStore } from '@/store/useRLStore'
import { useCurriculumStore } from '@/store/useCurriculumStore'
import { listBlocks, currentStep, BlockSummary } from './context'

// A short running log of what the student did on the canvas ("added Bulb",
// "connected Switch → Bulb"), so Abee knows how they got here — built by
// diffing store state, never by listening to the student.

const MAX_EVENTS = 20
const events: { at: number; text: string }[] = []

function log(text: string) {
  events.push({ at: Date.now(), text })
  if (events.length > MAX_EVENTS) events.shift()
}

/** The log, newest last, with how long ago each thing happened */
export function recentActivity(): string[] {
  const now = Date.now()
  return events.map((e) => {
    const secs = Math.round((now - e.at) / 1000)
    const ago = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`
    return `${ago}: ${e.text}`
  })
}

const label = (b: BlockSummary) => (b.name ? `${b.name} (${b.type})` : b.type)

/** Switch/actuator/model state changes worth narrating */
const WATCHED_STATE = ['isOn', 'isOpen', 'output', 'status', 'testStatus', 'training']

function diff(prev: Map<string, BlockSummary>, next: Map<string, BlockSummary>) {
  const added = [...next.values()].filter((b) => !prev.has(b.id))
  // A load from saved work adds everything at once — that isn't something the student just did
  if (added.length > 4) {
    log(`opened a saved project with ${next.size} blocks`)
    return
  }
  for (const b of added) log(`added ${label(b)}`)
  for (const b of prev.values()) if (!next.has(b.id)) log(`deleted ${label(b)}`)

  for (const b of next.values()) {
    const old = prev.get(b.id)
    if (!old) continue
    for (const src of b.inputs) {
      if (!old.inputs.includes(src)) {
        const from = next.get(src)
        log(`connected ${from ? label(from) : src} → ${label(b)}`)
      }
    }
    for (const src of old.inputs) {
      if (!b.inputs.includes(src)) log(`disconnected ${next.get(src)?.name ?? src} from ${label(b)}`)
    }
    for (const key of WATCHED_STATE) {
      if (key in b.state && JSON.stringify(b.state[key]) !== JSON.stringify(old.state[key])) {
        log(`${label(b)} ${key} → ${JSON.stringify(b.state[key])}`)
      }
    }
    if (b.type === 'condition' && (b.state.operator !== old.state.operator || b.state.threshold !== old.state.threshold)) {
      log(`set ${label(b)} rule to "${b.state.operator} ${b.state.threshold}"`)
    }
  }
}

let started = false

export function startActivityTracking(): () => void {
  if (started) return () => {}
  started = true

  let prev = new Map(listBlocks().map((b) => [b.id, b]))
  let prevStepId = currentStep().step.id
  let queued = false

  // Several stores change together on one action — diff once after they settle
  const onChange = () => {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      const next = new Map(listBlocks().map((b) => [b.id, b]))
      diff(prev, next)
      prev = next
      const { step } = currentStep()
      if (step.id !== prevStepId) {
        prevStepId = step.id
        log(`moved to step "${step.title}"`)
      }
    })
  }

  const unsubs = [
    useRuleStore.subscribe(onChange),
    useWorkflowStore.subscribe(onChange),
    useModelStore.subscribe(onChange),
    useDatasetStore.subscribe(onChange),
    useRLStore.subscribe(onChange),
    useCurriculumStore.subscribe(onChange),
  ]
  return () => {
    unsubs.forEach((u) => u())
    started = false
  }
}
