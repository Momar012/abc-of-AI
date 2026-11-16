/**
 * Keeps names in My Models / saved Datasets unique, so "drag CatDogModel" never means two things.
 * The item just saved keeps its name; older ones with the same name become "CatDogModel (old)",
 * "CatDogModel (old 2)", … Nothing is deleted.
 */

import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'

/** Call right after a model is trained, loaded or renamed. */
export function keepModelNameUnique(modelId: string) {
  useModelStore.setState((s) => {
    const next = retireDuplicateNames(s.trainedModels, modelId)
    return next === s.trainedModels ? s : { trainedModels: next }
  })
}

/** Call right after a dataset block is saved. */
export function keepDatasetNameUnique(blockId: string) {
  useDatasetStore.setState((s) => {
    const saved = s.savedDatasets.find((d) => d.sourceBlockId === blockId)
    if (!saved) return s
    const next = retireDuplicateNames(s.savedDatasets, saved.id)
    return next === s.savedDatasets ? s : { savedDatasets: next }
  })
}

/** Names count as the same if they only differ in capitals, spaces or punctuation (like the lab guide). */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function retireDuplicateNames<T extends { id: string; name: string }>(list: T[], keepId: string): T[] {
  const keep = list.find((x) => x.id === keepId)
  if (!keep) return list
  const key = norm(keep.name)
  if (!key || !list.some((x) => x.id !== keepId && norm(x.name) === key)) return list
  const taken = new Set(list.map((x) => norm(x.name)))
  const oldName = () => {
    for (let n = 1; ; n++) {
      const candidate = `${keep.name.trim()} (old${n > 1 ? ` ${n}` : ''})`
      if (!taken.has(norm(candidate))) {
        taken.add(norm(candidate))
        return candidate
      }
    }
  }
  return list.map((x) => (x.id !== keepId && norm(x.name) === key ? { ...x, name: oldName() } : x))
}
