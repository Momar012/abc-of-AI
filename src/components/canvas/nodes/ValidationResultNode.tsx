'use client'

import { NodeProps } from 'reactflow'
import { ValidationResult } from '@/types/dataset'
import ValidationPanel from '@/components/validation/ValidationPanel'

export default function ValidationResultNode({ data }: NodeProps<{ result: ValidationResult }>) {
  return (
    <div className="nodrag w-80">
      <ValidationPanel />
    </div>
  )
}
