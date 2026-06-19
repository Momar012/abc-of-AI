'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

interface ParsedRow {
  label: string
  text: string
}

function parse(raw: string): ParsedRow[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((cols) => cols.some((c) => c.trim()))
    .flatMap((cols) => {
      const text = cols[0]?.trim() ?? ''
      const label = cols[1]?.trim() ?? ''
      if (!label || !text) return []
      return [{ label, text }]
    })
}

interface Props {
  blockId: string
  onClose: () => void
}

export default function SpreadsheetPasteModal({ blockId, onClose }: Props) {
  const [raw, setRaw] = useState('')
  const bulkImportTextRows = useDatasetStore((s) => s.bulkImportTextRows)
  const addToast = useUIStore((s) => s.addToast)

  const rows = parse(raw)
  const uniqueLabels = [...new Set(rows.map((r) => r.label))]

  const skipped = raw.trim()
    ? raw.split(/\r?\n/).filter((l) => l.trim()).length - rows.length
    : 0

  const handleImport = useCallback(() => {
    if (!rows.length) return
    bulkImportTextRows(blockId, rows)
    addToast(
      `✓ Imported ${rows.length} row${rows.length !== 1 ? 's' : ''} across ${uniqueLabels.length} label${uniqueLabels.length !== 1 ? 's' : ''}!`,
      'success'
    )
    onClose()
  }, [rows, uniqueLabels.length, blockId, bulkImportTextRows, addToast, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: 520,
          maxHeight: '88vh',
          border: '1px solid rgba(139,92,246,0.35)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)',
          borderRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.35)' }}
            >
              📋
            </div>
            <div className="min-w-0">
              <p className="text-sm font-heading font-bold text-white leading-tight">Paste from Spreadsheet</p>
              <p className="text-xs text-white/40 font-body mt-0.5">Col A = Text &nbsp;·&nbsp; Col B = Label</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all flex-shrink-0 ml-3 text-lg leading-none"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-5 pb-5 overflow-hidden">

          {/* When no data yet: instruction + format hint + big textarea */}
          {rows.length === 0 && (
            <>
              <p className="text-xs text-white/50 font-body leading-relaxed flex-shrink-0">
                In Excel or Google Sheets, select your text column and label column, copy (Ctrl+C), then paste below.
              </p>

              {/* Format example */}
              <div className="flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, overflow: 'hidden' }}>
                <div
                  className="flex text-xs font-mono text-white/35 px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <span className="flex-1">Text — Column A</span>
                  <span className="flex-shrink-0 pl-4">Label — Col B</span>
                </div>
                {[
                  ['You won a prize!', 'spam'],
                  ['Hey, free tomorrow?', 'ham'],
                  ['Claim your reward now', 'spam'],
                ].map(([text, label], i, arr) => (
                  <div
                    key={i}
                    className="flex items-center px-3 py-1.5 text-xs font-mono"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  >
                    <span className="flex-1 text-white/40 truncate pr-4">{text}</span>
                    <span className="flex-shrink-0 font-body font-semibold" style={{ color: '#c4b5fd' }}>{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Textarea — shrinks once data is pasted */}
          <div className="relative flex-shrink-0">
            <textarea
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste your copied cells here…"
              rows={rows.length > 0 ? 3 : 6}
              className="w-full px-4 py-3 text-white text-xs font-mono placeholder-white/20 outline-none resize-none font-body leading-relaxed transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: rows.length > 0 ? '1px solid rgba(139,92,246,0.55)' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                boxShadow: rows.length > 0 ? '0 0 0 3px rgba(139,92,246,0.12)' : 'none',
              }}
            />
            {rows.length > 0 && (
              <span
                className="absolute bottom-2.5 right-3 text-xs font-body font-semibold px-2 py-0.5 rounded-full pointer-events-none"
                style={{ background: 'rgba(139,92,246,0.35)', color: '#ddd6fe', fontSize: 10 }}
              >
                {rows.length} rows
              </span>
            )}
          </div>

          {/* Skipped warning */}
          {skipped > 0 && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-body flex-shrink-0"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
            >
              <span className="flex-shrink-0">⚠</span>
              <span>{skipped} row{skipped !== 1 ? 's' : ''} skipped — needs 2 tab-separated columns.</span>
            </div>
          )}

          {/* Preview — takes all remaining space */}
          {rows.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Preview header */}
              <div
                className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="text-xs font-heading font-semibold text-white/40 uppercase tracking-wider">Preview</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {uniqueLabels.map((label) => (
                    <span
                      key={label}
                      className="text-xs font-body px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
                    >
                      {label} · {rows.filter((r) => r.label === label).length}
                    </span>
                  ))}
                </div>
              </div>
              {/* Scrollable rows */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {rows.slice(0, 200).map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                    style={{
                      borderBottom: i < Math.min(rows.length, 200) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span className="text-white/20 font-mono w-5 flex-shrink-0 text-right">{i + 1}</span>
                    <span className="text-white/65 font-body flex-1 min-w-0 truncate">{row.text}</span>
                    <span
                      className="flex-shrink-0 font-body font-semibold px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(139,92,246,0.18)', color: '#c4b5fd' }}
                    >
                      {row.label}
                    </span>
                  </div>
                ))}
                {rows.length > 200 && (
                  <p className="text-xs text-white/25 font-body text-center py-3">
                    +{rows.length - 200} more rows not shown
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center gap-2 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-heading font-semibold text-white/50 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={rows.length === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-heading font-semibold transition-all"
            style={{
              background: rows.length > 0 ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'rgba(255,255,255,0.07)',
              color: rows.length > 0 ? 'white' : 'rgba(255,255,255,0.25)',
              cursor: rows.length > 0 ? 'pointer' : 'not-allowed',
              border: rows.length > 0 ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: rows.length > 0 ? '0 2px 12px rgba(124,58,237,0.35)' : 'none',
            }}
          >
            {rows.length > 0 ? `Import ${rows.length} row${rows.length !== 1 ? 's' : ''} →` : 'Paste data above first'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
