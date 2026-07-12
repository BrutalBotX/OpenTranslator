import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Users, BookMarked, Loader2, GripHorizontal } from 'lucide-react'
import { api } from '../services/apiClient'
import InstructionBox from './InstructionBox'

interface Character {
  name: string; gender: string; role: string; status: string; state_summary: string; name_variants: string[]
}

interface GlossaryTerm {
  source_term: string; target_term: string; category: string; context_note: string
}

interface ContextData {
  source_lang: string; target_lang: string; genre: string; novel_summary: string; chapter_title: string; chapter_number: number
  characters: Character[]; glossary: GlossaryTerm[]; plot_arcs: { arc_name: string; summary: string }[]
}

interface ContextPanelProps {
  chapterId: string | null; novelId: string | null; open: boolean; onClose: () => void
}

export default function ContextPanel({ chapterId, novelId, open, onClose }: ContextPanelProps) {
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(false)
  const [instrHeight, setInstrHeight] = useState(150)
  const dragging = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chapterId || !novelId || !open) return
    setLoading(true)
    api.get<ContextData>(`/context/${chapterId}?novel_id=${novelId}`).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [chapterId, novelId, open])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const startY = e.clientY
    const startH = instrHeight

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !panelRef.current) return
      const panelBottom = panelRef.current.getBoundingClientRect().bottom
      const newH = startH + (startY - ev.clientY)
      const clamped = Math.max(60, Math.min(newH, panelBottom - 100 - 60))
      setInstrHeight(clamped)
    }

    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [instrHeight])

  if (!open) return null

  return (
    <div className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0" ref={panelRef}>
      <div className="flex-1 overflow-y-auto p-4" style={{ height: `calc(100% - ${instrHeight + 4}px)` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Context</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={14} /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500"><Loader2 size={16} className="animate-spin mr-2" /><span className="text-xs">Loading context...</span></div>
        ) : !data ? (
          <p className="text-xs text-gray-600">Select a chapter to see context</p>
        ) : (
          <div className="space-y-5">
            {data.plot_arcs.length > 0 && (
              <div><h4 className="text-xs font-medium text-cyan-400 mb-2">Plot Arcs</h4>
                {data.plot_arcs.map((arc, i) => (
                  <div key={i} className="mb-2"><p className="text-xs font-medium text-gray-300">{arc.arc_name}</p><p className="text-xs text-gray-500 mt-0.5">{arc.summary?.slice(0, 100)}</p></div>
                ))}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5 mb-2"><Users size={13} className="text-gray-400" /><h4 className="text-xs font-medium text-cyan-400">Characters ({data.characters.length})</h4></div>
              {data.characters.length === 0 ? (<p className="text-xs text-gray-600">No characters added yet</p>) : (
                <div className="space-y-2">
                  {data.characters.map(c => (
                    <div key={c.name} className="text-xs bg-gray-800 rounded p-2">
                      <div className="flex items-center justify-between"><span className="font-medium text-gray-200">{c.name}</span><span className={`px-1 py-0.5 rounded text-[10px] ${c.gender === 'Male' ? 'bg-blue-900/50 text-blue-300' : c.gender === 'Female' ? 'bg-pink-900/50 text-pink-300' : 'bg-gray-700 text-gray-400'}`}>{c.gender}</span></div>
                      <div className="flex gap-1 mt-1"><span className="text-gray-500">{c.role}</span><span className="text-gray-600">·</span><span className={c.status === 'Alive' ? 'text-green-400' : 'text-red-400'}>{c.status}</span></div>
                      {c.state_summary && <p className="text-gray-500 mt-1 leading-relaxed">{c.state_summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2"><BookMarked size={13} className="text-gray-400" /><h4 className="text-xs font-medium text-cyan-400">Glossary ({data.glossary.length})</h4></div>
              {data.glossary.length === 0 ? (<p className="text-xs text-gray-600">No glossary terms added yet</p>) : (
                <div className="space-y-1.5">
                  {data.glossary.map(g => (
                    <div key={g.source_term} className="text-xs bg-gray-800 rounded p-1.5">
                      <span className="text-cyan-300">{g.source_term}</span><span className="text-gray-600 mx-1">→</span><span className="text-gray-300">{g.target_term}</span><span className="text-gray-600 ml-1">({g.category})</span>
                      {g.context_note && <p className="text-gray-500 mt-0.5">{g.context_note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="h-1 cursor-row-resize flex items-center justify-center bg-gray-800 hover:bg-cyan-700/30 transition-colors shrink-0 group"
        onMouseDown={onMouseDown}>
        <GripHorizontal size={10} className="text-gray-600 group-hover:text-cyan-400" />
      </div>
      <div style={{ height: instrHeight }} className="shrink-0 overflow-hidden">
        <InstructionBox novelId={novelId || undefined} chapterId={chapterId} />
      </div>
    </div>
  )
}
