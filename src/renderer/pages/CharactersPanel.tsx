import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Search, Loader2, Pencil, Trash2, X, Check } from 'lucide-react'
import { api } from '../services/apiClient'

interface Character {
  id: string
  novel_id: string
  name: string
  name_variants: string[]
  gender: string
  role: string
  status: string
  state_summary: string
}

const GENDERS = ['Male', 'Female', 'Non-binary', 'Unknown']
const ROLES = ['Protagonist', 'Antagonist', 'Supporting', 'Minor']
const STATUSES = ['Alive', 'Dead', 'Missing', 'Unknown']

export default function CharactersPanel() {
  const { novelId } = useParams<{ novelId: string }>()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editChar, setEditChar] = useState<Character | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', gender: 'Unknown', role: 'Minor', status: 'Alive', name_variants: '' })

  const load = () => {
    if (!novelId) return
    setLoading(true)
    api.get<Character[]>(`/characters?novel_id=${novelId}`).then(data => setCharacters(data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [novelId])

  const update = async (id: string, updates: Partial<Character>) => {
    await api.put(`/characters/${id}`, updates)
    load(); setEditChar(null)
  }

  const remove = async (id: string) => { await api.delete(`/characters/${id}`); load() }

  const add = async () => {
    if (!addForm.name.trim() || !novelId) return
    const variants = addForm.name_variants.split(',').map(s => s.trim()).filter(Boolean)
    await api.post('/characters', { novel_id: novelId, ...addForm, name_variants: variants })
    setShowAdd(false)
    setAddForm({ name: '', gender: 'Unknown', role: 'Minor', status: 'Alive', name_variants: '' })
    load()
  }

  const filtered = characters.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.name_variants.some(v => v.toLowerCase().includes(search.toLowerCase()))
  )

  const EditModal = () => {
    if (!editChar) return null
    const [form, setForm] = useState({ ...editChar, name_variants_str: editChar.name_variants.join(', ') })
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditChar(null)}>
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-bold">Edit Character</h3><button onClick={() => setEditChar(null)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button></div>
          <div className="space-y-3">
            <div><label className="block text-xs text-gray-500 mb-1">Name</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Name Variants</label><input type="text" value={form.name_variants_str} onChange={e => setForm({ ...form, name_variants_str: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-xs text-gray-500 mb-1">Gender</label><select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">{GENDERS.map(g => <option key={g}>{g}</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Role</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">State Summary</label><textarea value={form.state_summary} onChange={e => setForm({ ...form, state_summary: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600 min-h-[60px]" /></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => update(editChar.id, { name: form.name, name_variants: form.name_variants_str.split(',').map(s => s.trim()).filter(Boolean), gender: form.gender, role: form.role, status: form.status, state_summary: form.state_summary })} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors"><Check size={16} /> Save</button>
            <button onClick={() => setEditChar(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  const AddModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">Add Character</h3>
        <div className="space-y-3">
          <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input type="text" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" autoFocus /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Name Variants</label><input type="text" value={addForm.name_variants} onChange={e => setAddForm({ ...addForm, name_variants: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" /></div>
          <div className="grid grid-cols-3 gap-2">
            {['Gender', 'Role', 'Status'].map(field => (
              <div key={field}><label className="block text-xs text-gray-500 mb-1">{field}</label>
                <select value={addForm[field.toLowerCase() as keyof typeof addForm] as string} onChange={e => setAddForm({ ...addForm, [field.toLowerCase()]: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">
                  {(field === 'Gender' ? GENDERS : field === 'Role' ? ROLES : STATUSES).map(o => <option key={o}>{o}</option>)}</select></div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={add} disabled={!addForm.name.trim()} className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm transition-colors">Add Character</button>
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Characters</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors"><Plus size={16} /> Add Character</button>
      </div>
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search characters..." className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-cyan-600" /></div>
      {loading ? (<div className="flex items-center justify-center py-16 text-gray-500"><Loader2 size={20} className="animate-spin mr-2" /><span className="text-sm">Loading...</span></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span>{c.name_variants.length > 0 && <span className="text-gray-500 text-sm">{c.name_variants.join(', ')}</span>}</div>
                  <div className="flex gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded ${c.gender === 'Male' ? 'bg-blue-900/50 text-blue-300' : c.gender === 'Female' ? 'bg-pink-900/50 text-pink-300' : 'bg-gray-800 text-gray-400'}`}>{c.gender}</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">{c.role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'Alive' ? 'bg-green-900/50 text-green-300' : c.status === 'Dead' ? 'bg-red-900/50 text-red-300' : 'bg-gray-800 text-gray-400'}`}>{c.status}</span>
                  </div>
                  {c.state_summary && <p className="text-xs text-gray-500 mt-1">{c.state_summary}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditChar(c)} className="p-1.5 text-gray-500 hover:text-cyan-400 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => remove(c.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && <p className="text-center text-gray-600 text-sm py-8">No characters found</p>}
        </div>
      )}
      {editChar && <EditModal />}
      {showAdd && <AddModal />}
    </div>
  )
}
