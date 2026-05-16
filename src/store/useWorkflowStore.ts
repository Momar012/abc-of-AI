import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { IfElseBlock, DoorBlock, BulbBlock } from '@/types/workflow'

interface WorkflowState {
  ifElseBlocks: IfElseBlock[]
  doorBlocks: DoorBlock[]
  bulbBlocks: BulbBlock[]
  addIfElseBlock: (pos?: { x: number; y: number }) => void
  removeIfElseBlock: (id: string) => void
  updateIfElseBlock: (id: string, updates: Partial<IfElseBlock>) => void
  updateIfElseBlockPosition: (id: string, pos: { x: number; y: number }) => void
  addDoorBlock: (pos?: { x: number; y: number }) => void
  removeDoorBlock: (id: string) => void
  updateDoorBlock: (id: string, updates: Partial<DoorBlock>) => void
  updateDoorBlockPosition: (id: string, pos: { x: number; y: number }) => void
  addBulbBlock: (pos?: { x: number; y: number }) => void
  removeBulbBlock: (id: string) => void
  updateBulbBlock: (id: string, updates: Partial<BulbBlock>) => void
  updateBulbBlockPosition: (id: string, pos: { x: number; y: number }) => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  ifElseBlocks: [],
  doorBlocks: [],
  bulbBlocks: [],

  addIfElseBlock: (pos?) =>
    set((s) => ({
      ifElseBlocks: [
        ...s.ifElseBlocks,
        {
          id: uuid(),
          type: 'ifelse',
          position: pos ?? { x: 600 + s.ifElseBlocks.length * 40, y: 200 + s.ifElseBlocks.length * 40 },
          name: `If / Else ${s.ifElseBlocks.length + 1}`,
          condition: null,
          linkedModelId: null,
          currentOutput: null,
        },
      ],
    })),

  removeIfElseBlock: (id) =>
    set((s) => ({ ifElseBlocks: s.ifElseBlocks.filter((b) => b.id !== id) })),

  updateIfElseBlock: (id, updates) =>
    set((s) => ({
      ifElseBlocks: s.ifElseBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  updateIfElseBlockPosition: (id, pos) =>
    set((s) => ({
      ifElseBlocks: s.ifElseBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)),
    })),

  addDoorBlock: (pos?) =>
    set((s) => ({
      doorBlocks: [
        ...s.doorBlocks,
        {
          id: uuid(),
          type: 'door',
          position: pos ?? { x: 800 + s.doorBlocks.length * 40, y: 200 + s.doorBlocks.length * 40 },
          name: `Door ${s.doorBlocks.length + 1}`,
          linkedIfElseId: null,
          isOpen: false,
        },
      ],
    })),

  removeDoorBlock: (id) =>
    set((s) => ({ doorBlocks: s.doorBlocks.filter((b) => b.id !== id) })),

  updateDoorBlock: (id, updates) =>
    set((s) => ({
      doorBlocks: s.doorBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  updateDoorBlockPosition: (id, pos) =>
    set((s) => ({
      doorBlocks: s.doorBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)),
    })),

  addBulbBlock: (pos?) =>
    set((s) => ({
      bulbBlocks: [
        ...s.bulbBlocks,
        {
          id: uuid(),
          type: 'bulb',
          position: pos ?? { x: 850 + s.bulbBlocks.length * 40, y: 200 + s.bulbBlocks.length * 40 },
          name: `Bulb ${s.bulbBlocks.length + 1}`,
          linkedIfElseId: null,
          isOn: false,
        },
      ],
    })),

  removeBulbBlock: (id) =>
    set((s) => ({ bulbBlocks: s.bulbBlocks.filter((b) => b.id !== id) })),

  updateBulbBlock: (id, updates) =>
    set((s) => ({
      bulbBlocks: s.bulbBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  updateBulbBlockPosition: (id, pos) =>
    set((s) => ({
      bulbBlocks: s.bulbBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)),
    })),
}))
