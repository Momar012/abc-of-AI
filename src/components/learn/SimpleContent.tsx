'use client'

import React from 'react'

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

interface Props {
  body: string
  className?: string
}

export default function SimpleContent({ body, className = '' }: Props) {
  const lines = body.split('\n')
  const nodes: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let listKey = 0

  function flushList() {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`ul-${listKey++}`} className="space-y-1 mt-1 mb-1">
        {listItems}
      </ul>
    )
    listItems = []
  }

  lines.forEach((line, i) => {
    if (line.startsWith('- ')) {
      listItems.push(
        <li key={i} className="flex gap-2 items-start">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400/60 flex-shrink-0" />
          <span>{renderInline(line.slice(2))}</span>
        </li>
      )
    } else {
      flushList()
      if (line.trim() === '') {
        nodes.push(<div key={`sp-${i}`} className="h-1.5" />)
      } else {
        nodes.push(
          <p key={`p-${i}`} className="leading-relaxed">
            {renderInline(line)}
          </p>
        )
      }
    }
  })
  flushList()

  return (
    <div className={`text-sm text-white/65 font-body space-y-1 ${className}`}>
      {nodes}
    </div>
  )
}
