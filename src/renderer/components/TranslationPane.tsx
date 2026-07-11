import { useState, useEffect } from 'react'
import { Sparkles, CheckSquare, RotateCcw, Loader2, FileText } from 'lucide-react'

interface Segment {
  id: string
  source_text: string
  translation: string
  status: string
}

interface TranslationPaneProps {
  segment: Segment
  translating: boolean
  onTranslate: () => void
  onSave: (text: string) => void
  onSummarize?: () => void
  summarizing?: boolean
}

export default function TranslationPane({ segment, translating, onTranslate, onSave, onSummarize, summarizing }: TranslationPaneProps) {
  const [localText, setLocalText] = useState(segment.translation)
  const [edited, setEdited] = useState(false)

  useEffect(() => { setLocalText(segment.translation); setEdited(false) }, [segment.id, segment.translation])

  const handleChange = (value: string) => { setLocalText(value); setEdited(true) }

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-gray-950 flex flex-col">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Translation</h3>
      <div className="space-y-4 flex-1">
        <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500 mb-2">Source:</p>
          <p className="text-sm leading-relaxed">{segment.source_text}</p>
        </div>
        <div className="p-3 bg-gray-900 rounded-lg border border-cyan-700">
          <p className="text-xs text-gray-500 mb-2">Translation:</p>
          <textarea
            className="w-full bg-transparent text-sm leading-relaxed resize-none focus:outline-none min-h-[120px]"
            placeholder="Enter translation or click 'Translate with AI'..."
            value={localText}
            onChange={e => handleChange(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onTranslate} disabled={translating}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm transition-colors">
            {translating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {translating ? 'Translating...' : 'Translate with AI'}
          </button>
          {localText && (
            <>
              <button onClick={() => onSave(localText)}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm transition-colors">
                <CheckSquare size={16} />{edited ? 'Save Edit' : 'Accept'}
              </button>
              <button onClick={() => setLocalText('')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
                <RotateCcw size={16} />Reset
              </button>
            </>
          )}
          {onSummarize && (
            <button onClick={onSummarize} disabled={summarizing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-sm transition-colors">
              {summarizing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {summarizing ? 'Summarizing...' : 'Summarize Chapter'}
            </button>
          )}
        </div>
        {segment.status === 'translated' && !edited && <p className="text-xs text-green-500">✓ Saved</p>}
        {segment.status === 'needs_review' && <p className="text-xs text-yellow-500">⚠ Needs review</p>}
      </div>
    </div>
  )
}
