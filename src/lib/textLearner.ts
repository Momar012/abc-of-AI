import type { LabelledDatasetBlock } from '@/types/dataset'
import type { DataItem } from '@/types/dataset'
import type { TrainedModel, TestResult, ClusterResult } from '@/types/model'

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function buildVocab(sentences: string[]): string[] {
  const set = new Set<string>()
  for (const s of sentences) for (const w of tokenize(s)) set.add(w)
  return Array.from(set)
}

function tf(word: string, tokens: string[]): number {
  const count = tokens.filter((t) => t === word).length
  return count / tokens.length
}

function idf(word: string, sentences: string[]): number {
  const docsWithWord = sentences.filter((s) => tokenize(s).includes(word)).length
  return docsWithWord === 0 ? 0 : Math.log(sentences.length / docsWithWord)
}

function tfidfVector(text: string, allSentences: string[], vocab: string[]): number[] {
  const tokens = tokenize(text)
  return vocab.map((word) => tf(word, tokens) * idf(word, allSentences))
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export function trainTextCorpus(items: { content: string }[]): { sentences: string[] } {
  const sentences: string[] = []
  for (const item of items) {
    for (const s of splitSentences(item.content)) {
      sentences.push(s)
    }
  }
  return { sentences }
}

export function queryTextCorpus(
  question: string,
  sentences: string[]
): { answer: string; score: number } {
  if (!sentences.length) {
    return { answer: "I haven't learned anything yet! Feed me some text first.", score: 0 }
  }

  const vocab = buildVocab([question, ...sentences])
  const questionVec = tfidfVector(question, sentences, vocab)

  let bestScore = -1
  let bestSentence = ''

  for (const sentence of sentences) {
    const sentVec = tfidfVector(sentence, sentences, vocab)
    const score = cosineSim(questionVec, sentVec)
    if (score > bestScore) {
      bestScore = score
      bestSentence = sentence
    }
  }

  if (bestScore < 0.05) {
    return {
      answer: "I'm not sure about that. Try asking something from the text you gave me!",
      score: bestScore,
    }
  }

  return { answer: bestSentence, score: bestScore }
}

export function trainTextSupervisedModel(
  block: LabelledDatasetBlock,
  bankItems: DataItem[],
  onProgress: (message: string, step: number, total: number) => void
): Pick<TrainedModel, 'labels' | 'labelIds' | 'itemCount' | 'knnData' | 'textVocab' | 'nbWordLogProbs' | 'nbClassLogPriors'> {
  const labelsWithItems = block.labels.filter((l) => l.itemIds.length > 0)
  if (labelsWithItems.length < 2) throw new Error('Need at least 2 labels with text items assigned to train.')

  const bankMap = new Map(bankItems.map((i) => [i.id, i]))
  const allTexts: string[] = []
  const labelTexts: string[][] = labelsWithItems.map(() => [])

  for (let li = 0; li < labelsWithItems.length; li++) {
    for (const itemId of labelsWithItems[li].itemIds) {
      const item = bankMap.get(itemId)
      if (item && item.type === 'text' && item.content) {
        allTexts.push(item.content)
        labelTexts[li].push(item.content)
      }
    }
  }
  if (!allTexts.length) throw new Error('No text items found in the labelled block.')

  const total = labelsWithItems.length + 2
  onProgress('Building vocabulary…', 0, total)

  const vocab = buildVocab(allTexts)
  const vocabIdx: Record<string, number> = {}
  vocab.forEach((w, i) => { vocabIdx[w] = i })

  onProgress('Training Naive Bayes classifier…', 1, total)

  const nbWordLogProbs: Record<string, number[]> = {}
  const nbClassLogPriors: Record<string, number> = {}

  for (let li = 0; li < labelsWithItems.length; li++) {
    const label = labelsWithItems[li]
    const texts = labelTexts[li]
    onProgress(`Learning class "${label.name}"…`, li + 2, total)

    // Count word occurrences across all items in this class
    const wordCounts = new Array(vocab.length).fill(0)
    let totalWords = 0
    for (const text of texts) {
      for (const token of tokenize(text)) {
        const idx = vocabIdx[token]
        if (idx !== undefined) { wordCounts[idx]++; totalWords++ }
      }
    }

    // Log prior: P(class) = docs in class / total docs
    nbClassLogPriors[label.id] = Math.log(texts.length / allTexts.length)

    // Log P(word|class) with Laplace smoothing (α=1): (count+1) / (totalWords + vocabSize)
    nbWordLogProbs[label.id] = wordCounts.map(c => Math.log((c + 1) / (totalWords + vocab.length)))
  }

  return {
    labels: labelsWithItems.map((l) => l.name),
    labelIds: labelsWithItems.map((l) => l.id),
    itemCount: allTexts.length,
    knnData: {},
    textVocab: vocab,
    nbWordLogProbs,
    nbClassLogPriors,
  }
}

export function runTextInference(
  trainedModel: TrainedModel,
  testItems: DataItem[],
  onProgress: (step: number, total: number) => void
): TestResult[] {
  const { textVocab, labels, labelIds, nbWordLogProbs, nbClassLogPriors } = trainedModel
  if (!textVocab) throw new Error('This model has no text training data. Please retrain.')

  // ── Naive Bayes path (models trained with current version) ──────────────────
  if (nbWordLogProbs && nbClassLogPriors) {
    const vocabIdx: Record<string, number> = {}
    textVocab.forEach((w, i) => { vocabIdx[w] = i })

    const textTestItems = testItems.filter((i) => i.type === 'text' && i.content)
    const results: TestResult[] = []
    const total = textTestItems.length

    textTestItems.forEach((item, idx) => {
      onProgress(idx, total)
      const tokens = tokenize(item.content)

      // log P(class | doc) = log P(class) + Σ count(word) × log P(word | class)
      const logScores: Record<string, number> = {}
      for (const labelId of labelIds) {
        const prior = nbClassLogPriors[labelId] ?? Math.log(1 / labelIds.length)
        const wordLogProbs = nbWordLogProbs[labelId] ?? []
        let score = prior
        for (const token of tokens) {
          const wi = vocabIdx[token]
          if (wi !== undefined) score += wordLogProbs[wi]
        }
        logScores[labelId] = score
      }

      // Softmax over log-scores → probabilities
      const maxScore = Math.max(...labelIds.map(lid => logScores[lid]))
      let sumExp = 0
      const expScores: Record<string, number> = {}
      for (const labelId of labelIds) {
        expScores[labelId] = Math.exp(logScores[labelId] - maxScore)
        sumExp += expScores[labelId]
      }
      const allConfidences: Record<string, number> = {}
      for (const labelId of labelIds) allConfidences[labelId] = expScores[labelId] / sumExp

      const predictedLabelId = labelIds.reduce((best, lid) =>
        allConfidences[lid] > allConfidences[best] ? lid : best, labelIds[0])
      const labelIdx = labelIds.indexOf(predictedLabelId)

      results.push({
        itemId: item.id,
        predictedLabel: labels[labelIdx] ?? predictedLabelId,
        predictedLabelId,
        confidence: allConfidences[predictedLabelId],
        allConfidences,
        actualLabelId: null,
        actualLabel: null,
      })
    })

    onProgress(total, total)
    return results
  }

  // ── Legacy KNN path (models trained before Naive Bayes upgrade) ─────────────
  const { textIdfWeights, textAllVectors } = trainedModel
  if (!textIdfWeights || !textAllVectors) throw new Error('Outdated model format. Please retrain.')

  const textTestItems = testItems.filter((i) => i.type === 'text' && i.content)
  const K = Math.min(3, textAllVectors.length)
  const results: TestResult[] = []
  const total = textTestItems.length

  textTestItems.forEach((item, idx) => {
    onProgress(idx, total)
    const tokens = tokenize(item.content)
    const testVec = textVocab.map((w, j) => tf(w, tokens) * textIdfWeights[j])
    const sims = textAllVectors.map((e) => ({ labelId: e.labelId, sim: cosineSim(testVec, e.vec) }))
    sims.sort((a, b) => b.sim - a.sim)
    const topK = sims.slice(0, K)
    const votes: Record<string, number> = {}
    const simSums: Record<string, number> = {}
    for (const labelId of labelIds) { votes[labelId] = 0; simSums[labelId] = 0 }
    for (const { labelId, sim } of topK) { votes[labelId]++; simSums[labelId] += sim }
    const allConfidences: Record<string, number> = {}
    for (const labelId of labelIds) allConfidences[labelId] = votes[labelId] / K
    const predictedLabelId = labelIds.reduce((best, lid) =>
      votes[lid] > votes[best] || (votes[lid] === votes[best] && simSums[lid] > simSums[best]) ? lid : best
    , labelIds[0])
    const labelIdx = labelIds.indexOf(predictedLabelId)
    results.push({
      itemId: item.id,
      predictedLabel: labels[labelIdx] ?? predictedLabelId,
      predictedLabelId,
      confidence: allConfidences[predictedLabelId],
      allConfidences,
      actualLabelId: null,
      actualLabel: null,
    })
  })

  onProgress(total, total)
  return results
}

function sqDist(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return s
}

function runKMeansText(features: number[][], k: number): number[] {
  const n = features.length
  const dim = features[0]?.length ?? 0
  if (n === 0 || k <= 0) return []
  const clampedK = Math.min(k, n)

  // K-means++ init
  const centroids: number[][] = [features[Math.floor(Math.random() * n)]]
  while (centroids.length < clampedK) {
    const dists = features.map((f) => Math.min(...centroids.map((c) => sqDist(f, c))))
    const sum = dists.reduce((a, b) => a + b, 0)
    let r = Math.random() * sum
    let chosen = 0
    for (let i = 0; i < n; i++) { r -= dists[i]; if (r <= 0) { chosen = i; break } }
    centroids.push([...features[chosen]])
  }

  const assignments = new Array(n).fill(0)
  for (let iter = 0; iter < 20; iter++) {
    // Assign
    for (let i = 0; i < n; i++) {
      let best = 0, bestD = Infinity
      for (let c = 0; c < clampedK; c++) { const d = sqDist(features[i], centroids[c]); if (d < bestD) { bestD = d; best = c } }
      assignments[i] = best
    }
    // Update
    const sums = Array.from({ length: clampedK }, () => new Array(dim).fill(0))
    const counts = new Array(clampedK).fill(0)
    for (let i = 0; i < n; i++) { const c = assignments[i]; counts[c]++; for (let d = 0; d < dim; d++) sums[c][d] += features[i][d] }
    for (let c = 0; c < clampedK; c++) {
      if (counts[c] > 0) for (let d = 0; d < dim; d++) centroids[c][d] = sums[c][d] / counts[c]
    }
  }
  return assignments
}

export function clusterTexts(
  items: Array<{ itemId: string; content: string }>,
  k: number,
  onProgress: (message: string, step: number, total: number) => void
): ClusterResult[] {
  const n = items.length
  if (n === 0) throw new Error('No text items found.')

  const total = n + 2
  onProgress('Building vocabulary…', 0, total)

  const allTexts = items.map((i) => i.content)
  const vocab = buildVocab(allTexts)
  const idfWeights = vocab.map((w) => idf(w, allTexts))

  onProgress('Vectorizing texts…', 1, total)

  const features: number[][] = items.map((item, idx) => {
    onProgress('Vectorizing texts…', 1 + idx, total)
    const tokens = tokenize(item.content)
    return vocab.map((w, j) => tf(w, tokens) * idfWeights[j])
  })

  onProgress('Clustering…', n + 1, total)
  const assignments = runKMeansText(features, Math.min(k, n))
  onProgress('Done', total, total)

  return items.map((item, i) => ({ itemId: item.itemId, clusterId: assignments[i] }))
}
