import { LabelledDatasetBlock, DataItem } from '@/types/dataset'
import { TrainedModel, TestResult, ClusterResult } from '@/types/model'

type ProgressCallback = (message: string, step: number, total: number) => void

function decodeImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.crossOrigin = 'anonymous'
    img.src = base64
  })
}

export async function trainImageSupervisedModel(
  block: LabelledDatasetBlock,
  bankItems: DataItem[],
  onProgress: ProgressCallback
): Promise<Pick<TrainedModel, 'labels' | 'labelIds' | 'itemCount' | 'knnData'>> {
  const labelsWithItems = block.labels.filter((l) => l.itemIds.length > 0)

  if (labelsWithItems.length < 2) {
    throw new Error('Need at least 2 labels with images assigned to train.')
  }

  const totalImages = labelsWithItems.reduce((sum, l) => sum + l.itemIds.length, 0)
  const bankMap = new Map(bankItems.map((item) => [item.id, item]))

  onProgress('Loading AI engine…', 0, totalImages + 3)
  const tf = await import('@tensorflow/tfjs')

  onProgress('Loading vision model…', 1, totalImages + 3)
  const mobilenetModule = await import('@tensorflow-models/mobilenet')

  onProgress('Initializing classifier…', 2, totalImages + 3)
  const knnModule = await import('@tensorflow-models/knn-classifier')

  const mobileNet = await mobilenetModule.load({ version: 2, alpha: 0.5 })
  const knn = knnModule.create()

  let processedImages = 3

  for (const label of labelsWithItems) {
    for (const itemId of label.itemIds) {
      const bankItem = bankMap.get(itemId)
      if (!bankItem || bankItem.type !== 'image' || !bankItem.content) continue

      onProgress(
        `Learning "${label.name}"… (${processedImages - 2}/${totalImages})`,
        processedImages,
        totalImages + 3
      )

      const img = await decodeImage(bankItem.content)
      const imgTensor = tf.browser.fromPixels(img)
      const features = mobileNet.infer(imgTensor, true) as ReturnType<typeof tf.tensor>

      knn.addExample(features, label.id)

      imgTensor.dispose()
      features.dispose()

      processedImages++
    }
  }

  onProgress('Saving model…', totalImages + 3, totalImages + 3)
  const dataset = knn.getClassifierDataset()
  const knnData: Record<string, { values: number[]; shape: number[] }> = {}

  for (const [key, tensor] of Object.entries(dataset)) {
    const values = Array.from(await tensor.data())
    knnData[key] = { values, shape: tensor.shape }
    tensor.dispose()
  }

  return {
    labels: labelsWithItems.map((l) => l.name),
    labelIds: labelsWithItems.map((l) => l.id),
    itemCount: totalImages,
    knnData,
  }
}

export async function runInference(
  trainedModel: TrainedModel,
  testItems: DataItem[],
  onProgress: (step: number, total: number) => void
): Promise<TestResult[]> {
  if (!testItems.length) throw new Error('No test images provided.')

  onProgress(0, testItems.length + 2)
  const tf = await import('@tensorflow/tfjs')

  onProgress(1, testItems.length + 2)
  const mobilenetModule = await import('@tensorflow-models/mobilenet')
  const knnModule = await import('@tensorflow-models/knn-classifier')

  // Restore KNN dataset from saved tensors
  const knn = knnModule.create()
  const restoredDataset: Record<string, ReturnType<typeof tf.tensor>> = {}
  for (const [key, { values, shape }] of Object.entries(trainedModel.knnData)) {
    restoredDataset[key] = tf.tensor(values, shape as [number, number])
  }
  knn.setClassifierDataset(restoredDataset as Parameters<typeof knn.setClassifierDataset>[0])

  const mobileNet = await mobilenetModule.load({ version: 2, alpha: 0.5 })

  const results: TestResult[] = []
  let step = 2

  for (const item of testItems) {
    if (!item.content || item.type !== 'image') {
      step++
      onProgress(step, testItems.length + 2)
      continue
    }

    const img = await decodeImage(item.content)
    const imgTensor = tf.browser.fromPixels(img)
    const features = mobileNet.infer(imgTensor, true) as ReturnType<typeof tf.tensor>

    const prediction = await knn.predictClass(features)

    imgTensor.dispose()
    features.dispose()

    // Map labelId back to label name
    const labelIdx = trainedModel.labelIds.indexOf(prediction.label)
    const predictedLabel = labelIdx >= 0 ? trainedModel.labels[labelIdx] : prediction.label

    // Convert confidences: labelId → score
    const allConfidences: Record<string, number> = {}
    for (const [labelId, score] of Object.entries(prediction.confidences)) {
      allConfidences[labelId] = score
    }

    results.push({
      itemId: item.id,
      predictedLabel,
      predictedLabelId: prediction.label,
      confidence: prediction.confidences[prediction.label] ?? 0,
      allConfidences,
      actualLabelId: null,
      actualLabel: null,
    })

    step++
    onProgress(step, testItems.length + 2)
  }

  // Clean up restored tensors
  for (const tensor of Object.values(restoredDataset)) {
    tensor.dispose()
  }

  return results
}

function sqDist(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)
}

function runKMeans(features: number[][], k: number): number[] {
  const n = features.length
  if (k >= n) return features.map((_, i) => i % k)

  // K-means++ initialization
  const centroids: number[][] = [[...features[Math.floor(Math.random() * n)]]]
  for (let c = 1; c < k; c++) {
    const dists = features.map((f) => Math.min(...centroids.map((ct) => sqDist(f, ct))))
    const total = dists.reduce((s, d) => s + d, 0)
    let r = Math.random() * total
    let chosen = n - 1
    for (let i = 0; i < n; i++) {
      r -= dists[i]
      if (r <= 0) { chosen = i; break }
    }
    centroids.push([...features[chosen]])
  }

  let assignments = new Array<number>(n).fill(0)
  const dim = features[0].length

  for (let iter = 0; iter < 20; iter++) {
    const next = features.map((f) => {
      let best = 0
      let bestDist = sqDist(f, centroids[0])
      for (let c = 1; c < k; c++) {
        const d = sqDist(f, centroids[c])
        if (d < bestDist) { bestDist = d; best = c }
      }
      return best
    })
    const converged = next.every((a, i) => a === assignments[i])
    assignments = next
    if (converged) break
    for (let c = 0; c < k; c++) {
      const members = features.filter((_, i) => assignments[i] === c)
      if (!members.length) continue
      for (let d = 0; d < dim; d++) {
        centroids[c][d] = members.reduce((s, f) => s + f[d], 0) / members.length
      }
    }
  }

  return assignments
}

export async function clusterImages(
  items: Array<{ itemId: string; content: string }>,
  k: number,
  onProgress: ProgressCallback
): Promise<ClusterResult[]> {
  const n = items.length

  onProgress('Loading AI engine…', 0, n + 3)
  const tf = await import('@tensorflow/tfjs')

  onProgress('Loading vision model…', 1, n + 3)
  const mobilenetModule = await import('@tensorflow-models/mobilenet')

  onProgress('Initialising…', 2, n + 3)
  const mobileNet = await mobilenetModule.load({ version: 2, alpha: 0.5 })

  const allFeatures: number[][] = []
  for (let i = 0; i < n; i++) {
    onProgress(`Analysing image ${i + 1}/${n}…`, 3 + i, n + 3)
    const img = await decodeImage(items[i].content)
    const imgTensor = tf.browser.fromPixels(img)
    const features = mobileNet.infer(imgTensor, true) as ReturnType<typeof tf.tensor>
    allFeatures.push(Array.from(await features.data()))
    imgTensor.dispose()
    features.dispose()
  }

  const assignments = runKMeans(allFeatures, Math.min(k, n))
  return items.map((item, i) => ({ itemId: item.itemId, clusterId: assignments[i] }))
}
