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
  let tableRows: string[][] = []
  let tableKey = 0

  function flushList() {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`ul-${listKey++}`} className="space-y-1 mt-1 mb-1">
        {listItems}
      </ul>
    )
    listItems = []
  }

  function flushTable() {
    if (tableRows.length === 0) return
    const isSep = (cells: string[]) => cells.every(c => /^[-: ]+$/.test(c))
    const [header, ...rest] = tableRows
    const dataRows = rest.filter(r => !isSep(r))
    nodes.push(
      <div key={`tbl-${tableKey++}`} className="overflow-hidden rounded-lg my-2">
        <table className="w-full table-auto border-collapse text-xs font-body">
          <thead>
            <tr>
              {header.map((cell, ci) => (
                <th key={ci} className="px-2 py-1.5 text-left font-heading font-bold text-white bg-violet-700/60 border border-white/10">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1.5 text-white/70 bg-white/5 border border-white/[0.08]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      flushList()
      flushTable()
      nodes.push(
        <h2 key={`h1-${i}`} className="text-base font-heading font-extrabold bg-gradient-to-r from-violet-300 to-teal-300 bg-clip-text text-transparent mt-2 mb-1">
          {line.slice(2)}
        </h2>
      )
    } else if (line.startsWith('## ')) {
      flushList()
      flushTable()
      nodes.push(
        <h3 key={`h2-${i}`} className="text-sm font-heading font-bold text-white border-b border-violet-500/30 pb-0.5 mt-2 mb-1">
          {line.slice(3)}
        </h3>
      )
    } else if (line.startsWith('|')) {
      flushList()
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      tableRows.push(cells)
    } else if (line.startsWith('- ')) {
      flushTable()
      listItems.push(
        <li key={i} className="flex gap-2 items-start">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400/60 flex-shrink-0" />
          <span>{renderInline(line.slice(2))}</span>
        </li>
      )
    } else {
      flushList()
      flushTable()
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
  flushTable()

  return (
    <div className={`text-sm text-white/65 font-body space-y-1 ${className}`}>
      {nodes}
    </div>
  )
}
