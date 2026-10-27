import { v4 as uuid } from 'uuid'
import { ModelType, TrainedModel } from '@/types/model'

// Trained models live in this browser's localStorage only — a different
// Chromebook, an Incognito window or a school wiping browser data at logout
// loses them. Saving to a file (e.g. Google Drive) lets kids carry them over.

const FILE_FORMAT = 'abita-model'
const FILE_VERSION = 1
const MODEL_TYPES: ModelType[] = ['image-supervised', 'image-classifier', 'image-unsupervised', 'text-corpus', 'text-supervised', 'text-unsupervised']

export function downloadTrainedModel(model: TrainedModel) {
  const payload = { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: Date.now(), model }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${model.name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'model'}.abita-model.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Parses a saved model file; throws an Error with a kid-friendly message if it isn't one. */
export function parseTrainedModelFile(text: string): TrainedModel {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't an ABITA model — pick a file ending in .abita-model.json")
  }
  const file = data as { format?: unknown; version?: unknown; model?: Partial<TrainedModel> }
  if (file?.format !== FILE_FORMAT || !file.model) {
    throw new Error("That file isn't an ABITA model — pick a file ending in .abita-model.json")
  }
  if (typeof file.version !== 'number' || file.version > FILE_VERSION) {
    throw new Error('This model was saved by a newer version of ABITA — refresh the page and try again.')
  }
  const m = file.model
  const valid =
    typeof m.name === 'string' &&
    MODEL_TYPES.includes(m.modelType as ModelType) &&
    isStringArray(m.labels) &&
    isStringArray(m.labelIds) &&
    m.labels.length === m.labelIds.length &&
    typeof m.itemCount === 'number' &&
    typeof m.knnData === 'object' && m.knnData !== null
  if (!valid) throw new Error('This model file looks damaged — try saving it again from the computer it came from.')

  // Fresh id so loading the same file twice (or onto the computer it came from) never clashes
  return { ...(m as TrainedModel), id: uuid(), trainedAt: typeof m.trainedAt === 'number' ? m.trainedAt : Date.now() }
}
