import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useModelStore } from '@/store/useModelStore'
import { useRLStore } from '@/store/useRLStore'
import { useCanvasStore } from '@/store/useCanvasStore'
import { useUIStore } from '@/store/useUIStore'

/** Remove canvas blocks by id + React Flow node type (the same types the canvas uses). */
export function removeBlocks(items: Array<{ id: string; type: string }>) {
  const r = useRuleStore.getState()
  const w = useWorkflowStore.getState()
  const d = useDatasetStore.getState()
  const m = useModelStore.getState()
  const rl = useRLStore.getState()
  const c = useCanvasStore.getState()
  for (const { id, type } of items) {
    switch (type) {
      case 'sensor':       r.removeSensorBlock(id); break
      case 'condition':    r.removeConditionBlock(id); break
      case 'switch':       r.removeSwitchBlock(id); break
      case 'logic':        r.removeLogicBlock(id); break
      case 'fan':          r.removeFanBlock(id); break
      case 'alarm':        r.removeAlarmBlock(id); break
      case 'ac':           r.removeACBlock(id); break
      case 'phoneunlock':  r.removePhoneUnlockBlock(id); break
      case 'display':      r.removeDisplayBlock(id); break
      case 'bin':          r.removeBinBlock(id); break
      case 'timer':        r.removeTimerBlock(id); break
      case 'door':         w.removeDoorBlock(id); break
      case 'bulb':         w.removeBulbBlock(id); break
      case 'labelled':     d.removeLabelledBlock(id); break
      case 'unlabelled':   d.removeUnlabelledBlock(id); break
      case 'model':        m.removeModelBlock(id); break
      case 'rl-gridworld': rl.removeRLBlock(id); break
      case 'text':         c.removeTextBlock(id); break
      case 'image':        c.removeImageBlock(id); break
    }
  }
  const ui = useUIStore.getState()
  if (ui.selectedBlockId && items.some((n) => n.id === ui.selectedBlockId)) ui.clearSelectedBlock()
  // Re-run the rules so bulbs/fans/doors that lost their input switch off.
  useRuleStore.getState().evaluateGraph()
}

/** Every block on the canvas right now, as { id, type } (read from the rendered React Flow nodes). */
export function canvasBlocks(): Array<{ id: string; type: string }> {
  return Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node')).flatMap((el) => {
    const id = el.dataset.id
    const type = Array.from(el.classList).find((c) => c.startsWith('react-flow__node-'))?.slice('react-flow__node-'.length)
    return id && type ? [{ id, type }] : []
  })
}
