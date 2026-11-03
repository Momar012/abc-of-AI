import type { ReactFlowInstance } from 'reactflow'

// The canvas's React Flow instance, so code outside the canvas tree (Abee's
// pointer and demos) can bring a block into view.
let instance: ReactFlowInstance | null = null

export function setFlowInstance(next: ReactFlowInstance | null) {
  instance = next
}

export function getFlowInstance(): ReactFlowInstance | null {
  return instance
}
