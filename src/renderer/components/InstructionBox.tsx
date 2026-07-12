import { useState, useEffect, useRef } from 'react'
import { BookOpen, Save, Loader2, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { api } from '../services/apiClient'

interface InstructionBoxProps {
  novelId: string | undefined
  chapterId?: string | null
}

export default function InstructionBox({ novelId, chapterId }: InstructionBoxProps) {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  useEffect(() => {
    if (!novelId) return
    setLoading(true)
    api.get<{ instructions: string }>(`/projects/${novelId}/instructions`)
      .then(data => { setText(data.instructions); setSavedText(data.instructions); setCollapsed(false) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [novelId])

  const handleSave = async () => {
    if (!novelId) return
    setSaving(true)
    try {
      await api.put(`/projects/${novelId}/instructions`, { instructions: text })
      setSavedText(text)
      setSaved(true)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaved(false), 3000)
    } catch (e) { console.error('Failed to save instructions', e) }
    setSaving(false)
  }

  const buildPreview = async () => {
    if (!novelId || !chapterId) return
    setPreviewLoading(true)
    try {
      const ctx = await api.get<any>(`/context/${chapterId}?novel_id=${novelId}`)
      const lines: string[] = []
      if (text.trim()) {
        lines.push('--- USER INSTRUCTIONS ---')
        lines.push(text.trim())
        lines.push('')
      }
      const chars = ctx.characters || []
      if (chars.length > 0) {
        lines.push('--- CHARACTERS ---')
        for (const c of chars) {
          const parts = [`${c.name}: ${c.gender || '?'}, ${c.role || '?'}`]
          if (c.status) parts.push(`status=${c.status}`)
          const variants = c.name_variants || []
          if (variants.length > 0) parts.push(`aliases: ${variants.join(', ')}`)
          if (c.state_summary) parts.push(`» ${c.state_summary.slice(0, 80)}`)
          lines.push(`  ${parts.join(' · ')}`)
        }
        lines.push('')
      }
      const glossary = ctx.glossary || []
      if (glossary.length > 0) {
        lines.push('--- GLOSSARY ---')
        for (const g of glossary) lines.push(`  ${g.source_term} → ${g.target_term} (${g.category})`)
        lines.push('')
      }
      const arcs = ctx.plot_arcs || []
      if (arcs.length > 0) {
        lines.push('--- PLOT ARCS ---')
        for (const a of arcs) lines.push(`  ${a.arc_name}: ${(a.summary || '').slice(0, 100)}`)
      }
      setPreview(lines.join('\n'))
    } catch { setPreview('Failed to load context') }
    setPreviewLoading(false)
  }

  useEffect(() => {
    if (showPreview && !preview && !previewLoading) buildPreview()
  }, [showPreview])

  const hasChanges = text !== savedText
  const cmdCount = (text.match(/(?:replace|rename|change|add|set|mark)\s+/gi) || []).length

  return (
    <div className="h-full flex flex-col">
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0">
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <BookOpen size={12} />
        <span>Instructions</span>
        {savedText && <span className="text-cyan-500">(active)</span>}
        {cmdCount > 0 && <span className="text-cyan-500">· {cmdCount} cmd{cmdCount > 1 ? 's' : ''}</span>}
        {hasChanges && <span className="text-yellow-500">(unsaved)</span>}
        {!collapsed && savedText && (
          <span className="ml-auto">
            <button onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview); if (!showPreview) buildPreview() }}
              className={`flex items-center gap-1 text-xs transition-colors ${showPreview ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
              <Eye size={12} /> {showPreview ? 'Hide' : 'View prompt'}
            </button>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-0 px-3 pb-2">
          {showPreview ? (
            <div className="flex-1 flex flex-col min-h-0">
              {previewLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-4 justify-center"><Loader2 size={12} className="animate-spin" />Building...</div>
              ) : (
                <pre className="flex-1 bg-gray-950 border border-gray-700 rounded px-2 py-1.5 text-xs leading-relaxed text-gray-300 font-mono overflow-auto whitespace-pre-wrap min-h-0">{preview || 'No data'}</pre>
              )}
            </div>
          ) : (
            <>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-4 justify-center"><Loader2 size={12} className="animate-spin" />Loading...</div>
              ) : (
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder={'e.g. "Replace name Mara Minato with Shinra Minato"\nor "Keep surname first (Japanese order)"'}
                  className="flex-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs leading-relaxed text-gray-200 focus:outline-none focus:border-cyan-600 min-h-0 resize-none overflow-auto font-mono" />
              )}
              <div className="flex gap-1 mt-1.5 shrink-0">
                <button onClick={handleSave} disabled={saving || !hasChanges}
                  className="flex items-center gap-1 px-2 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded text-xs text-cyan-200 transition-colors">
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
