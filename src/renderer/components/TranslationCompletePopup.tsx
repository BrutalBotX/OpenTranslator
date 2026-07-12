import { CheckCircle, ArrowRight, X, AlertTriangle } from 'lucide-react'

export interface ChapterResult {
  segments: { id: string; segment_number: number; source_text: string; translation: string; status: string }[]
  total: number
  chapter_title: string
  chapter_number: number
}

interface TranslationCompletePopupProps {
  result: ChapterResult
  onGoToReview: () => void
  onDismiss: () => void
}

export default function TranslationCompletePopup({ result, onGoToReview, onDismiss }: TranslationCompletePopupProps) {
  const segments = result.segments || []
  const previewSegments = segments.slice(0, 3)
  const warnings = segments.filter((s: any) => s.status === 'needs_review')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onDismiss}>
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <CheckCircle size={28} className="text-green-400" />
            <div>
              <h2 className="text-lg font-bold">Chapter Translated</h2>
              <p className="text-sm text-gray-400">{result.chapter_title} — {result.total} segments</p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex gap-4 px-6 py-4 bg-gray-950 border-b border-gray-800">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Segments:</span>
            <span className="text-gray-200 font-medium">{result.total}</span>
          </div>
          {warnings.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle size={14} className="text-yellow-400" />
              <span className="text-yellow-400">{warnings.length} need review</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {previewSegments.map(seg => (
            <div key={seg.id} className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">#{seg.segment_number}</div>
              <p className="text-sm text-gray-400 mb-2 italic">{seg.source_text}</p>
              <p className="text-sm text-gray-100 border-t border-gray-700 pt-2">{seg.translation}</p>
            </div>
          ))}
          {segments.length > 3 && (
            <p className="text-center text-sm text-gray-500">... and {segments.length - 3} more segments</p>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-800">
          <button onClick={onGoToReview}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition-colors">
            Go to Review <ArrowRight size={16} />
          </button>
          <button onClick={onDismiss}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
