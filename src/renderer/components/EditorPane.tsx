import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../services/apiClient'

interface Segment {
  id: string
  chapter_id: string
  segment_number: number
  source_text: string
  translation: string
  status: 'untouched' | 'translating' | 'translated' | 'needs_review'
  has_qa: boolean
}

interface EditorPaneProps {
  segments: Segment[]
  activeSegment: string | null
  onSelectSegment: (id: string) => void
  loading?: boolean
  novelId?: string | null
}

interface GlossaryTerm {
  source_term: string
  target_term: string
  category: string
}

const statusColor: Record<string, string> = {
  untouched: 'border-gray-800', translating: 'border-cyan-600', translated: 'border-green-700', needs_review: 'border-yellow-600',
}

function HighlightedText({ text, terms }: { text: string; terms: GlossaryTerm[] }) {
  if (!terms.length) return <>{text}</>
  const sorted = [...terms].sort((a, b) => b.source_term.length - a.source_term.length)
  const parts: { text: string; highlight?: boolean; term?: GlossaryTerm }[] = []
  let remaining = text
  while (remaining.length > 0) {
    let bestMatch: { idx: number; term: GlossaryTerm } | null = null
    for (const term of sorted) {
      const idx = remaining.indexOf(term.source_term)
      if (idx !== -1 && (!bestMatch || idx < bestMatch.idx)) bestMatch = { idx, term }
    }
    if (!bestMatch) { parts.push({ text: remaining }); break }
    if (bestMatch.idx > 0) parts.push({ text: remaining.slice(0, bestMatch.idx) })
    parts.push({ text: bestMatch.term.source_term, highlight: true, term: bestMatch.term })
    remaining = remaining.slice(bestMatch.idx + bestMatch.term.source_term.length)
  }
  return (<span>{parts.map((part, i) => part.highlight ? (
    <span key={i} className="relative group border-b border-dashed border-cyan-500 text-cyan-300 cursor-help">
      {part.text}
      <span className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-800 text-xs text-gray-200 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {part.term?.target_term} <span className="text-gray-500">({part.term?.category})</span>
      </span>
    </span>
  ) : <span key={i}>{part.text}</span>)}</span>)
}

export default function EditorPane({ segments, activeSegment, onSelectSegment, loading, novelId }: EditorPaneProps) {
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([])
  useEffect(() => {
    if (!novelId) return
    api.get<GlossaryTerm[]>(`/glossary?novel_id=${novelId}`).then(data => setGlossary(data)).catch(() => {})
  }, [novelId])

  const termsForChapter = useMemo(() => {
    if (!segments.length) return glossary
    const allText = segments.map(s => s.source_text).join(' ')
    return glossary.filter(t => allText.includes(t.source_term))
  }, [glossary, segments])

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-gray-950">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Text</h3>
        {termsForChapter.length > 0 && <span className="text-xs text-cyan-500">{termsForChapter.length} glossary terms</span>}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 size={20} className="animate-spin mr-2" /><span className="text-sm">Loading segments...</span></div>
      ) : segments.length === 0 ? (
        <div className="text-center py-16 text-gray-600"><p className="text-sm">Open a chapter to begin translating</p></div>
      ) : (
        <div className="space-y-2">
          {segments.map(seg => (
            <div key={seg.id} onClick={() => onSelectSegment(seg.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${activeSegment === seg.id ? 'border-cyan-600 bg-gray-900' : `${statusColor[seg.status]} bg-gray-900/50 hover:bg-gray-900`}`}>
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-600 mt-0.5 font-mono shrink-0">{seg.segment_number}</span>
                <p className="text-sm leading-relaxed"><HighlightedText text={seg.source_text} terms={termsForChapter} /></p>
              </div>
              <div className="flex gap-2 mt-2 ml-5">
                <span className={`text-xs px-1.5 py-0.5 rounded ${seg.status === 'translated' ? 'text-green-400 bg-green-900/30' : seg.status === 'translating' ? 'text-cyan-400 bg-cyan-900/30' : seg.status === 'needs_review' ? 'text-yellow-400 bg-yellow-900/30' : 'text-gray-600 bg-gray-800'}`}>{seg.status}</span>
                {seg.has_qa && <span className="text-xs px-1.5 py-0.5 rounded text-yellow-400 bg-yellow-900/30">has questions</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
