'use client'

import { useState } from 'react'
import { Label } from '@/types/dataset'
import { useDatasetStore } from '@/store/useDatasetStore'

interface Props {
  blockId: string
  label: Label
}

export default function EditableLabelPill({ blockId, label }: Props) {
  const renameLabel = useDatasetStore((s) => s.renameLabel)
  const removeLabel = useDatasetStore((s) => s.removeLabel)
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(label.name)
  const [renameError, setRenameError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const labels = useDatasetStore((s) => s.labelledBlocks.find((b) => b.id === blockId)?.labels ?? [])

  const commitRename = () => {
    const trimmed = nameValue.trim()
    if (!trimmed) { setNameValue(label.name); setEditing(false); return }
    const isDuplicate = labels.some((l) => l.id !== label.id && l.name.toLowerCase() === trimmed.toLowerCase())
    if (isDuplicate) { setRenameError(`"${trimmed}" already exists`); return }
    renameLabel(blockId, label.id, trimmed)
    setRenameError('')
    setEditing(false)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (label.itemIds.length === 0) {
      removeLabel(blockId, label.id)
    } else {
      setConfirmDelete(true)
    }
  }

  if (confirmDelete) {
    return (
      <span
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body"
        style={{ background: `${label.color}22`, border: `1px solid ${label.color}88`, color: label.color }}
      >
        <span className="text-white/70 whitespace-nowrap">
          Delete? <span className="font-semibold">{label.itemIds.length}</span> unassigned
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); removeLabel(blockId, label.id) }}
          className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors leading-none"
          title="Confirm delete"
        >
          ✓
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
          className="text-white/40 hover:text-white/70 transition-colors leading-none"
          title="Cancel"
        >
          ✕
        </button>
      </span>
    )
  }

  return (
    <span
      className="group flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body"
      style={{ background: `${label.color}22`, border: `1px solid ${label.color}55`, color: label.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: label.color }} />

      {editing ? (
        <span className="flex flex-col gap-0.5">
          <input
            autoFocus
            value={nameValue}
            onChange={(e) => { setNameValue(e.target.value); setRenameError('') }}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setNameValue(label.name); setRenameError(''); setEditing(false) }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`bg-transparent border-b outline-none text-white w-20 ${renameError ? 'border-red-400' : ''}`}
            style={{ borderColor: renameError ? undefined : `${label.color}88` }}
            maxLength={30}
          />
          {renameError && <span className="text-red-400 text-[10px] font-body whitespace-nowrap">{renameError}</span>}
        </span>
      ) : (
        <button
          onDoubleClick={() => { setNameValue(label.name); setEditing(true) }}
          onPointerDown={(e) => e.stopPropagation()}
          className="hover:opacity-80 transition-opacity"
          title="Double-click to rename"
        >
          {label.name}
        </button>
      )}

      <span className="text-white/40 ml-0.5">({label.itemIds.length})</span>

      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleDeleteClick}
        className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-white/40 transition-all leading-none ml-0.5"
        title="Delete label"
      >
        ×
      </button>
    </span>
  )
}
