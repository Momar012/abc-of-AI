import { LabelledDatasetBlock, DataItem } from '@/types/dataset'
import { TrainedModel, TestResult } from '@/types/model'

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
  knn.setClassifierDataset(restoredDataset)

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
