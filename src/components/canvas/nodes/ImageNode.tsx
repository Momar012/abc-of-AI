'use client'

import { NodeProps, NodeResizer } from 'reactflow'
import { ImageBlock } from '@/types/rules'
import { useCanvasStore } from '@/store/useCanvasStore'

export default function ImageNode({ data, selected }: NodeProps<{ block: ImageBlock }>) {
  const { block } = data
  const updateImageBlock = useCanvasStore((s) => s.updateImageBlock)

  return (
    <div className="relative flex flex-col">
      <NodeResizer
        isVisible={selected}
        keepAspectRatio
        minWidth={60}
        minHeight={60}
        color="#8B5CF6"
        handleStyle={{ width: 16, height: 16, borderRadius: 4 }}
        onResize={(_, params) => {
          updateImageBlock(block.id, { width: params.width, height: params.height })
        }}
      />
      <img
        src={block.src}
        alt=""
        draggable={false}
        className="rounded-lg cursor-grab"
        style={{
          width: block.width,
          height: block.height,
          objectFit: 'contain',
          background: 'rgba(255,255,255,0.04)',
          border: selected ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.09)',
          boxShadow: selected ? '0 0 0 1px rgba(139,92,246,0.6)' : undefined,
        }}
      />
    </div>
  )
}
