import { Upload, Loader2, Download, Eye, Languages } from 'lucide-react'
import { api } from '../services/apiClient'
import { Chapter } from '../stores/projectStore'
import { ViewMode } from '../stores/translationStore'

interface ChapterNavProps {
  chapters: Chapter[]
  activeChapter: string | null
  onSelectChapter: (id: string) => void
  novelId?: string | null
}

export default function ChapterNav({ chapters, activeChapter, onSelectChapter, novelId }: ChapterNavProps) {
  return (
    <div className="w-36 bg-gray-900 border-r border-gray-800 p-2 overflow-y-auto shrink-0 flex flex-col">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Chapters</h4>
      <div className="flex-1 space-y-0.5">
        {chapters.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4 px-1">No chapters yet.</p>
        ) : (
          chapters.map(ch => (
            <button key={ch.id} onClick={() => onSelectChapter(ch.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                activeChapter === ch.id ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.translated ? 'bg-green-500' : 'bg-gray-600'}`} />
                <span className="truncate flex-1">{ch.title}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
