import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { TextBlock } from '@/types/rules'

interface CanvasState {
  textBlocks: TextBlock[]

  addTextBlock: (pos?: { x: number; y: number }, size?: { width: number; height: number }) => void
  updateTextBlock: (id: string, updates: Partial<TextBlock>) => void
  updateTextBlockPosition: (id: string, pos: { x: number; y: number }) => void
  removeTextBlock: (id: string) => void
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  textBlocks: [],

  addTextBlock: (pos?, size?) =>
    set((s) => {
      const width = size?.width ?? 160
      const height = size?.height ?? 40
      const fontSize = Math.max(8, Math.round(16 * (height / 40)))
      return {
        textBlocks: [
          ...s.textBlocks,
          {
            id: uuid(), type: 'text',
            position: pos ?? { x: 400 + s.textBlocks.length * 40, y: 200 + s.textBlocks.length * 40 },
            text: '',
            width,
            height,
            fontSize,
          },
        ],
      }
    }),

  updateTextBlock: (id, updates) =>
    set((s) => ({ textBlocks: s.textBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateTextBlockPosition: (id, pos) =>
    set((s) => ({ textBlocks: s.textBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  removeTextBlock: (id) =>
    set((s) => ({ textBlocks: s.textBlocks.filter((b) => b.id !== id) })),
}))
