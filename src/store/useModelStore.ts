import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { ModelBlock, TrainedModel } from '@/types/model'

interface ModelState {
  modelBlocks: ModelBlock[]
  trainedModels: TrainedModel[]

  addModelBlock: (pos?: { x: number; y: number }) => void
  addModelBlockFromSaved: (model: TrainedModel) => void
  removeModelBlock: (id: string) => void
  updateModelBlock: (id: string, updates: Partial<ModelBlock>) => void
  updateModelBlockPosition: (id: string, pos: { x: number; y: number }) => void
  saveTrainedModel: (model: TrainedModel) => void
  renameTrainedModel: (id: string, name: string) => void
  deleteTrainedModel: (id: string) => void
}

export const useModelStore = create<ModelState>((set) => ({
  modelBlocks: [],
  trainedModels: [],

  addModelBlock: (pos?) =>
    set((s) => ({
      modelBlocks: [
        ...s.modelBlocks,
        {
          id: uuid(),
          type: 'model',
          position: pos ?? { x: 300 + s.modelBlocks.length * 40, y: 200 + s.modelBlocks.length * 40 },
          name: `Model ${s.modelBlocks.length + 1}`,
          modelType: null,
          linkedBlockId: null,
          status: 'idle',
          trainedModelId: null,
          testLinkedBlockId: null,
          testStatus: 'idle',
          testResults: null,
        },
      ],
    })),

  addModelBlockFromSaved: (model) =>
    set((s) => ({
      modelBlocks: [
        ...s.modelBlocks,
        {
          id: uuid(),
          type: 'model',
          position: { x: 300 + s.modelBlocks.length * 40, y: 200 + s.modelBlocks.length * 40 },
          name: model.name,
          modelType: model.modelType,
          linkedBlockId: null,
          status: 'trained',
          trainedModelId: model.id,
          testLinkedBlockId: null,
          testStatus: 'idle',
          testResults: null,
        },
      ],
    })),

  removeModelBlock: (id) =>
    set((s) => ({ modelBlocks: s.modelBlocks.filter((b) => b.id !== id) })),

  updateModelBlock: (id, updates) =>
    set((s) => ({
      modelBlocks: s.modelBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),

  updateModelBlockPosition: (id, pos) =>
    set((s) => ({
      modelBlocks: s.modelBlocks.map((b) => (b.id === id ? { ...b, position: pos } : b)),
    })),

  saveTrainedModel: (model) =>
    set((s) => ({ trainedModels: [model, ...s.trainedModels] })),

  renameTrainedModel: (id, name) =>
    set((s) => ({
      trainedModels: s.trainedModels.map((m) => m.id === id ? { ...m, name } : m),
    })),

  deleteTrainedModel: (id) =>
    set((s) => ({ trainedModels: s.trainedModels.filter((m) => m.id !== id) })),
}))
