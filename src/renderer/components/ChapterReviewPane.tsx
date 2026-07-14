import { useState, useEffect, useRef } from 'react'
import { CheckSquare, RotateCcw, Pencil, RefreshCw, Loader2, MessageSquare, Languages, Search, BookOpen } from 'lucide-react'
import { Segment } from '../stores/translationStore'
import { api } from '../services/apiClient'

interface ChapterReviewPaneProps {
  segments: Segment[]
  activeSegmentId: string | null
  onSelectSegment: (id: string) => void
  onEdit: (id: string, translation: string) => void
  onAccept: (id: string, translation?: string) => void
  chapterId?: string | null
  novelId?: string | null
}

interface TMResult {
  source_text: string; target_text: string; chapter_id: string; distance: number
}

export default function ChapterReviewPane({ segments: rawSegments, activeSegmentId, onSelectSegment, onEdit, onAccept, chapterId, novelId }: ChapterReviewPaneProps) {
  const segments = Array.isArray(rawSegments) ? rawSegments : []
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [applyingQa, setApplyingQa] = useState(false)
  const [qaApplied, setQaApplied] = useState(false)
  const [pendingQa, setPendingQa] = useState(0)
  const [reviewSearch, setReviewSearch] = useState('')
  const [tmResults, setTmResults] = useState<Record<string, TMResult[]>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const tmCache = useRef<Record<string, TMResult[]>>({})
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const fetchTm = async (segId: string, sourceText: string) => {
    if (!novelId || tmCache.current[segId]) return
    try {
      const data = await api.get<{ results: TMResult[] }>(`/tm/search?query=${encodeURIComponent(sourceText.slice(0, 200))}&novel_id=${novelId}&n_results=3`)
      if (data?.results) {
        tmCache.current[segId] = data.results.filter(r => r.target_text)
        setTmResults({ ...tmCache.current })
      }
    } catch {}
  }

  const activeSeg = activeSegmentId ? segments.find(s => s.id === activeSegmentId) : null
  useEffect(() => {
    if (activeSeg && activeSeg.source_text) fetchTm(activeSeg.id, activeSeg.source_text)
  }, [activeSegmentId])

  useEffect(() => {
    if (!chapterId || !novelId) return
    api.get<any[]>(`/questions?resolved=false&novel_id=${novelId}`).then(data => {
      if (mountedRef.current) setPendingQa(Array.isArray(data) ? data.length : 0)
    }).catch(() => {})
  }, [chapterId, novelId])

  const filtered = reviewSearch
    ? segments.filter(s =>
        s.source_text.toLowerCase().includes(reviewSearch.toLowerCase()) ||
        (s.translation || '').toLowerCase().includes(reviewSearch.toLowerCase())
      )
    : segments

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const batchAccept = async () => {
    if (!novelId) return
    try {
      await api.put('/segments/batch', { segment_ids: Array.from(selectedIds), status: 'translated', novel_id: novelId })
      for (const id of selectedIds) {
        await onAccept(id)
      }
      setSelectedIds(new Set())
    } catch {}
  }

  const batchReject = async () => {
    if (!novelId) return
    try {
      await api.put('/segments/batch', { segment_ids: Array.from(selectedIds), status: 'untouched', novel_id: novelId })
      for (const id of selectedIds) {
        onEdit(id, '')
      }
      setSelectedIds(new Set())
    } catch {}
  }

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

  return (
    <div className="flex-1 flex flex-col bg-gray-950">
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-gray-950 z-10 space-y-2">
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
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" value={reviewSearch} onChange={e => setReviewSearch(e.target.value)}
              placeholder="Search segments... (Ctrl+F)"
              className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-cyan-600" />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
              <button onClick={batchAccept} className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs text-green-200">Accept</button>
              <button onClick={batchReject} className="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs text-red-200">Reject</button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No segments match your search.</div>
        ) : filtered.map(seg => {
          const isActive = seg.id === activeSegmentId
          const editText = edits[seg.id]
          const displayText = editText !== undefined ? editText : seg.translation
          const hasChanges = editText !== undefined && editText !== seg.translation

          return (
            <div key={seg.id} className={`p-4 transition-colors ${isActive ? 'bg-gray-900 border-l-2 border-cyan-500' : 'hover:bg-gray-900/50 border-l-2 border-transparent'}`}>
              <div className="flex items-start gap-4">
                <input type="checkbox" checked={selectedIds.has(seg.id)} onChange={() => toggleSelect(seg.id)}
                  className="mt-1 shrink-0 rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-600" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectSegment(seg.id)}>
                  <span className="text-xs text-gray-600 font-mono mt-1 w-8 shrink-0">#{seg.segment_number}</span>
                  <div className="mt-1 space-y-2">
                  <p className="text-sm text-gray-400 leading-relaxed">{seg.source_text}</p>
                  {seg.transliteration && (
                    <p className="text-xs text-gray-600 italic flex items-center gap-1">
                      <Languages size={10} /> {seg.transliteration}
                    </p>
                  )}
                  {isActive ? (
                    <div className="space-y-2">
                      {!tmCache.current[seg.id] && (
                        <div className="text-[10px] text-gray-600 italic flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <BookOpen size={10} /> Loading similar translations...
                        </div>
                      )}
                      {tmCache.current[seg.id]?.length > 0 && (
                        <details className="text-xs text-gray-500">
                          <summary className="cursor-pointer text-cyan-500 hover:text-cyan-400">Similar translations ({tmCache.current[seg.id].length})</summary>
                          <div className="mt-1 space-y-1 bg-gray-850 rounded p-2 border border-gray-700">
                            {tmCache.current[seg.id].map((tm, i) => (
                              <div key={i} className="border-b border-gray-700 last:border-0 pb-1 last:pb-0">
                                <p className="text-gray-400">{tm.source_text}</p>
                                <p className="text-gray-200">→ {tm.target_text}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      {hasChanges && seg.translation && (
                        <div className="text-xs text-gray-500 bg-gray-850 rounded p-2 border border-gray-700">
                          <span className="text-gray-600 font-medium">Original:</span>
                          <span className="line-through text-gray-500 ml-1">{seg.translation}</span>
                        </div>
                      )}
                      <textarea value={displayText} onChange={e => {
                        setEdits(prev => ({ ...prev, [seg.id]: e.target.value }))
                        onEdit(seg.id, e.target.value)
                      }}
                        className="w-full bg-gray-800 border border-cyan-700 rounded px-3 py-2 text-sm leading-relaxed text-gray-100 focus:outline-none focus:border-cyan-500 min-h-[80px] resize-none"
                        onClick={e => e.stopPropagation()} />

                    </div>
                  ) : (
                    <p className="text-sm text-gray-100 leading-relaxed">{displayText}</p>
                  )}
                  <div className="flex gap-2 items-center">
                    {!isActive ? (
                      <button onClick={e => { e.stopPropagation(); onSelectSegment(seg.id) }}
                        title="Edit this segment's translation"
                        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors"><Pencil size={12} /> Edit</button>
                    ) : (
                      <>
                        <button onClick={e => { e.stopPropagation(); const editText = edits[seg.id]; onAccept(seg.id, editText); setEdits(prev => { const n = { ...prev }; delete n[seg.id]; return n }) }}
                          title="Save as final translation (Ctrl+S)"
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs transition-colors"><CheckSquare size={12} /> Accept</button>
                        <button onClick={e => { e.stopPropagation(); setEdits(prev => { const n = { ...prev }; delete n[seg.id]; return n }) }}
                          title="Discard edits and revert to original"
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors"><RotateCcw size={12} /> Reset</button>
                      </>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${seg.status === 'translated' ? 'text-green-400 bg-green-900/30' : seg.status === 'needs_review' ? 'text-yellow-400 bg-yellow-900/30' : 'text-gray-600 bg-gray-800'}`}>{seg.status}</span>
                    {seg.quality !== undefined && (() => {
                      const pct = Math.round(seg.quality * 100)
                      const cls = pct >= 80 ? 'text-green-400 bg-green-900/30' : pct >= 60 ? 'text-yellow-400 bg-yellow-900/30' : 'text-red-400 bg-red-900/30'
                      return <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{pct}%</span>
                    })()}
                    {seg.has_qa && <span className="text-xs px-1.5 py-0.5 rounded text-yellow-400 bg-yellow-900/30">has QA</span>}
                  </div>
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
