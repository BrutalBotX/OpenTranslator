import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, FileText, Trash2, Loader2, AlertTriangle, AlertCircle, X } from 'lucide-react'
import { useProjectStore, Novel } from '../stores/projectStore'
import { useStatusStore } from '../stores/statusStore'
import { useSettingsStore } from '../stores/settingsStore'

const DOCS = 'http://127.0.0.1:8712/api'

export default function ProjectHome() {
  const navigate = useNavigate()
  const { projects, fetchProjects, createProject, deleteProject, loadNovel } = useProjectStore()
  const backendStatus = useStatusStore(s => s.backendStatus)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', source_lang: 'zh', target_lang: 'en', genre: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null)
  const [customPath, setCustomPath] = useState(false)
  const [projectPath, setProjectPath] = useState('')

  useEffect(() => {
    if (backendStatus === 'connected') fetchProjects()
  }, [backendStatus])

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setCreating(true)
    setError(null)
    try {
      const defaultDir = useSettingsStore.getState().values.default_project_dir || ''
      let saveDir = ''
      if (customPath && projectPath.trim()) {
        saveDir = projectPath.trim()
      } else if (defaultDir) {
        saveDir = defaultDir
      }
      const payload = { ...form, save_dir: saveDir || undefined }
      const novel = await createProject(payload as any)
      setShowNew(false)
      setCustomPath(false)
      setProjectPath('')
      setForm({ title: '', source_lang: 'zh', target_lang: 'en', genre: '' })
      await loadNovel(novel.id)
      navigate(`/translate/${novel.id}`)
    } catch (e: any) {
      setError(e?.message || 'Failed to connect to backend.')
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteProject(deleteTarget.id)
    } catch (e: any) {
      setError(`Delete failed: ${e.message}`)
    }
    setDeleteTarget(null)
  }

  const openProject = async (id: string) => {
    try {
      await loadNovel(id)
      navigate(`/translate/${id}`)
    } catch { setError('Failed to open project.') }
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Projects</h2>
          <div className="flex gap-3">
            <button onClick={() => window.electronAPI.openProject()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
              <FolderOpen size={16} /> Open Project
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors">
              <Plus size={16} /> New Project
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg flex items-start gap-2 text-sm">
            <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <span className="text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-600" />
            <p className="text-gray-500 mb-2">No projects yet</p>
            <p className="text-gray-600 text-sm mb-6">Create a new project or open an existing one to get started</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowNew(true)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors">New Project</button>
              <button onClick={() => window.electronAPI.openProject()} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Open Existing</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p: Novel) => (
              <div key={p.id} onClick={() => openProject(p.id)}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 cursor-pointer transition-colors group">
                <div>
                  <h3 className="font-medium">{p.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {p.source_lang.toUpperCase()} → {p.target_lang.toUpperCase()}
                    {p.genre ? ` · ${p.genre}` : ''}
                    {' · '}{p.chapter_count} chapter{p.chapter_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
                  className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNew(false)}>
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">New Project</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source Language</label>
                  <select value={form.source_lang} onChange={e => setForm({ ...form, source_lang: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">
                    <option value="zh">Chinese (ZH)</option><option value="ja">Japanese (JA)</option><option value="ko">Korean (KO)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Language</label>
                  <select value={form.target_lang} onChange={e => setForm({ ...form, target_lang: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">
                    <option value="en">English (EN)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Genre (optional)</label>
                <input type="text" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer pt-1">
                <input type="checkbox" checked={customPath} onChange={e => setCustomPath(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-600 text-cyan-600 focus:ring-cyan-600" />
                Save to custom location
              </label>
              {customPath && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Project Path</label>
                  <div className="flex gap-2">
                    <input type="text" value={projectPath} onChange={e => setProjectPath(e.target.value)}
                      placeholder="e.g. C:\Users\name\Documents\MyNovels"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" />
                    <button onClick={async () => {
                      const dir = window.electronAPI?.selectDirectory ? await window.electronAPI.selectDirectory() : null
                      if (dir) setProjectPath(dir)
                    }} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors" title="Browse...">
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleCreate} disabled={!form.title.trim() || creating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm transition-colors">
                {creating && <Loader2 size={16} className="animate-spin" />}
                {creating ? 'Creating...' : 'Create Project'}
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-gray-900 rounded-xl border border-red-800/50 w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={24} className="text-red-400 shrink-0" />
              <div>
                <h3 className="text-lg font-bold">Delete Project</h3>
                <p className="text-sm text-gray-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to delete <span className="text-red-400 font-medium">{deleteTarget.title}</span>? All chapters, characters, and glossary terms will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm transition-colors">Delete</button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
