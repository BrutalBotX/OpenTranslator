import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Upload, Languages, Loader2, AlertTriangle, Square, Download, Eye } from 'lucide-react'
import EditorPane from '../components/EditorPane'
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

  const { setActivity, setProgress } = useStatusStore()
  const [importing, setImporting] = useState(false)
  const [showContext, setShowContext] = useState(true)
  const [acceptedId, setAcceptedId] = useState<string | null>(null)

  useEffect(() => {
    if (novelId && (!novel || novel.id !== novelId)) loadNovel(novelId)
  }, [novelId])

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
    await api.post(`/chapters/${chapterId}/check-status`)
    if (novelId) await fetchChapters(novelId)
  }

  const handleImport = async () => {
    if (!novelId) return
    try {
      const result = await window.electronAPI.importChapter()
      if (result) {
        setImporting(true)
        setActivity('Importing chapter...')
        await importChapter(novelId, result.name, result.content)
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

  const handleExport = async (format: string) => {
    if (!novelId) return
    try {
      const data = await api.post<{ content: string; filename?: string }>('/export', { novel_id: novelId, format })
      const blob = new Blob([data.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename || `export.${format === 'html' ? 'html' : 'txt'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error('Export failed', e) }
  }

  const handleAccept = async (segmentId: string) => {
    const seg = segments.find(s => s.id === segmentId)
    if (!seg) return
    setActivity('Saving...')
    try {
      await api.put(`/segments/${segmentId}`, { translation: seg.translation, status: 'translated', novel_id: novelId })
      updateSegment(segmentId, { status: 'translated' })
      setAcceptedId(segmentId)
      setTimeout(() => setAcceptedId(null), 2000)
    } catch (e) { console.error('Save failed', e) }
    setActivity(null)
  }

  const handleEdit = (segmentId: string, translation: string) => {
    updateSegment(segmentId, { translation, status: 'needs_review' })
  }

  // Poll segments and progress during chapter translation
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (translatingChapter && activeChapterId) {
      pollRef.current = setInterval(async () => {
        try {
          const [segData, progData] = await Promise.allSettled([
            api.get<Segment[]>(`/chapters/${activeChapterId}/segments`),
            api.get<any>(`/chapters/${activeChapterId}/translate-progress`),
          ])
          if (segData.status === 'fulfilled') {
            const data = segData.value
            const done = data.filter(s => s.translation).length
            setProgress({ current: done, total: data.length })
            setSegments(data)
          }
          if (progData.status === 'fulfilled') {
            setTranslateProgress(progData.value)
          }
        } catch {}
      }, 2000)
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [translatingChapter, activeChapterId])

  const activeSeg = segments.find(s => s.id === activeSegmentId)
  const hasSegments = segments.length > 0
  const hasTranslations = segments.some(s => s.translation)

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
        novelId={novelId}
      />

      <div className="flex-1 flex flex-col">
        <ContextBar showContext={showContext} onToggleContext={() => setShowContext(!showContext)} />

        {hasSegments && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
            <button onClick={handleImport} disabled={importing}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded text-xs transition-colors">
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Import
            </button>
            <button onClick={handleTranslateChapter} disabled={translatingChapter}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-xs transition-colors">
              {translatingChapter ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
              {translatingChapter ? 'Translating...' : 'Translate'}
            </button>
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={handleToggleMode}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
                viewMode === 'review' ? 'bg-cyan-600/20 text-cyan-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              <Eye size={12} />
              {viewMode === 'review' ? 'Review' : 'Translate View'}
            </button>
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={() => handleExport('plaintext')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors">
              <Download size={12} /> TXT
            </button>
            <button onClick={() => handleExport('html')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors">
              <Download size={12} /> HTML
            </button>
            {acceptedId && (
              <span className="text-xs text-green-400 ml-auto">Saved!</span>
            )}
          </div>
        )}

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
                  {segments.length > 0 && (
                    <span className="text-cyan-400/70 ml-2">
                      ({segments.filter(s => s.translation).length}/{segments.length} segments)
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
            <div className="flex-1 p-6 overflow-y-auto bg-gray-950 flex flex-col items-center justify-center">
              <div className="text-center max-w-lg">
                <Languages size={40} className="mx-auto mb-4 text-cyan-500" />
                <h3 className="text-lg font-medium text-gray-200 mb-2">Ready to Translate</h3>
                <p className="text-sm text-gray-500 mb-2">
                  This chapter has <strong className="text-gray-300">{segments.length} segments</strong>.
                </p>
                <p className="text-xs text-gray-600 mb-6">
                  The AI will translate each segment with context from surrounding paragraphs,
                  characters, glossary terms, and plot arcs to maintain consistency.
                </p>
                <button onClick={handleTranslateChapter} disabled={translatingChapter}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
                  {translatingChapter ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
                  {translatingChapter ? 'Translating...' : 'Translate Chapter'}
                </button>
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
    </div>
  )
}
