import { useState, useEffect } from 'react'
import { X, Users, BookMarked, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    if (!chapterId || !novelId || !open) return
    setLoading(true)
    api.get<ContextData>(`/context/${chapterId}?novel_id=${novelId}`).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [chapterId, novelId, open])

  if (!open) return null

  return (
    <div className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto p-4">
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
      <div className="p-4 border-t border-gray-800">
        <InstructionBox novelId={novelId || undefined} />
      </div>
    </div>
  )
}
