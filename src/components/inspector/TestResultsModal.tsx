'use client'

import { useUIStore } from '@/store/useUIStore'
import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'

export default function TestResultsModal() {
  const blockId = useUIStore((s) => s.testResultsModalBlockId)
  const closeTestResultsModal = useUIStore((s) => s.closeTestResultsModal)
  const block = useModelStore((s) => s.modelBlocks.find((b) => b.id === blockId))
  const trainedModels = useModelStore((s) => s.trainedModels)
  const labelledBlocks = useDatasetStore((s) => s.labelledBlocks)
  const bankItems = useDatasetStore((s) => s.bankItems)

  if (!block || !block.testResults || block.testResults.length === 0) return null

  const trainedModel = block.trainedModelId
    ? trainedModels.find((m) => m.id === block.trainedModelId)
    : null

  // Build color map from trained model labels
  const labelColorMap: Record<string, string> = {}
  if (trainedModel) {
    const trainingBlock = labelledBlocks.find((b) =>
      b.labels.some((l) => trainedModel.labelIds.includes(l.id))
    )
    if (trainingBlock) {
      for (const l of trainingBlock.labels) labelColorMap[l.id] = l.color
    }
  }

  const results = block.testResults
  const withGT = results.filter((r) => r.actualLabel !== null)
  const accuracy =
    withGT.length > 0
      ? {
          pct: Math.round(
            (withGT.filter((r) => r.predictedLabel === r.actualLabel).length / withGT.length) * 100
          ),
          correct: withGT.filter((r) => r.predictedLabel === r.actualLabel).length,
          total: withGT.length,
        }
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={closeTestResultsModal}
    >
      <div
        className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ border: '1px solid rgba(245,158,11,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔬</span>
            <div>
              <p className="text-sm font-heading font-bold text-white">Test Results: {block.name}</p>
              <p className="text-xs text-white/40 font-body">{results.length} {block.modelType === 'text-supervised' ? 'texts' : 'images'} evaluated</p>
            </div>
          </div>
          <button
            onClick={closeTestResultsModal}
            className="w-8 h-8 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        {/* Accuracy badge */}
        {accuracy !== null && (
          <div className="px-5 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: accuracy.pct >= 70 ? 'rgba(52,211,153,0.15)' : accuracy.pct >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${accuracy.pct >= 70 ? 'rgba(52,211,153,0.4)' : accuracy.pct >= 40 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}` }}
              >
                <span className="text-2xl font-heading font-bold" style={{ color: accuracy.pct >= 70 ? '#34D399' : accuracy.pct >= 40 ? '#F59E0B' : '#EF4444' }}>
                  {accuracy.pct}%
                </span>
                <div>
                  <p className="text-xs font-heading font-bold text-white">Accuracy</p>
                  <p className="text-xs font-body text-white/50">{accuracy.correct} of {accuracy.total} correct</p>
                </div>
              </div>
              <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${accuracy.pct}%`,
                    background: accuracy.pct >= 70 ? 'linear-gradient(90deg,#34D399,#10B981)' : accuracy.pct >= 40 ? 'linear-gradient(90deg,#F59E0B,#D97706)' : 'linear-gradient(90deg,#EF4444,#DC2626)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Results grid */}
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((result) => {
              const bankItem = bankItems.find((i) => i.id === result.itemId)
              const pct = Math.round(result.confidence * 100)
              const color = labelColorMap[result.predictedLabelId] ?? '#8B5CF6'
              const isCorrect = result.actualLabel !== null
                ? result.predictedLabel === result.actualLabel
                : null

              return (
                <div
                  key={result.itemId}
                  className="flex flex-col rounded-xl overflow-hidden bg-white/5 border transition-all"
                  style={{
                    borderColor: isCorrect === true
                      ? 'rgba(52,211,153,0.3)'
                      : isCorrect === false
                      ? 'rgba(239,68,68,0.3)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative">
                    {block.modelType === 'text-supervised' ? (
                      <div className="w-full aspect-square bg-white/5 flex items-center justify-center p-2 overflow-hidden">
                        <p className="text-xs text-white/60 font-body leading-tight line-clamp-5 text-center">
                          {bankItem?.content ?? '?'}
                        </p>
                      </div>
                    ) : bankItem?.thumbnailUrl ? (
                      <img src={bankItem.thumbnailUrl} alt="" className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                        <span className="text-2xl opacity-30">🖼️</span>
                      </div>
                    )}
                    {isCorrect !== null && (
                      <span
                        className="absolute top-1.5 right-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: isCorrect ? 'rgba(52,211,153,0.9)' : 'rgba(239,68,68,0.9)',
                          color: '#fff',
                        }}
                      >
                        {isCorrect ? '✓' : '✗'}
                      </span>
                    )}
                  </div>

                  {/* Labels + confidence */}
                  <div className="px-2 pt-2 pb-2.5 flex flex-col gap-1">
                    {/* Predicted */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-body font-semibold truncate" style={{ color }}>
                        {result.predictedLabel}
                      </span>
                    </div>

                    {/* Confidence bar */}
                    <div className="w-full h-1 rounded-full bg-white/10">
                      <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-xs text-white/35 font-body">{pct}% confidence</span>

                    {/* Actual label */}
                    {result.actualLabel && (
                      <div className="mt-0.5 pt-1.5 border-t border-white/8">
                        <span className="text-xs text-white/50 font-body">Actual: </span>
                        <span className="text-xs font-body font-semibold text-white/70">{result.actualLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
