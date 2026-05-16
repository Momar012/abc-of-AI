'use client'

import { EdgeProps, getBezierPath } from 'reactflow'
import { useWorkflowStore } from '@/store/useWorkflowStore'

export default function WorkflowEdge({
  id,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps) {
  const updateIfElseBlock = useWorkflowStore((s) => s.updateIfElseBlock)
  const updateDoorBlock = useWorkflowStore((s) => s.updateDoorBlock)
  const updateBulbBlock = useWorkflowStore((s) => s.updateBulbBlock)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const gradId = `wf-grad-${id}`

  const handleDelete = () => {
    // Each call is a no-op when target doesn't match that block type
    updateIfElseBlock(target, { linkedModelId: null, currentOutput: null })
    updateDoorBlock(target, { linkedIfElseId: null, isOpen: false })
    updateBulbBlock(target, { linkedIfElseId: null, isOn: false })
  }

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2}
        className="react-flow__edge-path"
      />
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
            onClick={handleDelete}
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'rgba(239,68,68,0.85)',
              border: '1px solid rgba(239,68,68,0.5)',
              color: 'white', fontSize: 13, lineHeight: '1',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
            title="Remove connection"
          >
            ×
          </button>
        </div>
      </foreignObject>
    </>
  )
}
