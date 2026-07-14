import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Upload, Languages, Loader2, AlertTriangle, Square, Download, Eye, RefreshCw, CheckCheck, X, AlertCircle, Save } from 'lucide-react'
import ChapterReviewPane from '../components/ChapterReviewPane'
import ContextBar from '../components/ContextBar'
import ChapterNav from '../components/ChapterNav'
import ContextPanel from '../components/ContextPanel'
import TranslationCompletePopup from '../components/TranslationCompletePopup'
import { useProjectStore } from '../stores/projectStore'
import { useTranslationStore } from '../stores/translationStore'
import { useStatusStore } from '../stores/statusStore'
import { api } from '../services/apiClient'

export default function TranslateView() {
  const { novelId } = useParams<{ novelId: string }>()
  const { novel, chapters, loadNovel, fetchChapters, importChapter } = useProjectStore()

  const {
    activeChapterId, segments, activeSegmentId, loading,
    translatingId, viewMode, translatingChapter, showCompletionPopup, chapterResult,
    translateError, llmStatus,
    setActiveChapter, loadSegments, setActiveSegment, updateSegment, setSegments,
    setTranslatingId, setViewMode, translateChapter, cancelTranslation, dismissCompletion, setTranslateProgress,
  } = useTranslationStore()

  const { deleteChapter } = useProjectStore()
  const { setActivity, setProgress } = useStatusStore()
  const [importing, setImporting] = useState(false)
  const [showContext, setShowContext] = useState(true)
  const [acceptedId, setAcceptedId] = useState<string | null>(null)
  const [ccIssues, setCcIssues] = useState<any[] | null>(null)
  const [ccError, setCcError] = useState(false)
  const [ccLoading, setCcLoading] = useState(false)
  const [exportOpts, setExportOpts] = useState<{ format: string; include_source: boolean; show_numbers: boolean } | null>(null)
  const [expSettings, setExpSettings] = useState({ include_source: false, show_numbers: false })

  const novelIdRef = useRef(novelId)
  useEffect(() => {
    if (novelId && novelId !== novelIdRef.current) {
      novelIdRef.current = novelId
      loadNovel(novelId)
      useTranslationStore.getState().clear()
    }
  }, [novelId, loadNovel])

  // Auto-select chapter when only 1 exists
  useEffect(() => {
    if (chapters.length === 1 && !activeChapterId) {
      handleSelectChapter(chapters[0].id)
    }
  }, [chapters, activeChapterId])

  const handleSelectChapter = useCallback((chapterId: string) => {
    setActiveChapter(chapterId)
    loadSegments(chapterId)
    setViewMode('translate')
  }, [])

  const checkStatus = async (chapterId: string) => {
    try {
      await api.post(`/chapters/${chapterId}/check-status`)
    } catch (e) { console.warn('checkStatus failed', e) }
    if (novelId) await fetchChapters(novelId).catch(e => console.warn('fetchChapters failed', e))
  }

  const handleImport = async () => {
    if (!novelId) return
    try {
      const result = await window.electronAPI.importChapter()
      if (result) {
        setImporting(true)
        setActivity('Importing chapter...')
        await importChapter(novelId, '', result.content)
        setImporting(false)
        setActivity(null)
      }
    } catch (e) { console.error('Import failed', e); setImporting(false); setActivity(null) }
  }

  const handleTranslateChapter = async () => {
    if (!activeChapterId || !novelId) return
    setActivity('Translating chapter...')
    await translateChapter(activeChapterId, novelId)
    setActivity(null)
    await checkStatus(activeChapterId)
    if (novelId) await fetchChapters(novelId)
  }

  const handleReapply = async () => {
    if (!activeChapterId || !novelId) return
    if (translatingChapter) return
    setActivity('Reapplying with updated context...')
    useTranslationStore.setState({ translatingChapter: true, translateError: null })
    try {
      await api.post(`/chapters/${activeChapterId}/reapply`, { novel_id: novelId })
      await loadSegments(activeChapterId)
    } catch (e: any) {
      useTranslationStore.setState({ translateError: e?.message || 'Reapply failed', translatingChapter: false })
    }
    useTranslationStore.setState({ translatingChapter: false })
    setActivity(null)
  }

  const handleExport = async (format: string, opts?: { include_source?: boolean; show_numbers?: boolean }) => {
    if (!novelId) return
    try {
      const body: any = { novel_id: novelId, format, ...opts }
      const data = await api.post<{ content: string; filename?: string }>('/export', body)
      const mimeTypes: Record<string, string> = { plaintext: 'text/plain', html: 'text/html', epub: 'application/epub+zip' }
      const mime = mimeTypes[format] || 'text/plain'
      if (!data.content) throw new Error('No content returned from export')
      let content: string | Uint8Array = data.content
      let ext = format === 'html' ? 'html' : format === 'epub' ? 'epub' : 'txt'
      if (format === 'epub') {
        const binary = atob(data.content)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        content = bytes
      }
      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `export.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) { console.error('Export failed', e); setActivity('Export failed — check console') }
  }

  const handleSaveProject = async () => {
    if (!novelId) return
    setActivity('Saving project...')
    try {
      await window.electronAPI.saveProject({ id: novelId })
    } catch (e) { console.error('Save failed', e) }
    setActivity(null)
  }

  const handleConsistencyCheck = async () => {
    if (!novelId) return
    setCcLoading(true)
    try {
      const data = await api.get<{ issues: any[] }>(`/projects/${novelId}/consistency-check`)
      setCcIssues(Array.isArray(data?.issues) ? data.issues : [])
      setCcError(false)
    } catch (e) { console.warn('Consistency check failed', e); setCcIssues([]); setCcError(true) }
    setCcLoading(false)
  }

  const handleAccept = async (segmentId: string, editedTranslation?: string) => {
    const currentSegs = Array.isArray(segments) ? segments : []
    const seg = currentSegs.find(s => s.id === segmentId)
    if (!seg) return
    const translation = editedTranslation !== undefined ? editedTranslation : seg.translation
    setActivity('Saving...')
    try {
      await api.put(`/segments/${segmentId}`, { translation, status: 'translated', novel_id: novelId })
      updateSegment(segmentId, { translation, status: 'translated' })
      setAcceptedId(segmentId)
      setTimeout(() => setAcceptedId(null), 2000)
    } catch (e) { console.error('Save failed', e) }
    setActivity(null)
  }

  const handleEdit = (segmentId: string, translation: string) => {
    updateSegment(segmentId, { translation, status: 'needs_review' })
  }

  // Restore polling on mount if translation was in progress while navigating away
  useEffect(() => {
    if (useTranslationStore.getState().translatingChapter && activeChapterId) {
      const restore = async () => {
        const [segData, progData] = await Promise.allSettled([
          api.get<Segment[]>(`/chapters/${activeChapterId}/segments`),
          api.get<any>(`/chapters/${activeChapterId}/translate-progress`),
        ])
        if (segData.status === 'fulfilled') {
          setProgress({ current: segData.value.filter((s: any) => s.translation).length, total: segData.value.length })
          setSegments(segData.value)
        }
        if (progData.status === 'fulfilled') setTranslateProgress(progData.value)
      }
      restore()
    }
  }, [])

  // Poll segments and progress during chapter translation
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false } }, [])
  useEffect(() => {
    if (translatingChapter && activeChapterId) {
      const chapterId = activeChapterId
      pollRef.current = setInterval(async () => {
        if (!isMountedRef.current || !useTranslationStore.getState().translatingChapter) return
        try {
          const [segData, progData] = await Promise.allSettled([
            api.get<Segment[]>(`/chapters/${chapterId}/segments`),
            api.get<any>(`/chapters/${chapterId}/translate-progress`),
          ])
          if (!isMountedRef.current || !useTranslationStore.getState().translatingChapter) return
          if (segData.status === 'fulfilled') {
            const data = segData.value
            const done = data.filter(s => s.translation).length
            const currentActiveId = useTranslationStore.getState().activeSegmentId
            setProgress({ current: done, total: data.length })
            setSegments(prev => {
              const merged = [...data]
              for (let i = 0; i < merged.length; i++) {
                const existing = prev.find(s => s.id === merged[i].id)
                if (existing && existing.id === currentActiveId && existing.translation !== merged[i].translation) {
                  merged[i] = { ...merged[i], translation: existing.translation }
                }
              }
              return merged
            })
          }
          if (progData.status === 'fulfilled') {
            setTranslateProgress(progData.value)
            const prog = progData.value
            if ((prog.status === 'done' && prog.total_batches > 0 && !prog._saved) || prog.trigger_backup) {
              if (novelId && !prog._saved) {
                prog._saved = true
                window.electronAPI.saveProject({ id: novelId }).catch(() => {})
              }
            }
          }
        } catch {}
      }, 2000)
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [translatingChapter, activeChapterId])

  // Keyboard shortcuts — use refs to avoid stale closures and unnecessary listener churn
  const handleAcceptRef = useRef(handleAccept)
  handleAcceptRef.current = handleAccept
  const translatingRef = useRef(translatingChapter)
  translatingRef.current = translatingChapter
  const activeChapterRef = useRef(activeChapterId)
  activeChapterRef.current = activeChapterId
  const novelRef = useRef(novelId)
  novelRef.current = novelId
  const handleTranslateRef = useRef(handleTranslateChapter)
  handleTranslateRef.current = handleTranslateChapter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (e.key === 'Escape' && !isInput) {
        useTranslationStore.getState().setActiveSegment(null)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isInput && !translatingRef.current) {
        e.preventDefault()
        const cId = activeChapterRef.current
        const nId = novelRef.current
        if (cId && nId) handleTranslateRef.current()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        const state = useTranslationStore.getState()
        const aId = state.activeSegmentId
        if (aId) {
          const seg = state.segments.find(s => s.id === aId)
          if (seg) handleAcceptRef.current(aId)
        }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const segs = Array.isArray(segments) ? segments : []
  const activeSeg = segs.find(s => s.id === activeSegmentId)
  const hasSegments = segs.length > 0
  const hasTranslations = segs.some(s => s.translation)

  const handleToggleMode = () => {
    const newMode = viewMode === 'translate' ? 'review' : 'translate'
    setViewMode(newMode)
    if (newMode === 'review' && !hasTranslations && activeChapterId) {
      loadSegments(activeChapterId)
    }
  }

  return (
    <div className="flex h-full">
      <ChapterNav
        chapters={chapters}
        activeChapter={activeChapterId}
        onSelectChapter={handleSelectChapter}
        onDeleteChapter={async (id) => {
          if (!novelId) return
          await deleteChapter(id, novelId)
          if (id === activeChapterId) {
            setActiveChapter(null)
            setSegments([])
            dismissCompletion()
            setViewMode('translate')
          }
        }}
        novelId={novelId}
        onReorder={async (ids) => {
          if (!novelId) return
          try {
            await api.post(`/projects/${novelId}/reorder-chapters`, { chapter_ids: ids })
            await fetchChapters(novelId)
          } catch {}
        }}
      />

      <div className="flex-1 flex flex-col">
        <ContextBar showContext={showContext} onToggleContext={() => setShowContext(!showContext)} />

        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
          <button onClick={handleImport} disabled={importing}
            title="Import a chapter file (.txt)"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded text-xs transition-colors">
            {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Import
          </button>
          {hasSegments && (<>
            <button onClick={handleTranslateChapter} disabled={translatingChapter}
              title="Translate all segments in this chapter (Ctrl+Enter)"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-xs transition-colors">
              {translatingChapter ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
              {translatingChapter ? 'Translating...' : 'Translate'}
            </button>
            <button onClick={handleReapply} disabled={translatingChapter}
              title="Clear all translations and re-translate with updated context"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 rounded text-xs transition-colors">
              {translatingChapter ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Apply
            </button>
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={handleToggleMode}
              title={viewMode === 'review' ? 'View translate mode' : 'Review and edit translations'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
                viewMode === 'review' ? 'bg-cyan-600/20 text-cyan-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              <Eye size={12} />
              {viewMode === 'review' ? 'Review' : 'Translate View'}
            </button>
            <div className="w-px h-4 bg-gray-700" />
            <div className="relative group">
              <button title={translatingChapter ? 'Cannot export during translation' : 'Export translated chapter (TXT, HTML, EPUB)'}
                disabled={translatingChapter}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${translatingChapter ? 'bg-gray-900 text-gray-700 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}>
                <Download size={12} /> Export ▾
              </button>
              <div className={`absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 ${translatingChapter ? 'hidden' : 'hidden group-hover:block'}`}>
                <div className="p-2 space-y-1">
                  <p className="text-[10px] text-gray-500 px-2 pt-1">Options</p>
                  <label className="flex items-center gap-2 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
                    <input type="checkbox" checked={expSettings.include_source} onChange={e => setExpSettings(prev => ({ ...prev, include_source: e.target.checked }))} />
                    Include source text
                  </label>
                  <label className="flex items-center gap-2 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
                    <input type="checkbox" checked={expSettings.show_numbers} onChange={e => setExpSettings(prev => ({ ...prev, show_numbers: e.target.checked }))} />
                    Show segment numbers
                  </label>
                  <div className="border-t border-gray-700 my-1" />
                  <button onClick={() => handleExport('plaintext', expSettings)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors">TXT</button>
                  <button onClick={() => handleExport('html', expSettings)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors">HTML</button>
                  <button onClick={() => handleExport('epub', expSettings)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700 rounded transition-colors">EPUB</button>
                </div>
              </div>
            </div>
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={handleSaveProject}
              title="Save project file (.novelproj)"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors">
              <Save size={12} /> Save
            </button>
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={handleConsistencyCheck} disabled={ccLoading}
              title="Check for glossary term inconsistencies across all chapters"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors">
              {ccLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Check
            </button>
            {acceptedId && (
              <span className="text-xs text-green-400 ml-auto">Saved!</span>
            )}
          </>)}
        </div>

        {translatingChapter && (
          <div className={`px-4 py-2 border-b flex items-center gap-2 ${
            translateError ? 'bg-red-900/20 border-red-800' : 'bg-cyan-900/20 border-cyan-800'
          }`}>
            {translateError ? (
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
            ) : llmStatus === 'cancelled' ? null : (
              <Loader2 size={14} className="animate-spin text-cyan-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {translateError ? (
                <span className="text-sm text-red-300">Error: {translateError}</span>
              ) : llmStatus === 'cancelled' ? (
                <span className="text-sm text-yellow-300">Translation cancelled</span>
              ) : (
                <span className="text-sm text-cyan-300">
                  {llmStatus || 'Translating...'}
                  {segs.length > 0 && (
                    <span className="text-cyan-400/70 ml-2">
                      ({segs.filter(s => s.translation).length}/{segs.length} segments)
                    </span>
                  )}
                </span>
              )}
            </div>
            {!translateError && llmStatus !== 'cancelled' && (
              <button onClick={() => activeChapterId && cancelTranslation(activeChapterId)}
                className="flex items-center gap-1 px-2 py-1 bg-red-800/50 hover:bg-red-800 rounded text-xs text-red-200 transition-colors">
                <Square size={10} /> Stop
              </button>
            )}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {!hasSegments ? (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <Upload size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a chapter or import one to begin</p>
              </div>
            </div>
          ) : viewMode === 'review' ? (
            <ChapterReviewPane
              segments={segments}
              activeSegmentId={activeSegmentId}
              onSelectSegment={setActiveSegment}
              onEdit={handleEdit}
              onAccept={handleAccept}
              chapterId={activeChapterId}
              novelId={novelId}
            />
          ) : (
            <div className="flex-1 flex flex-col bg-gray-950">
              <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                {segs.map(seg => (
                  <div key={seg.id} className="p-4 hover:bg-gray-900/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <span className="text-xs text-gray-600 font-mono mt-0.5 w-8 shrink-0 text-right">#{seg.segment_number}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 leading-relaxed">{seg.source_text}</p>
                        {seg.transliteration && (
                          <p className="text-xs text-gray-600 italic mt-1 flex items-center gap-1">
                            <Languages size={10} /> {seg.transliteration}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ContextPanel chapterId={activeChapterId} novelId={novelId || null} open={showContext} onClose={() => setShowContext(false)} />
        </div>
      </div>

      {showCompletionPopup && chapterResult && (
        <TranslationCompletePopup
          result={chapterResult}
          onGoToReview={() => { setViewMode('review'); dismissCompletion() }}
          onDismiss={dismissCompletion}
        />
      )}

      {ccIssues !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setCcIssues(null); setCcError(false) }}>
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg max-h-[70vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold flex items-center gap-2"><CheckCheck size={16} className="text-cyan-400" /> Consistency Check</h3>
              <button onClick={() => { setCcIssues(null); setCcError(false) }} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {ccError ? (
                <p className="text-sm text-red-400 text-center py-8">Check failed — could not reach backend.</p>
              ) : ccIssues.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No issues found. All terms appear consistent.</p>
              ) : (
                ccIssues.map((issue, i) => (
                  <div key={i} className="text-xs bg-gray-800 rounded p-2.5 border border-yellow-800/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertCircle size={12} className="text-yellow-400 shrink-0" />
                      <span className="text-yellow-300 font-medium">{issue.term}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-cyan-300">{issue.expected}</span>
                    </div>
                    <p className="text-gray-500">{issue.detail}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-800">
              <button onClick={() => { setCcIssues(null); setCcError(false) }} className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
