import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MessageSquare, CheckCircle, Clock, Loader2, RefreshCw, ChevronDown, ChevronRight, Languages } from 'lucide-react'
import { api } from '../services/apiClient'

interface QAItem {
  id: string
  segment_id: string
  question_type: string
  question: string
  context_snippet: string
  suggestions?: string[] | null
  answer: string | null
  resolved: boolean
  segment_source_text: string
  segment_translation: string
  segment_transliteration: string
}

export default function QAPanel() {
  const { novelId } = useParams<{ novelId: string }>()
  const [items, setItems] = useState<QAItem[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [retranslating, setRetranslating] = useState<string | null>(null)
  const [retranslationResults, setRetranslationResults] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [batchAnswer, setBatchAnswer] = useState<Record<string, string>>({})
  const [batchLoading, setBatchLoading] = useState<Record<string, boolean>>({})

  const load = () => {
    setLoading(true)
    const params = novelId ? `?resolved=false&novel_id=${novelId}` : '?resolved=false'
    api.get<QAItem[]>(`/questions${params}`).then(data => setItems(data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    let mounted = true
    const params = novelId ? `?resolved=false&novel_id=${novelId}` : '?resolved=false'
    api.get<QAItem[]>(`/questions${params}`).then(data => { if (mounted) setItems(data) }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [novelId])

  const submitAnswer = async (id: string, retranslate = false, overrideAnswer?: string) => {
    const answer = overrideAnswer || answers[id]?.trim()
    if (!answer) return
    if (retranslate) {
      setRetranslating(id)
      try {
        const data = await api.post<any>(`/questions/${id}/answer-and-retranslate`, { answer })
        setRetranslationResults(prev => ({ ...prev, [id]: data.retranslation || '(failed)' }))
      } catch { setRetranslationResults(prev => ({ ...prev, [id]: '(error)' })) }
      setRetranslating(null)
    } else {
      await api.post(`/questions/${id}/answer`, { answer })
    }
    setItems(prev => prev.map(i => i.id === id ? { ...i, answer, resolved: true } : i))
  }

  const dismiss = async (id: string) => { await api.post(`/questions/${id}/dismiss`); setItems(prev => prev.filter(i => i.id !== id)) }

  const batchResolve = async (type: string, answer: string) => {
    const key = type
    setBatchLoading(prev => ({ ...prev, [key]: true }))
    try {
      await api.post('/questions/batch-answer', { question_type: type, answer, novel_id: novelId })
      setItems(prev => prev.map(i => i.question_type === type && !i.resolved ? { ...i, answer, resolved: true } : i))
      setBatchAnswer(prev => ({ ...prev, [key]: '' }))
    } catch (e) { console.error('Batch resolve failed', e) }
    setBatchLoading(prev => ({ ...prev, [key]: false }))
  }

  const batchDismiss = async (type: string) => {
    await api.post('/questions/batch-dismiss', { question_type: type, novel_id: novelId })
    setItems(prev => prev.filter(i => i.question_type !== type || i.resolved))
  }

  const pending = items.filter(i => !i.resolved)
  const answered = items.filter(i => i.resolved)

  const grouped = pending.reduce((acc, item) => {
    if (!acc[item.question_type]) acc[item.question_type] = []
    acc[item.question_type].push(item)
    return acc
  }, {} as Record<string, QAItem[]>)

  const typeColors: Record<string, string> = {
    Pronoun: 'border-purple-800/50 bg-purple-900/10',
    Name: 'border-blue-800/50 bg-blue-900/10',
    Cultural: 'border-amber-800/50 bg-amber-900/10',
    Idiom: 'border-green-800/50 bg-green-900/10',
  }

  const typeBadgeColors: Record<string, string> = {
    Pronoun: 'bg-purple-900/50 text-purple-300',
    Name: 'bg-blue-900/50 text-blue-300',
    Cultural: 'bg-amber-900/50 text-amber-300',
    Idiom: 'bg-green-900/50 text-green-300',
  }

  const defaultAnswers: Record<string, string> = {
    Cultural: 'Keep as pinyin',
    Idiom: 'Translate meaning literally',
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">QA Queue</h2>
        <span className="text-sm text-gray-500">{pending.length} pending</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 size={20} className="animate-spin mr-2" /><span className="text-sm">Loading...</span></div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, typeItems]) => (
            <div key={type} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <button onClick={() => setCollapsed(prev => ({ ...prev, [type]: !prev[type] }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-850 hover:bg-gray-800 transition-colors">
                <div className="flex items-center gap-2">
                  {collapsed[type] ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                  <span className={`px-2 py-0.5 text-xs rounded ${typeBadgeColors[type] || 'bg-gray-800 text-gray-400'}`}>{type}</span>
                  <span className="text-sm text-gray-400">{typeItems.length} item{typeItems.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {type === 'Cultural' && (
                    <button onClick={() => batchResolve(type, 'Keep as pinyin')} disabled={batchLoading[type]}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-700/50 hover:bg-amber-700 text-amber-200 rounded text-xs transition-colors disabled:opacity-50">
                      {batchLoading[type] ? <Loader2 size={10} className="animate-spin" /> : <Languages size={10} />}
                      Accept all as pinyin
                    </button>
                  )}
                  {type === 'Idiom' && (
                    <button onClick={() => batchResolve(type, 'Translate meaning literally')} disabled={batchLoading[type]}
                      className="flex items-center gap-1 px-2 py-1 bg-green-700/50 hover:bg-green-700 text-green-200 rounded text-xs transition-colors disabled:opacity-50">
                      {batchLoading[type] ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                      Resolve all
                    </button>
                  )}
                  {(type === 'Name' || type === 'Pronoun') && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input type="text" placeholder={`Answer for all ${type}...`} value={batchAnswer[type] || ''}
                        onChange={e => setBatchAnswer(prev => ({ ...prev, [type]: e.target.value }))}
                        className="w-40 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-600" />
                      <button onClick={() => { const a = batchAnswer[type]?.trim(); if (a) batchResolve(type, a) }} disabled={batchLoading[type] || !batchAnswer[type]?.trim()}
                        className="flex items-center gap-1 px-2 py-1 bg-cyan-700/50 hover:bg-cyan-700 text-cyan-200 rounded text-xs transition-colors disabled:opacity-50">
                        {batchLoading[type] ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                        Apply
                      </button>
                    </div>
                  )}
                  <button onClick={() => batchDismiss(type)}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors">
                    Dismiss all
                  </button>
                </div>
              </button>
              {!collapsed[type] && (
                <div className="divide-y divide-gray-800">
                  {typeItems.map(item => (
                    <div key={item.id} className="p-4 hover:bg-gray-850 transition-colors">
                      <div className="flex items-start gap-3">
                        <Clock size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500">segment: {item.segment_id.slice(0, 8)}</span>
                          </div>
                          <p className="text-sm mb-2">{item.question}</p>

                          {item.segment_source_text && (
                            <div className="mb-3 bg-gray-800 rounded p-2.5 space-y-1">
                              <p className="text-xs text-gray-500">
                                <span className="font-medium">Source:</span> <span className="text-gray-300">{item.segment_source_text}</span>
                              </p>
                              {item.segment_transliteration && (
                                <p className="text-xs text-gray-500">
                                  <span className="font-medium">Transliterated:</span> <span className="text-gray-400 italic">{item.segment_transliteration}</span>
                                </p>
                              )}
                              {item.segment_translation && (
                                <p className="text-xs text-gray-500">
                                  <span className="font-medium">Absolute:</span> <span className="text-gray-400 italic">{item.segment_translation}</span>
                                </p>
                              )}
                            </div>
                          )}

                          {item.context_snippet && (
                            <p className="text-xs text-gray-500 mb-3 italic bg-gray-800/50 p-2 rounded">"{item.context_snippet}"</p>
                          )}
                          {(item.suggestions?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {(item.suggestions || []).map((s, i) => (
                                <button key={i} onClick={() => { setAnswers(prev => ({ ...prev, [item.id]: s })); submitAnswer(item.id, true, s) }}
                                  className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors">{s}</button>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input type="text" placeholder="Your answer..." value={answers[item.id] || ''}
                              onChange={e => setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && submitAnswer(item.id, true)}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-600" />
                            <button onClick={() => submitAnswer(item.id)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors" title="Save answer only">Save</button>
                            <button onClick={() => submitAnswer(item.id, true)} disabled={retranslating === item.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-sm transition-colors">
                              {retranslating === item.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                              Answer & Re-translate
                            </button>
                            <button onClick={() => dismiss(item.id)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors">Skip</button>
                          </div>
                          {retranslationResults[item.id] && (
                            <div className="mt-3 p-2 bg-gray-800 rounded"><p className="text-xs text-gray-400 mb-1">Re-translated:</p><p className="text-sm text-green-400">{retranslationResults[item.id]}</p></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {answered.length > 0 && (
            <><h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-4 pb-2">Answered</h3>
              {answered.map(item => (
                <div key={item.id} className="p-4 bg-gray-900 rounded-lg border border-gray-800 opacity-60">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">{item.question_type}</span></div>
                      <p className="text-sm mb-1">{item.question}</p>
                      {item.segment_source_text && <p className="text-xs text-gray-500 italic mb-1">"{item.segment_source_text}"</p>}
                      <p className="text-sm text-green-400">→ {item.answer}</p>
                      {retranslationResults[item.id] && <p className="text-sm text-cyan-400 mt-1">Re: {retranslationResults[item.id]}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {items.length === 0 && (<div className="text-center py-12 text-gray-500"><MessageSquare size={32} className="mx-auto mb-2 opacity-50" /><p className="text-sm">No questions yet</p></div>)}
        </div>
      )}
    </div>
  )
}
