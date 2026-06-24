'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { CurriculumModule, CurriculumStep, CURRICULUM } from '@/data/curriculum'
import { useCurriculumContentStore } from '@/store/useCurriculumContentStore'
import { LearnStepView, LabStepView, ChallengeStepView, TYPE_DOT } from '@/components/learn/StepViews'

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshStep(type: 'learn' | 'lab' | 'challenge'): CurriculumStep {
  const id = `${type}-${Date.now()}`
  if (type === 'learn') return { type, id, title: '', icon: '📖', body: '', tip: '' }
  if (type === 'lab')   return { type, id, title: '', icon: '🔬', instruction: '', canvasHint: '' }
  return                       { type, id, title: '', icon: '🏆', prompt: '', successHint: '' }
}

function convertStepType(step: CurriculumStep, newType: 'learn' | 'lab' | 'challenge'): CurriculumStep {
  const base = { id: step.id, title: step.title, icon: step.icon }
  if (newType === 'learn')    return { ...base, type: 'learn', body: '', tip: '' }
  if (newType === 'lab')      return { ...base, type: 'lab', instruction: '', canvasHint: '' }
  return                             { ...base, type: 'challenge', prompt: '', successHint: '' }
}

const EMOJI_QUICK: Record<'learn' | 'lab' | 'challenge', string[]> = {
  learn:     ['📖', '🧠', '💡', '🔭', '🎓', '🌟', '📚', '🔑'],
  lab:       ['🔬', '🧪', '🚀', '🛠️', '📸', '🔧', '⚙️', '🧩'],
  challenge: ['🏆', '🎯', '🎮', '🏅', '⭐', '💪', '🔥', '🚀'],
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-heading font-bold text-white/40 uppercase tracking-wider mb-1.5">
      {children}
    </p>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-white/15 text-white text-sm font-body outline-none focus:border-violet-400 bg-transparent placeholder:text-white/25 transition-colors'
const textareaCls = `${inputCls} resize-none leading-relaxed`

function ModuleEditor({
  module,
  onUpdate,
}: {
  module: CurriculumModule
  onUpdate: (patch: Partial<CurriculumModule>) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[10px] font-heading font-bold text-violet-300/70 uppercase tracking-widest mb-1">Editing Chapter</p>
        <p className="text-xl font-heading font-extrabold text-white">Chapter Settings</p>
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Emoji</FieldLabel>
          <input
            value={module.emoji}
            onChange={(e) => onUpdate({ emoji: e.target.value })}
            className="w-16 text-center text-2xl px-2 py-2 rounded-lg border border-white/15 bg-transparent outline-none focus:border-violet-400 transition-colors"
            maxLength={4}
          />
        </div>
        <div className="flex-1 flex flex-col gap-3">
          <div>
            <FieldLabel>Chapter label (e.g. Chapter 1)</FieldLabel>
            <input
              value={module.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Chapter 1"
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel>Subtitle (topic name)</FieldLabel>
            <input
              value={module.subtitle}
              onChange={(e) => onUpdate({ subtitle: e.target.value })}
              placeholder="Teach an AI"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 border border-violet-500/20 bg-violet-500/5">
        <p className="text-xs text-white/50 font-body leading-relaxed">
          This chapter will appear in the module switcher inside the Curriculum panel.
          Add steps using the <span className="text-violet-300 font-semibold">+ Learn / + Lab / + Challenge</span> buttons below the chapter in the left panel.
        </p>
      </div>
    </div>
  )
}

function StepEditor({
  step,
  onUpdate,
  onChangeType,
}: {
  step: CurriculumStep
  onUpdate: (patch: Partial<CurriculumStep>) => void
  onChangeType: (t: 'learn' | 'lab' | 'challenge') => void
}) {
  const [showOptional, setShowOptional] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mainLabel   = step.type === 'learn' ? 'Body text' : step.type === 'lab' ? 'Instruction' : 'Prompt / challenge'
  const mainValue   = step.type === 'learn' ? step.body : step.type === 'lab' ? step.instruction : step.prompt
  const mainKey     = step.type === 'learn' ? 'body' : step.type === 'lab' ? 'instruction' : 'prompt'
  const optLabel    = step.type === 'learn' ? '💡 Tip (amber callout)' : step.type === 'lab' ? '🔍 Canvas hint (teal)' : '🎯 Success hint (collapsible)'
  const optValue    = step.type === 'learn' ? (step.tip ?? '') : step.type === 'lab' ? (step.canvasHint ?? '') : (step.successHint ?? '')
  const optKey      = step.type === 'learn' ? 'tip' : step.type === 'lab' ? 'canvasHint' : 'successHint'

  const TAB_STYLE: Record<string, string> = {
    learn:     'bg-violet-500/20 border-violet-500/40 text-violet-300',
    lab:       'bg-teal-500/20 border-teal-500/40 text-teal-300',
    challenge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  }
  const TAB_IDLE = 'border-white/10 text-white/35 hover:text-white/60 hover:bg-white/5'

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const before = mainValue.slice(0, start)
    const after  = mainValue.slice(end)
    const newValue = before + snippet + after
    onUpdate({ [mainKey]: newValue } as Partial<CurriculumStep>)
    const newCursor = start + snippet.length
    requestAnimationFrame(() => { el.selectionStart = newCursor; el.selectionEnd = newCursor; el.focus() })
  }

  function insertHeadingPrefix(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart
    const lineStart = mainValue.lastIndexOf('\n', pos - 1) + 1
    const newValue = mainValue.slice(0, lineStart) + prefix + mainValue.slice(lineStart)
    onUpdate({ [mainKey]: newValue } as Partial<CurriculumStep>)
    const newCursor = lineStart + prefix.length + (pos - lineStart)
    requestAnimationFrame(() => { el.selectionStart = newCursor; el.selectionEnd = newCursor; el.focus() })
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t')) return
    e.preventDefault()
    const rows = text.split('\n').map(r => r.replace(/\t+$/, '')).filter(r => r.trim() !== '')
    const tableLines: string[] = []
    rows.forEach((row, idx) => {
      const cells = row.split('\t').map(c => c.trim())
      tableLines.push('| ' + cells.join(' | ') + ' |')
      if (idx === 0) tableLines.push('| ' + cells.map(() => '---').join(' | ') + ' |')
    })
    const tableText = tableLines.join('\n')
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const before = mainValue.slice(0, start)
    const after  = mainValue.slice(el.selectionEnd)
    const prefix = (before.length > 0 && !before.endsWith('\n\n')) ? '\n\n' : ''
    const suffix = (after.length > 0 && !after.startsWith('\n')) ? '\n' : ''
    const newValue = before + prefix + tableText + suffix + after
    onUpdate({ [mainKey]: newValue } as Partial<CurriculumStep>)
    const newCursor = start + prefix.length + tableText.length
    requestAnimationFrame(() => { el.selectionStart = newCursor; el.selectionEnd = newCursor; el.focus() })
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Type tabs */}
      <div className="flex gap-2">
        {(['learn', 'lab', 'challenge'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChangeType(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-heading font-bold border transition-colors ${
              step.type === t ? TAB_STYLE[t] : TAB_IDLE
            }`}
          >
            {t === 'learn' ? '📖 Learn' : t === 'lab' ? '🔬 Lab' : '🏆 Challenge'}
          </button>
        ))}
      </div>

      {/* Icon + emoji quick-picks */}
      <div>
        <FieldLabel>Icon (emoji)</FieldLabel>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={step.icon}
            onChange={(e) => onUpdate({ icon: e.target.value })}
            className="w-14 text-center text-2xl px-1 py-1.5 rounded-lg border border-white/15 bg-transparent outline-none focus:border-violet-400 transition-colors"
            maxLength={4}
          />
          {EMOJI_QUICK[step.type].map((e) => (
            <button
              key={e}
              onClick={() => onUpdate({ icon: e })}
              className={`text-xl px-1.5 py-1 rounded-md transition-colors ${
                step.icon === e ? 'bg-white/15' : 'hover:bg-white/8'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <FieldLabel>Title</FieldLabel>
        <input
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Step title…"
          className={inputCls}
        />
      </div>

      {/* Main content */}
      <div>
        <FieldLabel>{mainLabel}</FieldLabel>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => insertHeadingPrefix('# ')}
            className="px-2.5 py-1 rounded-md text-[11px] font-heading font-bold border border-white/10 text-violet-300/70 hover:bg-violet-500/15 hover:text-violet-200 hover:border-violet-500/30 transition-colors"
            title="Insert H1 heading"
          >H1</button>
          <button
            type="button"
            onClick={() => insertHeadingPrefix('## ')}
            className="px-2.5 py-1 rounded-md text-[11px] font-heading font-bold border border-white/10 text-violet-300/70 hover:bg-violet-500/15 hover:text-violet-200 hover:border-violet-500/30 transition-colors"
            title="Insert H2 heading"
          >H2</button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={() => insertAtCursor('\n| Column A | Column B |\n| --- | --- |\n| Value 1 | Value 2 |\n| Value 3 | Value 4 |\n')}
            className="px-2.5 py-1 rounded-md text-[11px] font-heading font-bold border border-white/10 text-teal-300/70 hover:bg-teal-500/15 hover:text-teal-200 hover:border-teal-500/30 transition-colors"
            title="Insert blank table (or just paste from Excel/Sheets)"
          >Table</button>
          <button
            type="button"
            onClick={() => insertAtCursor('\n```diagram\nYour diagram here\n      |\n   Next step\n```\n')}
            className="px-2.5 py-1 rounded-md text-[11px] font-heading font-bold border border-white/10 text-violet-300/70 hover:bg-violet-500/15 hover:text-violet-200 hover:border-violet-500/30 transition-colors"
            title="Insert ASCII diagram block"
          >Diagram</button>
        </div>

        <p className="text-[10px] text-white/30 font-body mb-2">
          Use <code className="text-violet-300">**word**</code> for bold,{' '}
          <code className="text-teal-300">- item</code> for bullets,{' '}
          <code className="text-violet-300"># Heading</code> / <code className="text-violet-300">## Heading</code> for headings,{' '}
          blank line for paragraph break. Paste from Excel/Sheets to auto-insert a table.{' '}
          Use <code className="text-violet-300">```diagram</code> … <code className="text-violet-300">```</code> for ASCII flow diagrams.
        </p>
        <textarea
          ref={textareaRef}
          value={mainValue}
          onChange={(e) => onUpdate({ [mainKey]: e.target.value } as Partial<CurriculumStep>)}
          onPaste={handlePaste}
          rows={7}
          placeholder={`Write the ${mainLabel.toLowerCase()} here…`}
          className={textareaCls}
        />
      </div>

      {/* Optional field */}
      <div>
        <button
          onClick={() => setShowOptional((v) => !v)}
          className="text-xs font-heading font-semibold text-white/35 hover:text-white/60 transition-colors flex items-center gap-1.5 mb-2"
        >
          <span>{showOptional ? '▾' : '▸'}</span>
          {optLabel} <span className="text-white/20 font-normal">(optional)</span>
        </button>
        {showOptional && (
          <textarea
            value={optValue}
            onChange={(e) => onUpdate({ [optKey]: e.target.value } as Partial<CurriculumStep>)}
            rows={3}
            placeholder="Optional — leave blank to hide"
            className={textareaCls}
          />
        )}
      </div>

      {/* Live preview */}
      <div className="border-t border-white/8 pt-5">
        <p className="text-[10px] font-heading font-bold text-white/25 uppercase tracking-widest mb-3">Live Preview</p>
        <div className="glass-card p-4">
          {step.type === 'learn'     && <LearnStepView     step={step} />}
          {step.type === 'lab'       && <LabStepView       step={step} />}
          {step.type === 'challenge' && <ChallengeStepView step={step} />}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Sel =
  | { kind: 'module'; moduleId: string }
  | { kind: 'step';   moduleId: string; stepId: string }
  | null

export default function CurriculumAdminPage() {
  const storedModules    = useCurriculumContentStore((s) => s.modules)
  const setModulesInStore = useCurriculumContentStore((s) => s.setModules)
  const resetToDefaults  = useCurriculumContentStore((s) => s.resetToDefaults)

  const importRef = useRef<HTMLInputElement>(null)

  const [modules,      setModules]      = useState<CurriculumModule[]>(CURRICULUM)
  const [selection,    setSelection]    = useState<Sel>(null)
  const [status,       setStatus]       = useState<'idle' | 'saved' | 'dirty'>('idle')
  const [openModules,  setOpenModules]  = useState<Set<string>>(new Set())

  function toggleOpen(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = useCurriculumContentStore.getState().modules
    setModules(stored)
    setOpenModules(new Set(stored.map((m) => m.id))) // all open by default
    if (stored.length > 0) setSelection({ kind: 'module', moduleId: stored[0].id })
  }, [])

  // Track dirty state
  useEffect(() => {
    if (status === 'saved') return
    setStatus('dirty')
  }, [modules]) // eslint-disable-line react-hooks/exhaustive-deps

  function saveDraft() {
    setModulesInStore(modules)
    setStatus('saved')
    setTimeout(() => setStatus('idle'), 2500)
  }

  function handleReset() {
    if (!confirm('Reset all curriculum content back to the default content? This cannot be undone.')) return
    resetToDefaults()
    const fresh = JSON.parse(JSON.stringify(CURRICULUM)) as CurriculumModule[]
    setModules(fresh)
    setSelection(fresh.length > 0 ? { kind: 'module', moduleId: fresh[0].id } : null)
    setStatus('idle')
  }

  // ── Export / Import
  function handleExport() {
    const json = JSON.stringify(modules, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'curriculum-content.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(data)) throw new Error()
        const valid = data.every((m: unknown) => {
          const mod = m as Record<string, unknown>
          return typeof mod.id === 'string' && typeof mod.title === 'string' && Array.isArray(mod.steps)
        })
        if (!valid) throw new Error()
        const imported = data as CurriculumModule[]
        setModules(imported)
        setOpenModules(new Set(imported.map((m) => m.id)))
        setSelection(imported.length > 0 ? { kind: 'module', moduleId: imported[0].id } : null)
      } catch {
        alert('Invalid file — please use a curriculum.json exported from this editor.')
      }
      if (importRef.current) importRef.current.value = ''
    }
    reader.readAsText(file)
  }

  // ── Module operations
  const updateModule = useCallback((moduleId: string, patch: Partial<CurriculumModule>) => {
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, ...patch } : m))
  }, [])

  function addModule() {
    const mod: CurriculumModule = {
      id: `ch-${Date.now()}`,
      title: 'New Chapter',
      subtitle: 'Untitled',
      emoji: '📚',
      steps: [],
    }
    setModules((prev) => [...prev, mod])
    setSelection({ kind: 'module', moduleId: mod.id })
  }

  function deleteModule(moduleId: string) {
    if (!confirm('Delete this chapter and all its steps?')) return
    setModules((prev) => {
      const next = prev.filter((m) => m.id !== moduleId)
      setSelection(next.length > 0 ? { kind: 'module', moduleId: next[0].id } : null)
      return next
    })
  }

  function moveModule(moduleId: string, dir: 'up' | 'down') {
    setModules((prev) => {
      const idx = prev.findIndex((m) => m.id === moduleId)
      const to = dir === 'up' ? idx - 1 : idx + 1
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
  }

  // ── Step operations
  function addStep(moduleId: string, type: 'learn' | 'lab' | 'challenge') {
    const step = freshStep(type)
    setModules((prev) => prev.map((m) =>
      m.id === moduleId ? { ...m, steps: [...m.steps, step] } : m
    ))
    setSelection({ kind: 'step', moduleId, stepId: step.id })
  }

  function deleteStep(moduleId: string, stepId: string) {
    if (!confirm('Delete this step?')) return
    setModules((prev) => prev.map((m) =>
      m.id !== moduleId ? m : { ...m, steps: m.steps.filter((s) => s.id !== stepId) }
    ))
    setSelection({ kind: 'module', moduleId })
  }

  function moveStep(moduleId: string, stepId: string, dir: 'up' | 'down') {
    setModules((prev) => prev.map((m) => {
      if (m.id !== moduleId) return m
      const idx = m.steps.findIndex((s) => s.id === stepId)
      const to  = dir === 'up' ? idx - 1 : idx + 1
      if (to < 0 || to >= m.steps.length) return m
      const steps = [...m.steps]
      ;[steps[idx], steps[to]] = [steps[to], steps[idx]]
      return { ...m, steps }
    }))
  }

  const updateStep = useCallback((moduleId: string, stepId: string, patch: Partial<CurriculumStep>) => {
    setModules((prev) => prev.map((m) =>
      m.id !== moduleId ? m : {
        ...m,
        steps: m.steps.map((s) => s.id !== stepId ? s : { ...s, ...patch } as CurriculumStep),
      }
    ))
  }, [])

  function changeStepType(moduleId: string, stepId: string, newType: 'learn' | 'lab' | 'challenge') {
    setModules((prev) => prev.map((m) =>
      m.id !== moduleId ? m : {
        ...m,
        steps: m.steps.map((s) => s.id !== stepId ? s : convertStepType(s, newType)),
      }
    ))
  }

  // ── Derived selection
  const selModule = selection ? modules.find((m) => m.id === selection.moduleId) ?? null : null
  const selStep   = selection?.kind === 'step' && selModule
    ? selModule.steps.find((s) => s.id === selection.stepId) ?? null
    : null

  // ── Render
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0c0a1e' }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center gap-4 px-5 py-3 border-b border-white/10"
              style={{ background: 'rgba(30,27,75,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-teal-400 flex items-center justify-center text-lg shadow-[0_0_12px_rgba(124,58,237,0.4)]">
            🧠
          </div>
          <div>
            <p className="text-[9px] font-heading font-bold text-violet-300/60 uppercase tracking-widest leading-none">AI Sandbox for Kids</p>
            <p className="text-sm font-heading font-extrabold text-white leading-tight">Curriculum Editor</p>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          {status === 'saved' && (
            <span className="text-xs font-heading font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Draft saved in browser
            </span>
          )}
          {status === 'dirty' && (
            <span className="text-xs font-heading font-bold text-amber-400/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
              Unsaved draft
            </span>
          )}
        </div>

        {/* Hidden file input for import */}
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="text-xs font-heading font-semibold text-white/25 hover:text-red-400/70 transition-colors"
          >
            Reset to defaults
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="text-xs font-heading font-semibold text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            title="Import a previously exported curriculum.json"
          >
            ↑ Import
          </button>
          <button
            onClick={handleExport}
            className="text-xs font-heading font-semibold text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            title="Download curriculum as curriculum.json"
          >
            ↓ Export
          </button>
          <Link
            href="/dataset-builder"
            className="text-xs font-heading font-semibold text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
          >
            ← Back to App
          </Link>
          <button
            onClick={saveDraft}
            className="text-xs font-heading font-semibold text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            title="Save work-in-progress to this browser (not the live app)"
          >
            💾 Save Draft
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-1.5 rounded-lg text-sm font-heading font-bold text-white
              bg-gradient-to-r from-violet-500 to-teal-400
              hover:shadow-[0_0_16px_rgba(124,58,237,0.5)]
              transition-all duration-200"
            title="Download curriculum-content.json — replace the file in your codebase and redeploy"
          >
            ↓ Export &amp; Deploy
          </button>
        </div>
      </header>

      {/* ── Deploy instructions banner ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-white/6" style={{ background: 'rgba(124,58,237,0.08)' }}>
        <span className="text-base flex-shrink-0">🚀</span>
        <p className="text-xs font-body text-white/50 leading-relaxed">
          <span className="text-violet-300 font-semibold">How to go live:</span>{' '}
          Edit content here → click{' '}
          <span className="text-white/80 font-semibold">↓ Export &amp; Deploy</span>{' '}
          → replace <code className="text-teal-300 bg-white/5 px-1 rounded">src/data/curriculum-content.json</code> in your codebase with the downloaded file → redeploy. Every user in the world will see the updated curriculum.
        </p>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: chapter/step tree ── */}
        <div className="w-72 flex-shrink-0 border-r border-white/10 overflow-y-auto p-3 flex flex-col gap-2">

          {modules.map((mod, modIdx) => {
            const isOpen = openModules.has(mod.id)
            return (
              <div key={mod.id} className="rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>

                {/* Chapter header row — all controls inline, no overflow-hidden */}
                <div className={`flex items-center gap-1.5 px-2 py-2 rounded-t-xl ${!isOpen ? 'rounded-b-xl' : ''} ${
                  selection?.moduleId === mod.id && selection.kind === 'module' ? 'bg-violet-500/12' : ''
                }`}>
                  {/* Expand/collapse chevron */}
                  <button
                    onClick={() => toggleOpen(mod.id)}
                    className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors flex-shrink-0 text-xs"
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? '▾' : '▸'}
                  </button>

                  {/* Chapter info — click to edit metadata */}
                  <button
                    onClick={() => { setSelection({ kind: 'module', moduleId: mod.id }); if (!isOpen) toggleOpen(mod.id) }}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    <span className="text-base flex-shrink-0">{mod.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[9px] font-heading text-white/35 uppercase tracking-wider leading-none mb-0.5">{mod.title}</p>
                      <p className="text-xs font-heading font-bold text-white truncate">{mod.subtitle || 'Untitled'}</p>
                    </div>
                  </button>

                  {/* Reorder + delete */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => moveModule(mod.id, 'up')}   disabled={modIdx === 0}                  title="Move up"   className="w-5 h-5 flex items-center justify-center text-white/25 hover:text-white/70 disabled:opacity-20 text-xs rounded transition-colors">↑</button>
                    <button onClick={() => moveModule(mod.id, 'down')} disabled={modIdx === modules.length - 1} title="Move down" className="w-5 h-5 flex items-center justify-center text-white/25 hover:text-white/70 disabled:opacity-20 text-xs rounded transition-colors">↓</button>
                    <button onClick={() => deleteModule(mod.id)} title="Delete chapter" className="w-5 h-5 flex items-center justify-center text-red-400/30 hover:text-red-400 text-xs rounded transition-colors ml-0.5">✕</button>
                  </div>
                </div>

                {/* Expandable step list + add buttons */}
                {isOpen && (
                  <div className="border-t border-white/8 px-2 pt-2 pb-3 flex flex-col gap-0.5">
                    {mod.steps.length === 0 && (
                      <p className="text-[10px] text-white/20 font-body px-1 py-1 italic">No steps yet — add one below</p>
                    )}
                    {mod.steps.map((step, stepIdx) => (
                      <div
                        key={step.id}
                        onClick={() => setSelection({ kind: 'step', moduleId: mod.id, stepId: step.id })}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                          selection?.kind === 'step' && selection.stepId === step.id
                            ? 'bg-white/12'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOT[step.type]}`} />
                        <span className="flex-1 text-xs text-white/65 truncate">
                          {step.title || <span className="italic text-white/25">Untitled</span>}
                        </span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); moveStep(mod.id, step.id, 'up') }}   disabled={stepIdx === 0}                  className="w-4 h-4 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 text-[10px]">↑</button>
                          <button onClick={(e) => { e.stopPropagation(); moveStep(mod.id, step.id, 'down') }} disabled={stepIdx === mod.steps.length - 1} className="w-4 h-4 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 text-[10px]">↓</button>
                          <button onClick={(e) => { e.stopPropagation(); deleteStep(mod.id, step.id) }}       className="w-4 h-4 flex items-center justify-center text-red-400/40 hover:text-red-400 text-[10px] ml-0.5">✕</button>
                        </div>
                      </div>
                    ))}

                    {/* Add step buttons — clearly separated, always reachable */}
                    <div className="flex gap-1.5 mt-3 pt-2 border-t border-white/6">
                      {(['learn', 'lab', 'challenge'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => addStep(mod.id, t)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-heading font-bold border transition-all ${
                            t === 'learn'
                              ? 'border-violet-500/25 text-violet-300/70 hover:bg-violet-500/15 hover:text-violet-200 hover:border-violet-500/50'
                              : t === 'lab'
                              ? 'border-teal-500/25 text-teal-300/70 hover:bg-teal-500/15 hover:text-teal-200 hover:border-teal-500/50'
                              : 'border-amber-500/25 text-amber-300/70 hover:bg-amber-500/15 hover:text-amber-200 hover:border-amber-500/50'
                          }`}
                        >
                          + {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={addModule}
            className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-sm font-heading font-bold text-white/35 hover:text-white/70 hover:border-white/30 hover:bg-white/5 transition-colors"
          >
            + Add Chapter
          </button>
        </div>

        {/* ── Right: editor ── */}
        <div className="flex-1 overflow-y-auto">
          {!selection || !selModule ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/25">
              <span className="text-4xl">👈</span>
              <p className="text-sm font-heading font-bold">Select a chapter or step to edit</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-8">
              {selection.kind === 'module' ? (
                <ModuleEditor
                  module={selModule}
                  onUpdate={(patch) => updateModule(selModule.id, patch)}
                />
              ) : selStep ? (
                <StepEditor
                  step={selStep}
                  onUpdate={(patch) => updateStep(selModule.id, selStep.id, patch)}
                  onChangeType={(t) => changeStepType(selModule.id, selStep.id, t)}
                />
              ) : (
                <div className="text-white/25 text-sm font-body">Step not found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
