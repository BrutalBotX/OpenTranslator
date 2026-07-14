import { create } from 'zustand'
import { api } from '../services/apiClient'

const _activeControllers = new Map<string, AbortController>()

export interface Segment {
  id: string
  chapter_id: string
  segment_number: number
  source_text: string
  translation: string
  status: 'untouched' | 'translating' | 'translated' | 'needs_review'
  has_qa: boolean
  transliteration?: string
  quality?: number
}

export type ViewMode = 'translate' | 'review'

export interface ChapterTranslationResult {
  segments: Segment[]
  total: number
  chapter_title: string
  chapter_number: number
  qa_count?: number
}

export interface TranslateProgress {
  status: string
  current_batch: number
  total_batches: number
  llm_status: string
  error: string
  elapsed: number
}

interface TranslationState {
  activeChapterId: string | null
  segments: Segment[]
  activeSegmentId: string | null
  loading: boolean
  translatingId: string | null
  _loadSegmentsReqId: number
  viewMode: ViewMode
  translatingChapter: boolean
  chapterProgress: { current: number; total: number } | null
  chapterResult: ChapterTranslationResult | null
  showCompletionPopup: boolean
  translateError: string | null
  llmStatus: string
  _abortController: AbortController | null
  setActiveChapter: (id: string | null) => void
  loadSegments: (chapterId: string) => Promise<void>
  setActiveSegment: (id: string | null) => void
  updateSegment: (id: string, updates: Partial<Segment>) => void
  setSegments: (segments: Segment[] | ((prev: Segment[]) => Segment[])) => void
  setTranslatingId: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  translateChapter: (chapterId: string, novelId: string) => Promise<void>
  cancelTranslation: (chapterId: string) => Promise<void>
  dismissCompletion: () => void
  clear: () => void
  setTranslateProgress: (progress: TranslateProgress) => void
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  activeChapterId: null,
  segments: [],
  activeSegmentId: null,
  loading: false,
  translatingId: null,
  viewMode: 'translate',
  translatingChapter: false,
  chapterProgress: null,
  chapterResult: null,
  showCompletionPopup: false,
  translateError: null,
  llmStatus: '',

  setActiveChapter: (id) => set({ activeChapterId: id }),

  _loadSegmentsReqId: 0,

  loadSegments: async (chapterId) => {
    const reqId = ++get()._loadSegmentsReqId
    // Abort any existing request for this same chapter
    const prevKey = `loadSeg_${chapterId}`
    const prevCtrl = _activeControllers.get(prevKey)
    if (prevCtrl) { prevCtrl.abort(); _activeControllers.delete(prevKey) }

    const controller = new AbortController()
    _activeControllers.set(prevKey, controller)
    set({ loading: true })
    try {
      const data = await api.get<Segment[]>(`/chapters/${chapterId}/segments`, controller.signal)
      _activeControllers.delete(prevKey)
      // Discard stale responses from older requests
      if (reqId !== get()._loadSegmentsReqId) return
      set({ segments: data, loading: false })
      if (data.length > 0 && !get().activeSegmentId) {
        set({ activeSegmentId: data[0].id })
      }
    } catch (e: any) {
      _activeControllers.delete(prevKey)
      if (e?.message === 'The operation was aborted') return
      console.error('Failed to load segments', e)
      set({ loading: false })
    }
  },

  setActiveSegment: (id) => set({ activeSegmentId: id }),

  updateSegment: (id, updates) =>
    set(state => ({
      segments: state.segments.map(s => (s.id === id ? { ...s, ...updates } : s))
    })),

  setSegments: (segments) => {
    if (typeof segments === 'function') {
      set({ segments: segments(get().segments) })
    } else {
      set({ segments })
    }
  },

  setTranslatingId: (id) => set({ translatingId: id }),

  setViewMode: (mode) => set({ viewMode: mode }),

  translateChapter: async (chapterId, novelId) => {
    const startTime = Date.now()
    const controller = new AbortController()
    _activeControllers.set(chapterId, controller)
    set({ translatingChapter: true, chapterProgress: { current: 0, total: 0 }, showCompletionPopup: false, translateError: null, llmStatus: 'initializing...' })
    try {
      const result = await api.post<ChapterTranslationResult>(`/chapters/${chapterId}/translate-all`, { novel_id: novelId }, controller.signal)
      _activeControllers.delete(chapterId)
      if (!result || !Array.isArray(result.segments)) {
        throw new Error(result?.error || 'Translation returned invalid data')
      }
      const translatedCount = result.segments.filter(s => s.translation).length
      if (translatedCount === 0) {
        throw new Error('Translation returned 0 segments — check provider settings or LLM response format')
      }
      const elapsed = Date.now() - startTime
      const minDuration = 800
      if (elapsed < minDuration) {
        await new Promise(r => setTimeout(r, minDuration - elapsed))
      }
      set({
        segments: result.segments,
        translatingChapter: false,
        chapterProgress: null,
        chapterResult: result,
        showCompletionPopup: true,
        viewMode: 'review',
        translateError: null,
        llmStatus: '',
      })
    } catch (e: any) {
      _activeControllers.delete(chapterId)
      console.error('Chapter translate failed', e)
      const msg = e?.message || String(e)
      set({ translatingChapter: false, chapterProgress: null, translateError: msg, llmStatus: 'error' })
    }
  },

  cancelTranslation: async (chapterId) => {
    try {
      await api.post(`/chapters/${chapterId}/cancel-translation`)
      _activeControllers.delete(chapterId)
      set({ translatingChapter: false, chapterProgress: null, llmStatus: 'cancelled', translateError: null })
    } catch (e) {
      console.error('Cancel failed', e)
    }
  },

  setTranslateProgress: (progress) => {
    set({
      llmStatus: progress.llm_status || progress.status,
      translateError: progress.error || null,
    })
  },

  dismissCompletion: () => set({ showCompletionPopup: false, chapterResult: null }),

  clear: () => {
    _activeControllers.forEach(c => c.abort())
    _activeControllers.clear()
    return set({
      activeChapterId: null, segments: [], activeSegmentId: null,
      loading: false, translatingId: null, viewMode: 'translate',
      translatingChapter: false, chapterProgress: null, chapterResult: null,
      showCompletionPopup: false,
    })
  },
}))
