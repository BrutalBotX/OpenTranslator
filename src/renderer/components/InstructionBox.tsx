import { useState, useEffect, useRef } from 'react'
import { BookOpen, Save, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../services/apiClient'

interface InstructionBoxProps {
  novelId: string | undefined
}

export default function InstructionBox({ novelId }: InstructionBoxProps) {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!novelId) return
    setLoading(true)
    api.get<{ instructions: string }>(`/projects/${novelId}/instructions`)
      .then(data => { setText(data.instructions); setSavedText(data.instructions) })
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

  const hasChanges = text !== savedText
  const cmdCount = (text.match(/(?:replace|rename|change|add|set|mark)\s+/gi) || []).length

  return (
    <div className="border-t border-gray-800 pt-3 mt-3">
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-1">
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <BookOpen size={12} />
        <span>Instructions</span>
        {savedText && <span className="text-cyan-500">(active)</span>}
        {cmdCount > 0 && <span className="text-cyan-500">· {cmdCount} cmd{cmdCount > 1 ? 's' : ''}</span>}
        {hasChanges && <span className="text-yellow-500">(unsaved)</span>}
      </button>
      {!collapsed && (
        <div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 py-2"><Loader2 size={12} className="animate-spin" />Loading...</div>
          ) : (
            <div className="space-y-1.5">
              <textarea value={text} onChange={e => setText(e.target.value)}
                placeholder={'e.g. "Replace name Mara Minato with Shinra Minato"\nor "Keep surname first (Japanese order)"'}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs leading-relaxed text-gray-200 focus:outline-none focus:border-cyan-600 min-h-[52px] resize-y font-mono" />
              <div className="flex gap-1">
                <button onClick={handleSave} disabled={saving || !hasChanges}
                  className="flex items-center gap-1 px-2 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded text-xs text-cyan-200 transition-colors">
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
