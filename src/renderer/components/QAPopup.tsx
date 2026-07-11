import { X, HelpCircle } from 'lucide-react'

interface QAPopupProps {
  question: string
  type: string
  suggestions?: string[]
  onAnswer: (answer: string) => void
  onDismiss: () => void
}

export default function QAPopup({ question, type, suggestions, onAnswer, onDismiss }: QAPopupProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-yellow-400" />
            <span className="px-2 py-0.5 bg-cyan-900/50 text-cyan-300 text-xs rounded">{type}</span>
          </div>
          <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm mb-4">{question}</p>
        {suggestions && suggestions.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Suggestions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onAnswer(s)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type your answer..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onAnswer((e.target as HTMLInputElement).value)
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>('input[type="text"]')
              if (input?.value) onAnswer(input.value)
            }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
