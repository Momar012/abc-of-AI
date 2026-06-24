'use client'

import React, { useState } from 'react'

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

// ── ChatGPT-style diagram block ──────────────────────────────────────────────

function DiagramBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-white/10 max-w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
        <span className="text-xs text-white/40 font-mono">{label}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors"
          aria-label="Copy diagram"
        >
          {copied ? (
            <>
              {/* Checkmark icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              {/* Copy icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Content */}
      <pre className="bg-black/50 p-3 overflow-x-auto font-mono text-xs text-teal-200/90 leading-snug whitespace-pre">
        {content}
      </pre>
    </div>
  )
}

// ── Body segmentation ────────────────────────────────────────────────────────

type Segment =
  | { kind: 'fenced'; label: string; content: string }
  | { kind: 'normal'; lines: string[] }

function segmentBody(body: string): Segment[] {
  const segments: Segment[] = []
  let inFence = false
  let fenceLabel = 'diagram'
  let fenceLines: string[] = []
  let normalLines: string[] = []

  function flushNormal() {
    if (normalLines.length > 0) {
      segments.push({ kind: 'normal', lines: [...normalLines] })
      normalLines = []
    }
  }

  for (const line of body.split('\n')) {
    if (line.trim().startsWith('```')) {
      if (!inFence) {
        flushNormal()
        inFence = true
        fenceLines = []
        const tag = line.trim().slice(3).trim()
        fenceLabel = tag || 'diagram'
      } else {
        segments.push({ kind: 'fenced', label: fenceLabel, content: fenceLines.join('\n') })
        inFence = false
      }
    } else if (inFence) {
      fenceLines.push(line)
    } else {
      normalLines.push(line)
    }
  }
  flushNormal()
  if (inFence) segments.push({ kind: 'fenced', label: fenceLabel, content: fenceLines.join('\n') })
  return segments
}

// ── Normal line rendering ────────────────────────────────────────────────────

function processNormalLines(
  lines: string[],
  nodes: React.ReactNode[],
  renderInlineFn: (t: string) => React.ReactNode[]
) {
  let listItems: React.ReactNode[] = []
  let listKey = 0
  let tableRows: string[][] = []
  let tableKey = 0

  function flushList() {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}-${listKey++}`} className="space-y-1 mt-1 mb-1">
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
      <div key={`tbl-${nodes.length}-${tableKey++}`} className="overflow-hidden rounded-lg my-2">
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
        <h2 key={`h1-${nodes.length}-${i}`} className="text-base font-heading font-extrabold bg-gradient-to-r from-violet-300 to-teal-300 bg-clip-text text-transparent mt-2 mb-1">
          {line.slice(2)}
        </h2>
      )
    } else if (line.startsWith('## ')) {
      flushList()
      flushTable()
      nodes.push(
        <h3 key={`h2-${nodes.length}-${i}`} className="text-sm font-heading font-bold text-white border-b border-violet-500/30 pb-0.5 mt-2 mb-1">
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
        <li key={`li-${nodes.length}-${i}`} className="flex gap-2 items-start">
          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400/60 flex-shrink-0" />
          <span>{renderInlineFn(line.slice(2))}</span>
        </li>
      )
    } else {
      flushList()
      flushTable()
      if (line.trim() === '') {
        nodes.push(<div key={`sp-${nodes.length}-${i}`} className="h-1.5" />)
      } else {
        nodes.push(
          <p key={`p-${nodes.length}-${i}`} className="leading-relaxed">
            {renderInlineFn(line)}
          </p>
        )
      }
    }
  })
  flushList()
  flushTable()
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  body: string
  className?: string
}

export default function SimpleContent({ body, className = '' }: Props) {
  const segments = segmentBody(body)
  const nodes: React.ReactNode[] = []

  segments.forEach((seg, i) => {
    if (seg.kind === 'fenced') {
      nodes.push(
        <DiagramBlock key={`fence-${i}`} label={seg.label} content={seg.content} />
      )
    } else {
      processNormalLines(seg.lines, nodes, renderInline)
    }
  })

  return (
    <div className={`text-sm text-white/65 font-body space-y-1 ${className}`}>
      {nodes}
    </div>
  )
}
