import { useState, useEffect } from 'react'
import { CheckSquare, RotateCcw, Pencil, RefreshCw, Loader2, MessageSquare, Languages } from 'lucide-react'
import { Segment } from '../stores/translationStore'
import { api } from '../services/apiClient'

interface ChapterReviewPaneProps {
  segments: Segment[]
  activeSegmentId: string | null
  onSelectSegment: (id: string) => void
  onEdit: (id: string, translation: string) => void
  onAccept: (id: string) => void
  chapterId?: string | null
  novelId?: string | null
}

export default function ChapterReviewPane({ segments: rawSegments, activeSegmentId, onSelectSegment, onEdit, onAccept, chapterId, novelId }: ChapterReviewPaneProps) {
  const segments = Array.isArray(rawSegments) ? rawSegments : []
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [applyingQa, setApplyingQa] = useState(false)
  const [qaApplied, setQaApplied] = useState(false)
  const [pendingQa, setPendingQa] = useState(0)

  useEffect(() => {
    if (!chapterId || !novelId) return
    api.get<any[]>(`/questions?resolved=false&novel_id=${novelId}`).then(data => {
      setPendingQa(Array.isArray(data) ? data.length : 0)
    }).catch(() => {})
  }, [chapterId, novelId])

  const handleApplyQA = async () => {
    if (!chapterId || !novelId) return
    setApplyingQa(true)
    try {
      const result = await api.post<{ segments: Segment[]; applied: number }>(`/chapters/${chapterId}/apply-qa`, { novel_id: novelId })
      if (result.applied > 0) {
        result.segments.forEach(s => onEdit(s.id, s.translation))
        setQaApplied(true)
        setTimeout(() => setQaApplied(false), 3000)
      }
    } catch (e) { console.error('Apply QA failed', e) }
    setApplyingQa(false)
  }

  const hasQaSegments = segments.some(s => s.has_qa)

  if (segments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <p className="text-sm">Translate a chapter to begin reviewing</p>
      </div>
    )
  }

  const qaSegments = segments.filter(s => s.has_qa)

  return (
    <div className="flex-1 flex flex-col bg-gray-950">
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Translations</h3>
              <p className="text-xs text-gray-600 mt-0.5">Click any segment to edit its translation. Accept to confirm.</p>
            </div>
            {pendingQa > 0 && (
              <a href={`#/qa/${novelId}`} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-800/30 rounded text-xs text-yellow-300 transition-colors">
                <MessageSquare size={12} />
                {pendingQa} unresolved QA
              </a>
            )}
          </div>
          {hasQaSegments && (
            <button onClick={handleApplyQA} disabled={applyingQa}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                qaApplied ? 'bg-green-700 text-green-200' : 'bg-cyan-700/50 hover:bg-cyan-700 text-cyan-200'
              }`}>
              {applyingQa ? <Loader2 size={12} className="animate-spin" /> : qaApplied ? <CheckSquare size={12} /> : <RefreshCw size={12} />}
              {applyingQa ? 'Applying...' : qaApplied ? 'Applied!' : 'Apply QA Answers'}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {segments.map(seg => {
          const isActive = seg.id === activeSegmentId
          const editText = edits[seg.id]
          const displayText = editText !== undefined ? editText : seg.translation

          return (
            <div key={seg.id} onClick={() => onSelectSegment(seg.id)}
              className={`p-4 cursor-pointer transition-colors ${isActive ? 'bg-gray-900 border-l-2 border-cyan-500' : 'hover:bg-gray-900/50 border-l-2 border-transparent'}`}>
              <div className="flex items-start gap-4">
                <span className="text-xs text-gray-600 font-mono mt-1 w-8 shrink-0">#{seg.segment_number}</span>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-gray-400 leading-relaxed">{seg.source_text}</p>
                  {seg.transliteration && (
                    <p className="text-xs text-gray-600 italic flex items-center gap-1">
                      <Languages size={10} /> {seg.transliteration}
                    </p>
                  )}
                  {isActive ? (
                    <textarea value={displayText} onChange={e => setEdits(prev => ({ ...prev, [seg.id]: e.target.value }))}
                      className="w-full bg-gray-800 border border-cyan-700 rounded px-3 py-2 text-sm leading-relaxed text-gray-100 focus:outline-none focus:border-cyan-500 min-h-[80px] resize-none"
                      onClick={e => e.stopPropagation()} />
                  ) : (
                    <p className="text-sm text-gray-100 leading-relaxed">{displayText}</p>
                  )}
                  <div className="flex gap-2 items-center">
                    {!isActive ? (
                      <button onClick={e => { e.stopPropagation(); onSelectSegment(seg.id) }}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors"><Pencil size={12} /> Edit</button>
                    ) : (
                      <>
                        <button onClick={e => { e.stopPropagation(); onAccept(seg.id); setEdits(prev => { const n = { ...prev }; delete n[seg.id]; return n }) }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs transition-colors"><CheckSquare size={12} /> Accept</button>
                        <button onClick={e => { e.stopPropagation(); setEdits(prev => { const n = { ...prev }; delete n[seg.id]; return n }) }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors"><RotateCcw size={12} /> Reset</button>
                      </>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${seg.status === 'translated' ? 'text-green-400 bg-green-900/30' : seg.status === 'needs_review' ? 'text-yellow-400 bg-yellow-900/30' : 'text-gray-600 bg-gray-800'}`}>{seg.status}</span>
                    {seg.has_qa && <span className="text-xs px-1.5 py-0.5 rounded text-yellow-400 bg-yellow-900/30">has QA</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
