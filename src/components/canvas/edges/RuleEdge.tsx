'use client'

import { EdgeProps, getBezierPath } from 'reactflow'
import { useRuleStore } from '@/store/useRuleStore'
import { useWorkflowStore } from '@/store/useWorkflowStore'

export default function RuleEdge({
  id,
  source,
  target,
  sourceHandleId: sourceHandle,
  targetHandleId: targetHandle,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
}: EdgeProps) {
  const updateConditionBlock = useRuleStore((s) => s.updateConditionBlock)
  const updateLogicBlock     = useRuleStore((s) => s.updateLogicBlock)
  const updateFanBlock       = useRuleStore((s) => s.updateFanBlock)
  const updateAlarmBlock     = useRuleStore((s) => s.updateAlarmBlock)
  const updateACBlock        = useRuleStore((s) => s.updateACBlock)
  const updateTimerBlock     = useRuleStore((s) => s.updateTimerBlock)
  const logicBlocks          = useRuleStore((s) => s.logicBlocks)
  const evaluateGraph        = useRuleStore((s) => s.evaluateGraph)
  const updateDoorBlock      = useWorkflowStore((s) => s.updateDoorBlock)
  const updateBulbBlock      = useWorkflowStore((s) => s.updateBulbBlock)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const gradId = `rule-grad-${id}`

  const handleDelete = () => {
    if (targetHandle === 'condition-in') {
      updateConditionBlock(target, { linkedSensorId: null, currentOutput: null })
    } else if (targetHandle === 'logic-in-1') {
      const block = logicBlocks.find((b) => b.id === target)
      if (block) {
        const ids = [...block.linkedInputIds]
        ids[0] = null
        updateLogicBlock(target, { linkedInputIds: ids, currentOutput: null })
      }
    } else if (targetHandle === 'logic-in-2') {
      const block = logicBlocks.find((b) => b.id === target)
      if (block) {
        const ids = [...block.linkedInputIds]
        ids[1] = null
        updateLogicBlock(target, { linkedInputIds: ids, currentOutput: null })
      }
    } else if (targetHandle === 'logic-in') {
      updateLogicBlock(target, { linkedInputIds: [null], currentOutput: null })
    } else if (targetHandle === 'fan-in') {
      updateFanBlock(target, { linkedRuleBlockId: null, isOn: false })
    } else if (targetHandle === 'alarm-in') {
      updateAlarmBlock(target, { linkedRuleBlockId: null, isOn: false })
    } else if (targetHandle === 'ac-in') {
      updateACBlock(target, { linkedRuleBlockId: null, isOn: false })
    } else if (targetHandle === 'timer-in') {
      updateTimerBlock(target, { linkedRuleBlockId: null, isRunning: false, remainingSeconds: 0, currentOutput: null, lastTriggerInput: null })
    } else if (targetHandle === 'door-in') {
      updateDoorBlock(target, { linkedRuleBlockId: null, isOpen: false })
    } else if (targetHandle === 'bulb-in') {
      updateBulbBlock(target, { linkedRuleBlockId: null, isOn: false })
    }
    evaluateGraph()
  }

  // Determine edge color based on segment: sensor→condition = orange, others = lime
  const isFromSensor = targetHandle === 'condition-in'
  const color1 = isFromSensor ? '#F97316' : '#84CC16'
  const color2 = isFromSensor ? '#FB923C' : '#A3E635'

  return (
    <>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
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
