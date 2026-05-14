'use client'

import { NodeProps } from 'reactflow'
import SplitBlock from '@/components/split/SplitBlock'

export default function DataSplitNode(_props: NodeProps) {
  return (
    <div className="nodrag w-80">
      <SplitBlock />
    </div>
  )
}
