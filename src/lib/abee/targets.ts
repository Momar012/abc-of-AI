import { MODEL_CATALOG } from '@/lib/modelCatalog'
import { ToolbarMenu, useUIStore } from '@/store/useUIStore'
import { getFlowInstance } from './flowRef'

/**
 * Things Abee can point at, by id:
 *  - `data-abee` ids on the UI ("toolbar.actions", "inspector.train", "menu.item.bulb"…)
 *  - `block:<blockId>` for a canvas block
 *  - `handle:<blockId>:<handleId>` for one of a block's connection dots
 */

/** Which toolbar menu each palette entry lives in */
export const MENU_ITEMS: Record<ToolbarMenu, string[]> = {
  datasets: ['labelled', 'unlabelled'],
  model: [...MODEL_CATALOG.filter((m) => m.available).map((m) => `model-${m.type}`), 'rl-gridworld'],
  actions: ['door', 'bulb', 'fan', 'alarm', 'ac', 'phoneunlock', 'display', 'bin'],
  rules: ['sensor-temperature', 'sensor-light', 'sensor-motion', 'sensor-humidity', 'sensor-text', 'switch', 'condition', 'logic-and', 'logic-or', 'logic-not', 'timer'],
}

export function menuForBlockType(blockType: string): ToolbarMenu | null {
  for (const [menu, items] of Object.entries(MENU_ITEMS) as [ToolbarMenu, string[]][]) {
    if (items.includes(blockType)) return menu
  }
  return null
}

function isShown(el: Element) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

export function findTargetElement(target: string): HTMLElement | null {
  let candidates: HTMLElement[] = []
  if (target.startsWith('block:')) {
    candidates = Array.from(document.querySelectorAll<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(target.slice(6))}"]`))
  } else if (target.startsWith('handle:') || target.startsWith('control:')) {
    const [kind, blockId, name] = target.split(':')
    const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(blockId ?? '')}"]`)
    const attr = kind === 'handle' ? 'data-handleid' : 'data-abee-control'
    const el = node?.querySelector<HTMLElement>(`[${attr}="${CSS.escape(name ?? '')}"]`)
    candidates = el ? [el] : []
  } else {
    candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-abee="${CSS.escape(target)}"]`))
  }
  return candidates.find(isShown) ?? null
}

export function resolveTarget(target: string): DOMRect | null {
  return findTargetElement(target)?.getBoundingClientRect() ?? null
}

/** Whether a target is fully inside the visible canvas (below the floating toolbar) */
export function onCanvasScreen(target: string): boolean {
  const r = resolveTarget(target)
  const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
  return !!r && !!pane && r.left >= pane.left && r.right <= pane.right && r.top >= pane.top + 60 && r.bottom <= pane.bottom
}

/** A canvas block's connection dots and on-block controls, as target ids Abee can point at */
export function blockParts(blockId: string): { inDots: string[]; outDots: string[]; controls: string[] } {
  const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(blockId)}"]`)
  const parts = { inDots: [] as string[], outDots: [] as string[], controls: [] as string[] }
  if (!node) return parts
  node.querySelectorAll<HTMLElement>('[data-handleid]').forEach((h) => {
    const id = `handle:${blockId}:${h.dataset.handleid}`
    if (h.classList.contains('source')) parts.outDots.push(id)
    else parts.inDots.push(id)
  })
  node.querySelectorAll<HTMLElement>('[data-abee-control]').forEach((c) => {
    parts.controls.push(`control:${blockId}:${c.dataset.abeeControl}`)
  })
  return parts
}

/** `data-abee` targets on screen right now, for Abee's context */
export function visibleTargets(): string[] {
  const ids = new Set<string>()
  document.querySelectorAll<HTMLElement>('[data-abee]').forEach((el) => {
    if (isShown(el)) ids.add(el.dataset.abee!)
  })
  return Array.from(ids)
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Make a target visible before pointing at it: open the menu a palette item
 * lives in, or pan the canvas to a block that's scrolled out of view.
 * Resolves to whether the target can now be seen.
 */
export async function revealTarget(target: string, { openMenus = true } = {}): Promise<boolean> {
  if (target.startsWith('menu.item.') && !findTargetElement(target)) {
    const menu = menuForBlockType(target.slice('menu.item.'.length))
    if (!menu || !openMenus) return false
    useUIStore.getState().setOpenToolbarMenu(menu)
    await wait(120)
  }

  if (target.startsWith('block:') || target.startsWith('handle:') || target.startsWith('control:')) {
    const blockId = target.split(':')[1]
    const flow = getFlowInstance()
    const node = flow?.getNode(blockId)
    if (!flow || !node) return !!findTargetElement(target)
    const el = findTargetElement(`block:${blockId}`)
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    const onScreen = !!r && !!pane && r.left >= pane.left && r.right <= pane.right && r.top >= pane.top + 60 && r.bottom <= pane.bottom
    if (!onScreen) {
      const w = node.width ?? 180
      const h = node.height ?? 80
      flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: flow.getZoom(), duration: 400 })
      await wait(450)
    }
  }

  return !!findTargetElement(target)
}
