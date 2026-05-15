'use client'

import { useState, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { useUIStore } from '@/store/useUIStore'
import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { trainImageSupervisedModel, runInference, clusterImages } from '@/lib/trainModel'
import { trainTextCorpus, queryTextCorpus } from '@/lib/textLearner'
import { TrainedModel, ModelType, TestResult, ChatMessage } from '@/types/model'

const MODEL_CATALOG = [
  {
    type: 'image-supervised' as ModelType,
    name: 'Image Supervised',
    icon: '🖼️',
    description: 'Teach the AI using your labelled photos. Uses MobileNet + KNN.',
    available: true,
  },
  {
    type: 'image-classifier' as ModelType,
    name: 'Image Classifier',
    icon: '🔍',
    description: 'Train a custom image classification neural network.',
    available: false,
  },
  {
    type: 'image-unsupervised' as ModelType,
    name: 'Image Unsupervised',
    icon: '🧩',
    description: 'Group similar images automatically. No labels needed. Uses K-means + MobileNet.',
    available: true,
  },
  {
    type: 'text-corpus' as ModelType,
    name: 'Text Brain',
    icon: '🧠',
    description: 'Feed it text and it learns the facts. Teach it wrong things and watch it get confused!',
    available: true,
  },
]

export default function ModelInspector() {
  const selectedBlockId = useUIStore((s) => s.selectedBlockId)
  const clearSelectedBlock = useUIStore((s) => s.clearSelectedBlock)
  const addToast = useUIStore((s) => s.addToast)
  const openTestResultsModal = useUIStore((s) => s.openTestResultsModal)
  const openClusterResultsModal = useUIStore((s) => s.openClusterResultsModal)

  const block = useModelStore((s) => s.modelBlocks.find((b) => b.id === selectedBlockId))
  const updateModelBlock = useModelStore((s) => s.updateModelBlock)
  const saveTrainedModel = useModelStore((s) => s.saveTrainedModel)
  const renameTrainedModel = useModelStore((s) => s.renameTrainedModel)
  const trainedModels = useModelStore((s) => s.trainedModels)

  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const unlabelledBlocks = useDatasetStore((s) => s.unlabelledBlocks)
  const bankItems = useDatasetStore((s) => s.bankItems)

  const [progressMessage, setProgressMessage] = useState('')
  const [progressStep, setProgressStep] = useState(0)
  const [progressTotal, setProgressTotal] = useState(100)
  const [saveName, setSaveName] = useState('')
  const [testProgress, setTestProgress] = useState(0)
  const [testTotal, setTestTotal] = useState(0)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    if (block) setSaveName(block.name)
    setChatInput('')
    setChatMessages([])
  }, [selectedBlockId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!block) return null

  const linkedLabelledBlock = labelledBlocks.find((b) => b.id === block.linkedBlockId)
  const linkedUnlabelledBlock = unlabelledBlocks.find((b) => b.id === block.linkedBlockId)
  // For unsupervised and text-corpus, allow linking to either labelled or unlabelled blocks
  const linkedBlock = (block.modelType === 'image-unsupervised' || block.modelType === 'text-corpus')
    ? (linkedLabelledBlock ?? linkedUnlabelledBlock)
    : linkedLabelledBlock
  const testLabelledBlock = labelledBlocks.find((b) => b.id === block.testLinkedBlockId)
  const testUnlabelledBlock = unlabelledBlocks.find((b) => b.id === block.testLinkedBlockId)
  const isTrainable = !!linkedBlock && (
    block.modelType === 'text-corpus'
      ? linkedBlock.itemIds.length > 0 || ('labels' in linkedBlock && linkedBlock.labels.some((l) => l.itemIds.length > 0))
      : block.modelType === 'image-unsupervised'
      ? ('labels' in linkedBlock
          ? linkedBlock.labels.some((l) => l.itemIds.length > 0) || linkedBlock.itemIds.length > 0
          : linkedBlock.itemIds.length > 0)
      : (linkedLabelledBlock?.labels.filter((l) => l.itemIds.length > 0).length ?? 0) >= 2
  )
  const isWorking = block.status === 'loading' || block.status === 'training'
  const isTesting = block.testStatus === 'running'

  // Ground truth map: itemId → { labelId, labelName } — only when test block is labelled
  const groundTruthMap: Record<string, { labelId: string; labelName: string }> = {}
  if (testLabelledBlock) {
    for (const label of testLabelledBlock.labels) {
      for (const itemId of label.itemIds) {
        groundTruthMap[itemId] = { labelId: label.id, labelName: label.name }
      }
    }
  }

  const testItemIds = testLabelledBlock
    ? testLabelledBlock.labels.flatMap((l) => l.itemIds)
    : (testUnlabelledBlock?.itemIds ?? [])
  const testItems = testItemIds
    .map((id) => bankItems.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => !!i && i.type === 'image' && !!i.content)

  // Find the TrainedModel object for inference
  const trainedModel = block.trainedModelId
    ? trainedModels.find((m) => m.id === block.trainedModelId)
    : null

  // Label color map from training block (only for labelled blocks)
  const labelColorMap: Record<string, string> = {}
  if (linkedBlock && 'labels' in linkedBlock) {
    for (const l of linkedBlock.labels) labelColorMap[l.id] = l.color
  }

  // Accuracy: only computed when results have ground truth
  const accuracy = block.testResults
    ? (() => {
        const withGT = block.testResults.filter((r) => r.actualLabelId !== null)
        if (!withGT.length) return null
        const correct = withGT.filter((r) => r.predictedLabel === r.actualLabel).length
        return { pct: Math.round((correct / withGT.length) * 100), correct, total: withGT.length }
      })()
    : null

  const handleCluster = async () => {
    if (!linkedBlock) return
    const k = block.clusterCount ?? 3

    // Collect all image items from the linked block
    const allItemIds = 'labels' in linkedBlock
      ? [...linkedBlock.itemIds, ...linkedBlock.labels.flatMap((l) => l.itemIds)]
      : [...linkedBlock.itemIds]
    const imageItems = allItemIds
      .map((id) => bankItems.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i && i.type === 'image' && !!i.content)
      .map((i) => ({ itemId: i.id, content: i.content! }))

    if (!imageItems.length) {
      addToast('⚠ No images found in the linked block.', 'warn')
      return
    }

    setProgressStep(0)
    setProgressTotal(100)
    setProgressMessage('Starting…')
    updateModelBlock(block.id, { status: 'loading', errorMessage: undefined, clusterResults: null })

    try {
      const result = await clusterImages(imageItems, k, (message, step, total) => {
        setProgressMessage(message)
        setProgressStep(step)
        setProgressTotal(total)
        if (step > 2) updateModelBlock(block.id, { status: 'training' })
      })
      updateModelBlock(block.id, { status: 'trained', clusterResults: result })
      addToast(`🧩 Grouped ${imageItems.length} images into ${k} clusters!`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Clustering failed'
      updateModelBlock(block.id, { status: 'error', errorMessage: msg })
      addToast(`❌ ${msg}`, 'warn')
    }
  }

  const handleTrainText = () => {
    if (!linkedBlock) return
    const allItemIds = 'labels' in linkedBlock
      ? [...linkedBlock.itemIds, ...linkedBlock.labels.flatMap((l) => l.itemIds)]
      : [...linkedBlock.itemIds]
    const textItems = allItemIds
      .map((id) => bankItems.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => !!i && i.type === 'text' && !!i.content)
      .map((i) => ({ content: i.content! }))

    if (!textItems.length) {
      addToast('⚠ No text items found. Upload .txt files and add them to the linked block.', 'warn')
      return
    }

    const { sentences } = trainTextCorpus(textItems)
    updateModelBlock(block.id, { status: 'trained', textSentences: sentences })
    setChatMessages((prev) => [
      ...prev,
      { role: 'ai', text: `I've read ${sentences.length} sentence${sentences.length !== 1 ? 's' : ''}! Go ahead, ask me anything 🧠` },
    ])
    addToast(`🧠 Text Brain trained on ${sentences.length} sentences!`, 'success')
  }

  const handleChat = () => {
    const q = chatInput.trim()
    if (!q) return
    const userMsg: ChatMessage = { role: 'user', text: q }
    setChatInput('')

    if (!block.textSentences?.length) {
      setChatMessages((prev) => [
        ...prev,
        userMsg,
        { role: 'ai', text: "I haven't learned anything yet! Link some text and hit 'Feed the Brain' first." },
      ])
      return
    }

    const { answer } = queryTextCorpus(q, block.textSentences)
    setChatMessages((prev) => [...prev, userMsg, { role: 'ai', text: answer }])
  }

  const handleTrain = async () => {
    if (!linkedLabelledBlock) return
    setProgressStep(0)
    setProgressTotal(100)
    setProgressMessage('Starting…')
    updateModelBlock(block.id, { status: 'loading', errorMessage: undefined, trainedModelId: null })

    try {
      const result = await trainImageSupervisedModel(
        linkedLabelledBlock,
        bankItems,
        (message, step, total) => {
          setProgressMessage(message)
          setProgressStep(step)
          setProgressTotal(total)
          if (step > 2) updateModelBlock(block.id, { status: 'training' })
        }
      )

      const trained: TrainedModel = {
        id: uuid(),
        name: saveName.trim() || block.name,
        trainedAt: Date.now(),
        modelType: block.modelType!,
        ...result,
      }

      saveTrainedModel(trained)
      updateModelBlock(block.id, { status: 'trained', trainedModelId: trained.id })
      addToast(`🎉 "${trained.name}" trained successfully!`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Training failed'
      updateModelBlock(block.id, { status: 'error', errorMessage: msg })
      addToast(`❌ ${msg}`, 'warn')
    }
  }

  const handleTest = async () => {
    if (!trainedModel || !testItems.length) return
    setTestProgress(0)
    setTestTotal(testItems.length + 2)
    updateModelBlock(block.id, { testStatus: 'running', testResults: null })

    try {
      const raw = await runInference(trainedModel, testItems, (step, total) => {
        setTestProgress(step)
        setTestTotal(total)
      })
      const enriched: TestResult[] = raw.map((r) => ({
        ...r,
        actualLabelId: groundTruthMap[r.itemId]?.labelId ?? null,
        actualLabel: groundTruthMap[r.itemId]?.labelName ?? null,
      }))
      updateModelBlock(block.id, { testStatus: 'done', testResults: enriched })
      const hasGT = enriched.some((r) => r.actualLabelId !== null)
      if (hasGT) {
        const correct = enriched.filter((r) => r.predictedLabel === r.actualLabel).length
        const pct = Math.round((correct / enriched.length) * 100)
        addToast(`🔬 Test complete: ${pct}% accurate (${correct}/${enriched.length})`, 'success')
      } else {
        addToast(`🔬 Test complete: ${enriched.length} images classified!`, 'success')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Testing failed'
      updateModelBlock(block.id, { testStatus: 'error' })
      addToast(`❌ ${msg}`, 'warn')
    }
  }

  const progressPct = progressTotal > 0 ? Math.round((progressStep / progressTotal) * 100) : 5
  const testPct = testTotal > 0 ? Math.round((testProgress / testTotal) * 100) : 5

  return (
    <div className="glass-card flex flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <div>
            <p className="text-sm font-heading font-bold text-white">{block.name}</p>
            <p className="text-xs text-white/40 font-body">Model Block</p>
          </div>
        </div>
        <button
          onClick={clearSelectedBlock}
          className="w-7 h-7 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 text-sm flex items-center justify-center transition-all"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-0">

        {/* Step 1: Model catalog */}
        <div className="px-4 py-3 border-b border-white/8">
          <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
            1 · Select Model
          </p>
          <div className="flex flex-col gap-2">
            {MODEL_CATALOG.map((m) => {
              const selected = block.modelType === m.type
              return (
                <div
                  key={m.type}
                  onClick={() => m.available && updateModelBlock(block.id, { modelType: m.type, status: 'idle' })}
                  className={`relative rounded-xl p-3 border transition-all ${
                    selected
                      ? 'border-violet-400 bg-violet-500/20 cursor-pointer'
                      : m.available
                      ? 'border-white/15 bg-white/5 cursor-pointer hover:bg-white/10 hover:border-white/25'
                      : 'border-white/8 bg-white/3 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0 mt-0.5">{m.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-bold text-white leading-tight">{m.name}</p>
                      <p className="text-xs text-white/50 font-body mt-0.5 leading-snug">{m.description}</p>
                    </div>
                  </div>
                  {!m.available && (
                    <span className="absolute top-2 right-2 text-xs bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full font-body">
                      🔒 Soon
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-2 right-2 text-xs bg-violet-500/60 text-white px-1.5 py-0.5 rounded-full font-body">
                      ✓ Selected
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step 2: Link training dataset (via canvas) */}
        {block.modelType && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
              2 · Link Training Data
            </p>

            {block.linkedBlockId && linkedBlock ? (
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/30 flex flex-col gap-1.5">
                <p className="text-xs text-emerald-400 font-body font-semibold">✓ Connected</p>
                <p className="text-xs text-white/70 font-body">{linkedBlock.name}</p>
                {block.modelType === 'text-corpus' ? (
                  <p className="text-xs text-white/50 font-body">
                    {'labels' in linkedBlock
                      ? `${linkedBlock.itemIds.length + linkedBlock.labels.reduce((s, l) => s + l.itemIds.length, 0)} text items`
                      : `${linkedBlock.itemIds.length} text items`}
                  </p>
                ) : block.modelType === 'image-unsupervised' ? (
                  <p className="text-xs text-white/50 font-body">
                    {'labels' in linkedBlock
                      ? `${linkedBlock.itemIds.length + linkedBlock.labels.reduce((s, l) => s + l.itemIds.length, 0)} images`
                      : `${linkedBlock.itemIds.length} images`}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {linkedLabelledBlock?.labels.filter((l) => l.itemIds.length > 0).map((label) => (
                        <span
                          key={label.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body"
                          style={{
                            background: `${label.color}22`,
                            border: `1px solid ${label.color}55`,
                            color: label.color,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: label.color }} />
                          {label.name} ({label.itemIds.length})
                        </span>
                      ))}
                    </div>
                    {!isTrainable && (
                      <p className="text-xs text-amber-400/80 font-body mt-0.5">
                        ⚠ Need at least 2 labels with images assigned.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 font-body leading-relaxed">
                  {block.modelType === 'text-corpus'
                    ? <>🔗 Upload .txt files to the Data Bank, drop them into a 📦 Unlabelled block, then drag from its <span className="text-violet-300 font-semibold">violet dot</span> to the <span className="text-cyan-300 font-semibold">cyan dot</span> on this block.</>
                    : block.modelType === 'image-unsupervised'
                    ? <>🔗 On the canvas, drag from the <span className="text-violet-300 font-semibold">violet dot</span> on a 🏷️ Labelled or 📦 Unlabelled block to the <span className="text-cyan-300 font-semibold">cyan dot</span> on this block.</>
                    : <>🔗 On the canvas, drag from the <span className="text-violet-300 font-semibold">violet dot</span> on a 🏷️ Labelled block to the <span className="text-cyan-300 font-semibold">cyan dot</span> on this block.</>
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Train / Cluster */}
        {block.modelType && block.linkedBlockId && (
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider mb-2">
              {block.modelType === 'image-unsupervised' ? '3 · Cluster' : block.modelType === 'text-corpus' ? '3 · Feed the Brain' : '3 · Train'}
            </p>

            {block.status === 'error' && block.errorMessage && (
              <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400 font-body">{block.errorMessage}</p>
              </div>
            )}

            {isWorking && (
              <div className="mb-3 flex flex-col gap-1.5">
                <p className="text-xs text-white/60 font-body">{progressMessage}</p>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, progressPct)}%` }}
                  />
                </div>
                <p className="text-xs text-white/30 font-body text-right">{progressPct}%</p>
              </div>
            )}

            {block.modelType === 'text-corpus' ? (
              <>
                {block.status === 'trained' && block.textSentences && (
                  <div className="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400 font-body font-semibold">
                      ✓ Learned {block.textSentences.length} sentences
                    </p>
                  </div>
                )}
                <button
                  onClick={handleTrainText}
                  disabled={!isTrainable}
                  className={`w-full py-2 rounded-lg text-sm font-heading font-semibold transition-all ${
                    isTrainable
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {block.status === 'trained' ? '🔁 Re-feed' : '🧠 Feed the Brain'}
                </button>
              </>
            ) : block.modelType === 'image-unsupervised' ? (
              <>
                {/* k-picker */}
                {!isWorking && (
                  <div className="mb-3 flex flex-col gap-1.5">
                    <p className="text-xs text-white/50 font-body">Number of groups:</p>
                    <div className="flex flex-wrap gap-1">
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => {
                        const selected = (block.clusterCount ?? 3) === n
                        return (
                          <button
                            key={n}
                            onClick={() => updateModelBlock(block.id, {
                              clusterCount: n,
                              clusterResults: null,
                              status: block.status === 'trained' ? 'idle' : block.status,
                            })}
                            className={`w-8 h-8 rounded-full text-sm font-heading font-bold transition-all ${
                              selected
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {block.status === 'trained' && block.clusterResults && (
                  <div className="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400 font-body font-semibold">
                      ✓ {block.clusterResults.length} images grouped into {block.clusterCount ?? 3} clusters
                    </p>
                  </div>
                )}

                <button
                  onClick={handleCluster}
                  disabled={!isTrainable || isWorking}
                  className={`w-full py-2 rounded-lg text-sm font-heading font-semibold transition-all ${
                    isWorking
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : isTrainable
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {isWorking
                    ? block.status === 'loading'
                      ? '⚙️ Loading AI…'
                      : '🔄 Clustering…'
                    : block.status === 'trained' && block.clusterResults
                    ? '🔁 Re-cluster'
                    : '🧩 Cluster Images'}
                </button>
              </>
            ) : (
              <>
                {block.status === 'trained' && (
                  <div className="mb-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-xs text-emerald-400 font-body font-semibold">✓ Training complete!</p>
                    {linkedLabelledBlock && (
                      <p className="text-xs text-white/50 font-body mt-0.5">
                        {linkedLabelledBlock.labels.filter((l) => l.itemIds.length > 0).length} labels ·{' '}
                        {linkedLabelledBlock.labels.reduce((s, l) => s + l.itemIds.length, 0)} images trained
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleTrain}
                  disabled={!isTrainable || isWorking}
                  className={`w-full py-2 rounded-lg text-sm font-heading font-semibold transition-all ${
                    isWorking
                      ? 'bg-white/10 text-white/40 cursor-not-allowed'
                      : isTrainable
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {isWorking
                    ? block.status === 'loading'
                      ? '⚙️ Loading AI…'
                      : '🔄 Training…'
                    : block.status === 'trained'
                    ? '🔁 Retrain'
                    : '🚀 Train Model'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 4: Chat with the Brain (text-corpus only — always visible once model type selected) */}
        {block.modelType === 'text-corpus' && (
          <div className="px-4 py-4 border-b border-white/8 flex flex-col gap-3">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider">
              4 · Chat with the Brain
            </p>

            {/* Message list */}
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
              {chatMessages.length === 0 && (
                <p className="text-xs text-white/30 font-body text-center py-4">
                  {block.status === 'trained'
                    ? 'Ask me anything! Try: "Where did Humpty sit?"'
                    : 'Feed me some text first, then ask me anything!'}
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-xs font-body leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-violet-600/70 text-white rounded-br-sm'
                        : 'bg-white/10 text-white/85 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'ai' && <span className="mr-1">🧠</span>}
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input row */}
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask a question…"
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-xs placeholder-white/30 outline-none focus:border-violet-400 font-body"
              />
              <button
                onClick={handleChat}
                disabled={!chatInput.trim()}
                className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 text-white text-xs font-heading font-semibold transition-all"
              >
                Ask
              </button>
            </div>

            {block.status === 'trained' && (
              <p className="text-xs text-white/30 font-body text-center leading-relaxed">
                Try changing your text, hitting Re-feed, and asking again!
              </p>
            )}
          </div>
        )}

        {/* Step 4: Name result (supervised and unsupervised, not text-corpus) */}
        {block.status === 'trained' && block.modelType !== 'text-corpus' && (
          <div className="px-4 py-4 border-b border-white/8 flex flex-col gap-2">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider">
              {block.modelType === 'image-unsupervised' ? '4 · Name Your Result' : '4 · Save to My Models'}
            </p>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Model name…"
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm placeholder-white/30 outline-none focus:border-violet-400 font-body"
              maxLength={60}
            />
            <button
              onClick={() => {
                const name = saveName.trim() || block.name
                if (block.trainedModelId) renameTrainedModel(block.trainedModelId, name)
                updateModelBlock(block.id, { name })
                addToast(`💾 "${name}" saved!`, 'success')
              }}
              className="w-full py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500/80 text-white text-sm font-heading font-semibold transition-colors"
            >
              💾 Save Name
            </button>
            {block.modelType !== 'image-unsupervised' && (
              <p className="text-xs text-white/30 font-body text-center">
                Check the 🤖 My Models tab in the left panel
              </p>
            )}
          </div>
        )}

        {/* Step 5: Explore Clusters (unsupervised) or Test Model (supervised) */}
        {block.status === 'trained' && block.modelType === 'image-unsupervised' && block.clusterResults && (
          <div className="px-4 py-4 flex flex-col gap-2">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider">
              5 · Explore Clusters
            </p>
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/30">
              <p className="text-xs text-violet-300 font-body font-semibold">
                ✓ {block.clusterResults.length} images grouped into {block.clusterCount ?? 3} clusters
              </p>
            </div>
            <button
              onClick={() => openClusterResultsModal(block.id)}
              className="w-full py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500/80 text-white text-sm font-heading font-semibold transition-colors"
            >
              🔍 View Clusters
            </button>
          </div>
        )}

        {/* Step 5: Test with test set */}
        {block.status === 'trained' && block.modelType !== 'image-unsupervised' && block.modelType !== 'text-corpus' && (
          <div className="px-4 py-4 flex flex-col gap-2">
            <p className="text-xs text-white/50 font-heading font-semibold uppercase tracking-wider">
              5 · Test Model
            </p>

            {!block.testLinkedBlockId ? (
              <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 font-body leading-relaxed">
                  🔗 Drag from the <span className="text-amber-300 font-semibold">lower amber dot</span> on a 🗂️ Labelled block (test with accuracy) or 📦 Unlabelled block (predictions only) to the <span className="text-amber-300 font-semibold">amber dot</span> on this block.
                </p>
              </div>
            ) : (
              <>
                {/* Test set info */}
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col gap-1">
                  <p className="text-xs text-amber-300 font-body font-semibold">
                    {testLabelledBlock ? '🗂️' : '📦'} {(testLabelledBlock ?? testUnlabelledBlock)?.name ?? 'Test block'} · {testItems.length} image{testItems.length !== 1 ? 's' : ''}
                  </p>
                  {testLabelledBlock && (
                    <div className="flex flex-wrap gap-1">
                      {testLabelledBlock.labels.filter((l) => l.itemIds.length > 0).map((label) => (
                        <span
                          key={label.id}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-body"
                          style={{ background: `${label.color}22`, border: `1px solid ${label.color}55`, color: label.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: label.color }} />
                          {label.name} ({label.itemIds.length})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress bar when running */}
                {isTesting && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-white/60 font-body">Running inference…</p>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, testPct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/30 font-body text-right">{testPct}%</p>
                  </div>
                )}

                {/* Run Test button */}
                {!isTesting && (
                  <button
                    onClick={handleTest}
                    disabled={testItems.length === 0 || !trainedModel}
                    className={`w-full py-2 rounded-lg text-sm font-heading font-semibold transition-all ${
                      testItems.length === 0 || !trainedModel
                        ? 'bg-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-amber-600/80 hover:bg-amber-500/80 text-white'
                    }`}
                  >
                    {block.testStatus === 'done' ? '🔁 Re-run Test' : '🔬 Run Test'}
                  </button>
                )}

                {/* Compact results summary + expand button */}
                {block.testStatus === 'done' && block.testResults && block.testResults.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-xs text-emerald-400 font-body font-semibold">
                        ✓ {block.testResults.length} images tested
                        {accuracy !== null ? ` · ${accuracy.pct}% accurate (${accuracy.correct}/${accuracy.total})` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => openTestResultsModal(block.id)}
                      className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-heading font-semibold transition-all"
                    >
                      ↗ Expand Results
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
