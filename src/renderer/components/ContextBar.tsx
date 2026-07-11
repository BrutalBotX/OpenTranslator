import { Sidebar } from 'lucide-react'
import { useProjectStore } from '../stores/projectStore'

interface ContextBarProps {
  showContext?: boolean
  onToggleContext?: () => void
}

export default function ContextBar({ showContext, onToggleContext }: ContextBarProps) {
  const { novel, chapters } = useProjectStore()
  const totalChapters = chapters.length
  const translatedChapters = chapters.filter(c => c.translated).length

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs">
      {novel ? (
        <>
          <span className="text-gray-500">Project:</span>
          <span className="text-cyan-300 font-medium">{novel.title}</span>
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>{translatedChapters}/{totalChapters} chapters</span>
          </span>
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
            <span>{novel.source_lang.toUpperCase()} → {novel.target_lang.toUpperCase()}</span>
          </span>
        </>
      ) : (
        <span className="text-gray-500">No project selected</span>
      )}
      <span className="flex-1" />
      <span className="text-gray-600">{novel?.genre || ''}</span>
      {onToggleContext && (
        <button
          onClick={onToggleContext}
          className={`p-1 rounded transition-colors ${showContext ? 'text-cyan-400 bg-cyan-900/30' : 'text-gray-500 hover:text-gray-300'}`}
          title="Toggle context panel"
        >
          <Sidebar size={14} />
        </button>
      )}
    </div>
  )
}
