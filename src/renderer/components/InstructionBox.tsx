import { useState, useEffect, useRef } from 'react'
import { BookOpen, Save, Loader2, ChevronDown, ChevronRight, Eye, BookMarked, Trash2 } from 'lucide-react'
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
  const [presets, setPresets] = useState<string[]>([])
  const [presetName, setPresetName] = useState('')
  const [showPresets, setShowPresets] = useState(false)
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

  const loadPresets = async () => {
    try {
      const data = await api.get<{ presets: { name: string; instructions: string }[] }>('/projects/presets')
      setPresets(data.presets.map(p => p.name))
    } catch {}
  }

  useEffect(() => { if (showPresets) loadPresets() }, [showPresets])

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

  const applyPreset = async (name: string) => {
    try {
      const data = await api.get<{ presets: { name: string; instructions: string }[] }>('/projects/presets')
      const preset = data.presets.find(p => p.name === name)
      if (preset) setText(preset.instructions)
      setShowPresets(false)
    } catch {}
  }

  const saveAsPreset = async () => {
    if (!presetName.trim() || !text.trim()) return
    try {
      await api.post('/projects/presets', { name: presetName.trim(), instructions: text })
      setPresetName('')
      loadPresets()
    } catch {}
  }

  const deletePreset = async (name: string) => {
    try {
      await api.delete(`/projects/presets/${encodeURIComponent(name)}`)
      loadPresets()
    } catch {}
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
        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0">
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <BookOpen size={12} />
        <span>Instructions</span>
        {savedText && <span className="text-cyan-500 ml-0.5">· active</span>}
        {hasChanges && <span className="text-yellow-500 ml-0.5">· unsaved</span>}
        {!collapsed && (
          <span className="ml-auto flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setShowPresets(!showPresets) }}
              title="Save or load instruction presets"
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${showPresets ? 'text-cyan-400 bg-cyan-900/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}>
              <BookMarked size={11} className="inline mr-0.5" />Presets
            </button>
            {savedText && (
              <button onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview); }}
                title="Preview the full prompt sent to the LLM"
                className={`px-1.5 py-0.5 rounded text-xs transition-colors ${showPreview ? 'text-cyan-400 bg-cyan-900/30' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}>
                <Eye size={11} className="inline mr-0.5" />{showPreview ? 'Hide' : 'Prompt'}
              </button>
            )}
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
          ) : showPresets ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex gap-1">
                <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-600" />
                <button onClick={saveAsPreset} disabled={!presetName.trim() || !text.trim()}
                  className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded text-xs text-cyan-200">Save</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {presets.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No saved presets.</p>
                ) : presets.map(name => (
                  <div key={name} className="flex items-center gap-1 group">
                    <button onClick={() => applyPreset(name)}
                      className="flex-1 text-left px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-colors truncate">{name}</button>
                    <button onClick={() => deletePreset(name)}
                      className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500 py-4 justify-center"><Loader2 size={12} className="animate-spin" />Loading...</div>
              ) : (
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder={'e.g. "Replace name Mara Minato with Shinra Minato"\nor "Keep surname first (Japanese order)"'}
                  className="flex-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm leading-relaxed text-gray-200 focus:outline-none focus:border-cyan-600 min-h-0 resize-none overflow-auto font-mono" />
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
