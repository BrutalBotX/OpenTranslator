import { useState, useRef } from 'react'
import { Trash2, AlertTriangle, GripVertical, Pencil } from 'lucide-react'
import { Chapter } from '../stores/projectStore'
import { api } from '../services/apiClient'

interface ChapterNavProps {
  chapters: Chapter[]
  activeChapter: string | null
  onSelectChapter: (id: string) => void
  onDeleteChapter?: (id: string) => void
  onReorder?: (ids: string[]) => void
  novelId?: string | null
}

export default function ChapterNav({ chapters, activeChapter, onSelectChapter, onDeleteChapter, onReorder, novelId }: ChapterNavProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dragIdx = useRef<number | null>(null)
  const dragOverIdx = useRef<number | null>(null)

  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null || dragIdx.current === dragOverIdx.current) return
    const ids = chapters.map(c => c.id)
    const [moved] = ids.splice(dragIdx.current, 1)
    ids.splice(dragOverIdx.current, 0, moved)
    onReorder?.(ids)
  }

  return (
    <>
      <div className="w-36 bg-gray-900 border-r border-gray-800 p-2 overflow-y-auto shrink-0 flex flex-col">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Chapters</h4>
        <div className="flex-1 space-y-0.5">
          {chapters.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4 px-1">No chapters yet.</p>
          ) : (
            chapters.map((ch, idx) => (
              <div key={ch.id}
                draggable
                onDragStart={() => { dragIdx.current = idx }}
                onDragOver={(e) => { e.preventDefault(); dragOverIdx.current = idx }}
                onDragEnd={handleDrop}
                className={`group relative flex items-center ${dragOverIdx.current === idx ? 'pt-3' : ''}`}>
                <div className="flex items-center gap-0.5 flex-1 min-w-0">
                  <span className="text-gray-700 cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Drag to reorder"><GripVertical size={10} /></span>
                  {renamingId === ch.id ? (
                    <input type="text" value={renameValue} autoFocus
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && renameValue.trim()) {
                          try {
                            await api.put(`/chapters/${ch.id}`, { title: renameValue.trim() })
                            if (typeof novelId === 'string') {
                              const { useProjectStore } = await import('../stores/projectStore')
                              useProjectStore.getState().fetchChapters(novelId)
                            }
                          } catch {}
                        } else if (e.key === 'Escape') {
                          setRenamingId(null)
                        }
                        e.stopPropagation()
                      }}
                      onBlur={() => setRenamingId(null)}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-gray-800 border border-cyan-600 rounded px-1.5 py-1 text-xs focus:outline-none min-w-0" />
                  ) : (
                    <button onClick={() => onSelectChapter(ch.id)}
                      title={ch.title}
                      className={`flex-1 text-left px-1.5 py-1.5 rounded text-xs transition-colors min-w-0 ${
                        activeChapter === ch.id ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                      }`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.translated ? 'bg-green-500' : 'bg-gray-600'}`} />
                        <span className="whitespace-normal break-words leading-tight truncate flex-1">{ch.title}</span>
                        {activeChapter === ch.id && (
                          <button onClick={e => { e.stopPropagation(); setRenameValue(ch.title); setRenamingId(ch.id) }}
                            className="p-0.5 text-gray-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <Pencil size={8} />
                          </button>
                        )}
                      </div>
                    </button>
                  )}
                  {onDeleteChapter && activeChapter === ch.id && (
                    <button onClick={() => setDeleteTarget(ch.id)}
                      className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Delete chapter">
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
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
