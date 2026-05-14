'use client'

import { EdgeProps, getBezierPath } from 'reactflow'
import { useModelStore } from '@/store/useModelStore'

export default function TestEdge({
  id,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  animated,
}: EdgeProps) {
  const updateModelBlock = useModelStore((s) => s.updateModelBlock)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const gradId = `test-grad-${id}`

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>

      {/* Wider invisible hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />

      {/* Visible path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        strokeDasharray={animated ? '6 3' : undefined}
        className="react-flow__edge-path"
        style={animated ? { animation: 'dashdraw 0.5s linear infinite' } : undefined}
      />

      {/* Delete button at midpoint */}
      <foreignObject
        x={labelX - 10}
        y={labelY - 10}
        width={20}
        height={20}
        style={{ overflow: 'visible' }}
        className="edgebutton-foreignobject"
      >
        <div style={{ width: 20, height: 20 }}>
          <button
            onClick={() =>
              updateModelBlock(target, {
                testLinkedBlockId: null,
                testStatus: 'idle',
                testResults: null,
              })
            }
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: 'white',
              fontSize: 13,
              lineHeight: '1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title="Remove test connection"
          >
            ×
          </button>
        </div>
      </foreignObject>
    </>
  )
}
