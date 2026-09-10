import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { TextBlock, ImageBlock } from '@/types/rules'

const IMAGE_MAX_DISPLAY_DIM = 320
const IMAGE_MIN_DISPLAY_DIM = 80

interface CanvasState {
  textBlocks: TextBlock[]
  imageBlocks: ImageBlock[]

  addTextBlock: (pos?: { x: number; y: number }, size?: { width: number; height: number }) => string
  updateTextBlock: (id: string, updates: Partial<TextBlock>) => void
  updateTextBlockPosition: (id: string, pos: { x: number; y: number }) => void
  removeTextBlock: (id: string) => void

  addImageBlock: (src: string, naturalSize: { width: number; height: number }, pos?: { x: number; y: number }) => string
  updateImageBlock: (id: string, updates: Partial<ImageBlock>) => void
  updateImageBlockPosition: (id: string, pos: { x: number; y: number }) => void
  removeImageBlock: (id: string) => void
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  textBlocks: [],
  imageBlocks: [],

  addTextBlock: (pos?, size?) => {
    const id = uuid()
    set((s) => {
      const width = size?.width ?? 160
      const height = size?.height ?? 40
      const fontSize = Math.max(8, Math.round(16 * (height / 40)))
      return {
        textBlocks: [
          ...s.textBlocks,
          {
            id, type: 'text',
            position: pos ?? { x: 400 + s.textBlocks.length * 40, y: 200 + s.textBlocks.length * 40 },
            text: '',
            width,
            height,
            fontSize,
            autoWidth: !size,
          },
        ],
      }
    })
    return id
  },

  updateTextBlock: (id, updates) =>
    set((s) => ({ textBlocks: s.textBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateTextBlockPosition: (id, pos) =>
    set((s) => ({ textBlocks: s.textBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  removeTextBlock: (id) =>
    set((s) => ({ textBlocks: s.textBlocks.filter((b) => b.id !== id) })),

  addImageBlock: (src, naturalSize, pos?) => {
    const id = uuid()
    set((s) => {
      const scale = Math.min(1, IMAGE_MAX_DISPLAY_DIM / Math.max(naturalSize.width, naturalSize.height))
      const width = Math.max(IMAGE_MIN_DISPLAY_DIM, Math.round(naturalSize.width * scale))
      const height = Math.max(IMAGE_MIN_DISPLAY_DIM, Math.round(naturalSize.height * scale))
      return {
        imageBlocks: [
          ...s.imageBlocks,
          {
            id, type: 'image',
            position: pos ?? { x: 400 + s.imageBlocks.length * 40, y: 200 + s.imageBlocks.length * 40 },
            src,
            width,
            height,
          },
        ],
      }
    })
    return id
  },

  updateImageBlock: (id, updates) =>
    set((s) => ({ imageBlocks: s.imageBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)) })),

  updateImageBlockPosition: (id, pos) =>
    set((s) => ({ imageBlocks: s.imageBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)) })),

  removeImageBlock: (id) =>
    set((s) => ({ imageBlocks: s.imageBlocks.filter((b) => b.id !== id) })),
}))
