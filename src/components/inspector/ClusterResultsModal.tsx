'use client'

import { useUIStore } from '@/store/useUIStore'
import { useModelStore } from '@/store/useModelStore'
import { useDatasetStore } from '@/store/useDatasetStore'
import { LABEL_PALETTE } from '@/lib/constants'

export default function ClusterResultsModal() {
  const blockId = useUIStore((s) => s.clusterResultsModalBlockId)
  const closeClusterResultsModal = useUIStore((s) => s.closeClusterResultsModal)
  const block = useModelStore((s) => s.modelBlocks.find((b) => b.id === blockId))
  const bankItems = useDatasetStore((s) => s.bankItems)

  if (!block || !block.clusterResults || block.clusterResults.length === 0) return null

  const k = block.clusterCount ?? Math.max(...block.clusterResults.map((r) => r.clusterId)) + 1

  // Group results by clusterId
  const clusters: Array<{ clusterId: number; itemIds: string[] }> = []
  for (let c = 0; c < k; c++) {
    clusters.push({
      clusterId: c,
      itemIds: block.clusterResults.filter((r) => r.clusterId === c).map((r) => r.itemId),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={closeClusterResultsModal}
    >
      <div
        className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ border: '1px solid rgba(139,92,246,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">🧩</span>
            <div>
              <p className="text-sm font-heading font-bold text-white">
                Clusters — {block.name}
              </p>
              <p className="text-xs text-white/40 font-body">
                {block.clusterResults.length} images grouped into {k} clusters
              </p>
            </div>
          </div>
          <button
            onClick={closeClusterResultsModal}
            className="w-8 h-8 rounded-full bg-white/10 text-white/50 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all"
          >
            ×
          </button>
        </div>

        {/* Cluster cards */}
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters.map(({ clusterId, itemIds }) => {
              const color = LABEL_PALETTE[clusterId % LABEL_PALETTE.length]
              return (
                <div
                  key={clusterId}
                  className="flex flex-col rounded-xl overflow-hidden bg-white/5 border"
                  style={{ borderColor: `${color}44` }}
                >
                  {/* Cluster header */}
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ background: `${color}18` }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-sm font-heading font-bold" style={{ color }}>
                        Cluster {clusterId + 1}
                      </span>
                    </div>
                    <span
                      className="text-xs font-body px-2 py-0.5 rounded-full"
                      style={{ background: `${color}22`, color }}
                    >
                      {itemIds.length} image{itemIds.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Thumbnail grid */}
                  <div className="p-2 grid grid-cols-4 gap-1">
                    {itemIds.map((itemId) => {
                      const bankItem = bankItems.find((i) => i.id === itemId)
                      return (
                        <div
                          key={itemId}
                          className="aspect-square rounded-lg overflow-hidden bg-white/5 flex items-center justify-center"
                          style={{ border: `1px solid ${color}22` }}
                        >
                          {bankItem?.thumbnailUrl ? (
                            <img
                              src={bankItem.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-white/30 font-body text-center px-0.5 leading-tight">
                              {bankItem?.name ?? '?'}
                            </span>
                          )}
                        </div>
                      )
                    })}
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
