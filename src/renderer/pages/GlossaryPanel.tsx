import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Search, Loader2, Trash2, X, Pencil } from 'lucide-react'
import { api } from '../services/apiClient'

interface GlossaryTerm {
  id: string
  novel_id: string
  source_term: string
  target_term: string
  category: string
  context_note: string
}

const CATEGORIES = ['Name', 'Place', 'Technique', 'Item', 'Title', 'Concept', 'Term']

export default function GlossaryPanel() {
  const { novelId } = useParams<{ novelId: string }>()
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ target_term: '', category: 'Term', context_note: '' })
  const [form, setForm] = useState({ source_term: '', target_term: '', category: 'Term', context_note: '' })

  const load = () => {
    if (!novelId) return
    setLoading(true)
    api.get<GlossaryTerm[]>(`/glossary?novel_id=${novelId}`).then(data => setTerms(data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    let mounted = true
    if (!novelId) return
    setLoading(true)
    api.get<GlossaryTerm[]>(`/glossary?novel_id=${novelId}`).then(data => { if (mounted) setTerms(data) }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [novelId])

  const add = async () => {
    if (!form.source_term.trim() || !form.target_term.trim() || !novelId) return
    await api.post('/glossary', { novel_id: novelId, ...form })
    setShowAdd(false)
    setForm({ source_term: '', target_term: '', category: 'Term', context_note: '' })
    load()
  }

  const remove = async (id: string) => { await api.delete(`/glossary/${id}`); load() }

  const startEdit = (t: GlossaryTerm) => {
    setEditId(t.id)
    setEditForm({ target_term: t.target_term, category: t.category, context_note: t.context_note })
  }

  const saveEdit = async (id: string) => {
    try {
      await api.put(`/glossary/${id}`, editForm)
      setEditId(null)
      load()
    } catch {}
  }

  const filtered = terms.filter(t =>
    t.source_term.toLowerCase().includes(search.toLowerCase()) ||
    t.target_term.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Glossary</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors"><Plus size={16} /> Add Term</button>
      </div>
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search glossary..." className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-cyan-600" /></div>
      {loading ? (<div className="flex items-center justify-center py-16 text-gray-500"><Loader2 size={20} className="animate-spin mr-2" /><span className="text-sm">Loading...</span></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors group">
              {editId === t.id ? (
                <div className="space-y-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-cyan-300 text-sm">{t.source_term}</span>
                    <span className="text-gray-500">→</span>
                    <input type="text" value={editForm.target_term}
                      onChange={e => setEditForm({ ...editForm, target_term: e.target.value })}
                      className="flex-1 bg-gray-800 border border-cyan-700 rounded px-2 py-1 text-sm focus:outline-none" />
                    <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none">
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <input type="text" value={editForm.context_note}
                      onChange={e => setEditForm({ ...editForm, context_note: e.target.value })}
                      placeholder="Context note"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none" />
                    <button onClick={() => saveEdit(t.id)} className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs text-cyan-200">Save</button>
                    <button onClick={() => setEditId(null)} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div><span className="font-medium text-cyan-300">{t.source_term}</span><span className="text-gray-500 mx-2">→</span><span>{t.target_term}</span><span className="ml-2 px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">{t.category}</span></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(t)} className="p-1.5 text-gray-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"><Pencil size={14} /></button>
                      <button onClick={() => remove(t.id)} className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {t.context_note && <p className="text-xs text-gray-500 mt-1">{t.context_note}</p>}
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && !loading && <p className="text-center text-gray-600 text-sm py-8">No glossary terms yet</p>}
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Add Glossary Term</h3><button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button></div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1">Source Term *</label><input type="text" value={form.source_term} onChange={e => setForm({ ...form, source_term: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" autoFocus /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Target Term *</label><input type="text" value={form.target_term} onChange={e => setForm({ ...form, target_term: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" /></div>
              </div>
              <div><label className="block text-xs text-gray-500 mb-1">Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Context Note</label><textarea value={form.context_note} onChange={e => setForm({ ...form, context_note: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600 min-h-[60px]" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={add} disabled={!form.source_term.trim() || !form.target_term.trim()} className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm transition-colors">Add Term</button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
