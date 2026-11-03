import type { Node } from 'reactflow'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useRuleStore } from '@/store/useRuleStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { getFlowInstance } from '@/lib/abee/flowRef'

type Pos = { x: number; y: number }

/** Gap between two wired blocks, in canvas units — leaves room to see the wire */
const WIRE_GAP = 110
/** Breathing room kept around other blocks when picking a spot */
const CLEARANCE = 24
const MOVE_MS = 550

/** Save a block's position to whichever store owns it (the canvas reloads from these) */
export function saveBlockPosition(id: string, p: Pos) {
  const r = useRuleStore.getState()
  const w = useWorkflowStore.getState()
  const m = useModelStore.getState()
  const d = useDatasetStore.getState()
  const rl = useRLStore.getState()
  const c = useCanvasStore.getState()
  if (m.modelBlocks.some((b) => b.id === id)) m.updateModelBlockPosition(id, p)
  else if (rl.rlBlocks.some((b) => b.id === id)) rl.updateRLBlockPosition(id, p)
  else if (w.doorBlocks.some((b) => b.id === id)) w.updateDoorBlockPosition(id, p)
  else if (w.bulbBlocks.some((b) => b.id === id)) w.updateBulbBlockPosition(id, p)
  else if (r.sensorBlocks.some((b) => b.id === id)) r.updateSensorBlockPosition(id, p)
  else if (r.conditionBlocks.some((b) => b.id === id)) r.updateConditionBlockPosition(id, p)
  else if (r.switchBlocks.some((b) => b.id === id)) r.updateSwitchBlockPosition(id, p)
  else if (r.logicBlocks.some((b) => b.id === id)) r.updateLogicBlockPosition(id, p)
  else if (r.fanBlocks.some((b) => b.id === id)) r.updateFanBlockPosition(id, p)
  else if (r.alarmBlocks.some((b) => b.id === id)) r.updateAlarmBlockPosition(id, p)
  else if (r.acBlocks.some((b) => b.id === id)) r.updateACBlockPosition(id, p)
  else if (r.phoneUnlockBlocks.some((b) => b.id === id)) r.updatePhoneUnlockBlockPosition(id, p)
  else if (r.displayBlocks.some((b) => b.id === id)) r.updateDisplayBlockPosition(id, p)
  else if (r.binBlocks.some((b) => b.id === id)) r.updateBinBlockPosition(id, p)
  else if (r.timerBlocks.some((b) => b.id === id)) r.updateTimerBlockPosition(id, p)
  else if (c.textBlocks.some((b) => b.id === id)) c.updateTextBlockPosition(id, p)
  else if (c.imageBlocks.some((b) => b.id === id)) c.updateImageBlockPosition(id, p)
  else if (d.labelledBlocks.some((b) => b.id === id)) d.updateBlockPosition(id, 'labelled', p)
  else if (d.unlabelledBlocks.some((b) => b.id === id)) d.updateBlockPosition(id, 'unlabelled', p)
}

/** A block's saved position, from whichever store owns it */
export function storedPosition(id: string): Pos | undefined {
  const r = useRuleStore.getState()
  const w = useWorkflowStore.getState()
  const m = useModelStore.getState()
  const d = useDatasetStore.getState()
  const rl = useRLStore.getState()
  const c = useCanvasStore.getState()
  const all: { id: string; position: Pos }[][] = [
    r.sensorBlocks, r.conditionBlocks, r.switchBlocks, r.logicBlocks, r.fanBlocks, r.alarmBlocks, r.acBlocks,
    r.phoneUnlockBlocks, r.displayBlocks, r.binBlocks, r.timerBlocks, w.doorBlocks, w.bulbBlocks,
    m.modelBlocks, d.labelledBlocks, d.unlabelledBlocks, rl.rlBlocks, c.textBlocks, c.imageBlocks,
  ]
  for (const list of all) {
    const hit = list.find((b) => b.id === id)
    if (hit) return hit.position
  }
  return undefined
}

/**
 * Snap every canvas node back to its saved position. The canvas keeps its own
 * copy of where nodes are, so restoring the stores alone wouldn't move them.
 */
export function syncFlowPositions() {
  const flow = getFlowInstance()
  if (!flow) return
  flow.setNodes((nds) => nds.map((n) => {
    const p = storedPosition(n.id)
    return p && (p.x !== n.position.x || p.y !== n.position.y) ? { ...n, position: p } : n
  }))
}

const size = (n: Node) => ({ w: n.width ?? 200, h: n.height ?? 120 })

function overlaps(p: Pos, w: number, h: number, others: Node[]) {
  return others.some((o) => {
    const { w: ow, h: oh } = size(o)
    return (
      p.x < o.position.x + ow + CLEARANCE && p.x + w + CLEARANCE > o.position.x &&
      p.y < o.position.y + oh + CLEARANCE && p.y + h + CLEARANCE > o.position.y
    )
  })
}

/** Glide a block to a new spot on the canvas, then save it */
export function moveBlock(id: string, to: Pos, durationMs = MOVE_MS): Promise<void> {
  const flow = getFlowInstance()
  const node = flow?.getNode(id)
  if (!flow || !node) return Promise.resolve()
  const from = { ...node.position }
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  return new Promise((resolve) => {
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const k = ease(t)
      const p = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }
      flow.setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, position: p } : n)))
      if (t < 1) requestAnimationFrame(step)
      else {
        saveBlockPosition(id, to)
        resolve()
      }
    }
    requestAnimationFrame(step)
  })
}

/**
 * Before wiring `sourceId` → `targetId`, decide whether one of them should
 * move so the signal reads left to right: source on the left, target just to
 * its right, centres lined up. Returns the block to move and where, or null
 * when they already sit nicely. `links` = how many wires each block already
 * has; the less-connected block is the one that moves.
 */
export function planConnectionLayout(sourceId: string, targetId: string, links: (id: string) => number): { id: string; to: Pos } | null {
  const flow = getFlowInstance()
  const s = flow?.getNode(sourceId)
  const t = flow?.getNode(targetId)
  if (!flow || !s || !t) return null
  const ss = size(s)
  const ts = size(t)
  const sCenterY = s.position.y + ss.h / 2
  const tCenterY = t.position.y + ts.h / 2

  const gapX = t.position.x - (s.position.x + ss.w)
  const alreadyTidy = gapX >= 40 && gapX <= 360 && Math.abs(tCenterY - sCenterY) <= 140
  if (alreadyTidy) return null

  const moveTarget = links(targetId) <= links(sourceId)
  const mover = moveTarget ? t : s
  const anchor = moveTarget ? s : t
  const { w, h } = size(mover)
  const as = size(anchor)
  const anchorCenterY = anchor.position.y + as.h / 2
  const ideal = moveTarget
    ? { x: anchor.position.x + as.w + WIRE_GAP, y: anchorCenterY - h / 2 }
    : { x: anchor.position.x - WIRE_GAP - w, y: anchorCenterY - h / 2 }

  // Nudge up or down if the ideal spot is taken by another block
  const others = flow.getNodes().filter((n) => n.id !== mover.id)
  for (let k = 0; k <= 6; k++) {
    const dy = k === 0 ? 0 : Math.ceil(k / 2) * (h + CLEARANCE * 2) * (k % 2 ? 1 : -1)
    const p = { x: ideal.x, y: ideal.y + dy }
    if (!overlaps(p, w, h, others)) return { id: mover.id, to: p }
  }
  return { id: mover.id, to: ideal }
}

/** Frame both blocks on screen without zooming in past the current zoom */
export function frameBlocks(ids: string[]) {
  const flow = getFlowInstance()
  if (!flow) return
  flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.5, duration: 400, maxZoom: Math.max(flow.getZoom(), 0.5) })
}
