'use client'

import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useDatasetStore } from '@/store/useDatasetStore'
import { useUIStore } from '@/store/useUIStore'

function parse(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  // If only one line but contains a tab (copied from a spreadsheet single row),
  // also try splitting by tab to get each cell as a separate item
  if (lines.length === 1 && lines[0].includes('\t')) {
    return lines[0].split('\t').map((s) => s.trim()).filter(Boolean)
  }
  return lines
}

interface Props {
  blockId: string
  onClose: () => void
}

export default function UnlabelledPasteModal({ blockId, onClose }: Props) {
  const [raw, setRaw] = useState('')
  const bulkImportUnlabelledTexts = useDatasetStore((s) => s.bulkImportUnlabelledTexts)
  const addToast = useUIStore((s) => s.addToast)

  const items = parse(raw)

  const handleImport = useCallback(() => {
    if (!items.length) return
    bulkImportUnlabelledTexts(blockId, items)
    addToast(`✓ Added ${items.length} text item${items.length !== 1 ? 's' : ''}!`, 'success')
    onClose()
  }, [items, blockId, bulkImportUnlabelledTexts, addToast, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: 500,
          maxHeight: '85vh',
          border: '1px solid rgba(45,212,191,0.3)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(45,212,191,0.08)',
          borderRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
              style={{ background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)' }}
            >
              📋
            </div>
            <div>
              <p className="text-sm font-heading font-bold text-white">Paste Text Data</p>
              <p className="text-xs text-white/40 font-body mt-0.5">Each line or cell becomes one item</p>
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

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-5 pb-5 overflow-hidden">

          {/* Format hint — only when no data yet */}
          {items.length === 0 && (
            <>
              <p className="text-xs text-white/50 font-body leading-relaxed flex-shrink-0 mt-1">
                Paste text from anywhere — Google Sheets, Excel, or plain text. Works in two ways:
              </p>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {/* Option A */}
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.18)' }}
                >
                  <p className="text-xs font-heading font-semibold text-teal-300 mb-1.5">Multiple rows (one item per row)</p>
                  <div className="flex flex-col gap-0.5 font-mono text-xs text-white/40">
                    <span>Scientists confirm water is wet</span>
                    <span>Local man discovers gravity</span>
                    <span>Dog elected mayor of small town</span>
                  </div>
                </div>
                {/* Option B */}
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.18)' }}
                >
                  <p className="text-xs font-heading font-semibold text-teal-300 mb-1.5">One row, multiple columns (each cell = one item)</p>
                  <div className="font-mono text-xs text-white/40">
                    <span>Scientists confirm… </span>
                    <span className="text-white/20">│ </span>
                    <span>Local man discovers… </span>
                    <span className="text-white/20">│ </span>
                    <span>Dog elected…</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Textarea */}
          <div className="relative flex-shrink-0">
            <textarea
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Paste your text here…"
              rows={items.length > 0 ? 3 : 5}
              className="w-full px-4 py-3 text-white text-xs font-mono placeholder-white/20 outline-none resize-none font-body leading-relaxed transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: items.length > 0
                  ? '1px solid rgba(45,212,191,0.45)'
                  : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                boxShadow: items.length > 0 ? '0 0 0 3px rgba(45,212,191,0.08)' : 'none',
              }}
            />
            {items.length > 0 && (
              <span
                className="absolute bottom-2.5 right-3 text-xs font-body font-semibold px-2 py-0.5 rounded-full pointer-events-none"
                style={{ background: 'rgba(45,212,191,0.25)', color: '#5eead4', fontSize: 10 }}
              >
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Preview — fills remaining space */}
          {items.length > 0 && (
            <div
              className="flex-1 min-h-0 flex flex-col"
              style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}
            >
              <div
                className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="text-xs font-heading font-semibold text-white/40 uppercase tracking-wider">Preview</span>
                <span className="text-xs font-body text-teal-400">
                  {items.length} item{items.length !== 1 ? 's' : ''} ready
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {items.slice(0, 200).map((text, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                    style={{
                      borderBottom: i < Math.min(items.length, 200) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span className="text-white/20 font-mono w-5 flex-shrink-0 text-right">{i + 1}</span>
                    <span className="text-white/65 font-body flex-1 min-w-0 truncate">{text}</span>
                  </div>
                ))}
                {items.length > 200 && (
                  <p className="text-xs text-white/25 font-body text-center py-3">
                    +{items.length - 200} more not shown
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
            disabled={items.length === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-heading font-semibold transition-all"
            style={{
              background: items.length > 0 ? 'linear-gradient(135deg,#0d9488,#0f766e)' : 'rgba(255,255,255,0.07)',
              color: items.length > 0 ? 'white' : 'rgba(255,255,255,0.25)',
              cursor: items.length > 0 ? 'pointer' : 'not-allowed',
              border: items.length > 0 ? '1px solid rgba(45,212,191,0.4)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: items.length > 0 ? '0 2px 12px rgba(13,148,136,0.3)' : 'none',
            }}
          >
            {items.length > 0 ? `Add ${items.length} item${items.length !== 1 ? 's' : ''} →` : 'Paste text above first'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
