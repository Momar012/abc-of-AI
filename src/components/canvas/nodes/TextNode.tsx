'use client'

import { useEffect, useRef, useState } from 'react'
import { NodeProps, NodeResizer } from 'reactflow'
import { TextBlock } from '@/types/rules'
import { useCanvasStore } from '@/store/useCanvasStore'

function placeCaretAtEnd(el: HTMLElement) {
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export default function TextNode({ data, selected }: NodeProps<{ block: TextBlock }>) {
  const { block } = data
  const updateTextBlock = useCanvasStore((s) => s.updateTextBlock)
  const removeTextBlock = useCanvasStore((s) => s.removeTextBlock)
  const editableRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(block.text === '')

  // Set the initial content once; afterwards the DOM is uncontrolled while editing.
  useEffect(() => {
    if (editableRef.current) editableRef.current.innerText = block.text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Focus and place the caret when entering edit mode (incl. on creation).
  // The mouseup that created/selected this node (e.g. drag-to-draw release,
  // or React Flow's own click handling) can steal focus back to the canvas a
  // frame or two later, so keep re-asserting focus for a few frames until it sticks.
  useEffect(() => {
    if (!isEditing) return
    let raf: number
    let attempts = 0
    const tryFocus = () => {
      const el = editableRef.current
      if (!el) return
      placeCaretAtEnd(el)
      attempts += 1
      if (document.activeElement !== el && attempts < 10) {
        raf = requestAnimationFrame(tryFocus)
      }
    }
    raf = requestAnimationFrame(tryFocus)
    return () => cancelAnimationFrame(raf)
  }, [isEditing])

  return (
    <div className="relative flex flex-col">
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={24}
        color="#8B5CF6"
        handleStyle={{ width: 10, height: 10, borderRadius: 3 }}
        onResize={(_, params) => {
          const ratio = params.height / block.height
          updateTextBlock(block.id, {
            width: params.width,
            height: params.height,
            fontSize: Math.max(8, Math.round(block.fontSize * ratio)),
          })
        }}
      />

      <div
        ref={editableRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        data-placeholder="Type here…"
        onDoubleClick={() => setIsEditing(true)}
        onBlur={(e) => {
          const text = e.currentTarget.innerText
          if (text.trim() === '') {
            removeTextBlock(block.id)
          } else {
            updateTextBlock(block.id, { text })
          }
          setIsEditing(false)
        }}
        className={`text-node-editable outline-none text-white font-body leading-snug whitespace-pre-wrap break-words px-1.5 py-1 border border-transparent rounded ${
          isEditing ? 'nodrag nopan cursor-text' : 'cursor-grab'
        }`}
        style={{
          width: block.width,
          minHeight: block.height,
          fontSize: block.fontSize,
          borderColor: isEditing ? 'rgba(139,92,246,0.6)' : undefined,
          boxShadow: isEditing ? '0 0 0 1px rgba(139,92,246,0.6)' : undefined,
        }}
      />
    </div>
  )
}
