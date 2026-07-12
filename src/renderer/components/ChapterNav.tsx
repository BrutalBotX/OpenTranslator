import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Chapter } from '../stores/projectStore'

interface ChapterNavProps {
  chapters: Chapter[]
  activeChapter: string | null
  onSelectChapter: (id: string) => void
  onDeleteChapter?: (id: string) => void
  novelId?: string | null
}

export default function ChapterNav({ chapters, activeChapter, onSelectChapter, onDeleteChapter, novelId }: ChapterNavProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  return (
    <>
      <div className="w-36 bg-gray-900 border-r border-gray-800 p-2 overflow-y-auto shrink-0 flex flex-col">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Chapters</h4>
        <div className="flex-1 space-y-0.5">
          {chapters.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4 px-1">No chapters yet.</p>
          ) : (
            chapters.map(ch => (
              <div key={ch.id} className="group relative flex items-center">
                <button onClick={() => onSelectChapter(ch.id)}
                  title={ch.title}
                  className={`flex-1 text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    activeChapter === ch.id ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.translated ? 'bg-green-500' : 'bg-gray-600'}`} />
                    <span className="whitespace-normal break-words leading-tight">{ch.title}</span>
                  </div>
                </button>
                {onDeleteChapter && activeChapter === ch.id && (
                  <button onClick={() => setDeleteTarget(ch.id)}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete chapter">
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-gray-900 rounded-xl border border-red-800/50 w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-400 shrink-0" />
              <div>
                <h3 className="text-lg font-bold">Delete Chapter</h3>
                <p className="text-sm text-gray-400 mt-0.5">Segments and translations will be permanently removed.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { onDeleteChapter?.(deleteTarget); setDeleteTarget(null) }}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm transition-colors">Delete</button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
