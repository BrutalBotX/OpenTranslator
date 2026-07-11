import { create } from 'zustand'
import { api } from '../services/apiClient'

export interface Segment {
  id: string
  chapter_id: string
  segment_number: number
  source_text: string
  translation: string
  status: 'untouched' | 'translating' | 'translated' | 'needs_review'
  has_qa: boolean
  transliteration?: string
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
  viewMode: ViewMode
  translatingChapter: boolean
  chapterProgress: { current: number; total: number } | null
  chapterResult: ChapterTranslationResult | null
  showCompletionPopup: boolean
  translateError: string | null
  llmStatus: string
  setActiveChapter: (id: string | null) => void
  loadSegments: (chapterId: string) => Promise<void>
  setActiveSegment: (id: string | null) => void
  updateSegment: (id: string, updates: Partial<Segment>) => void
  setSegments: (segments: Segment[]) => void
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

  loadSegments: async (chapterId) => {
    set({ loading: true })
    try {
      const data = await api.get<Segment[]>(`/chapters/${chapterId}/segments`)
      set({ segments: data, loading: false })
      if (data.length > 0 && !get().activeSegmentId) {
        set({ activeSegmentId: data[0].id })
      }
    } catch (e) {
      console.error('Failed to load segments', e)
      set({ loading: false })
    }
  },

  setActiveSegment: (id) => set({ activeSegmentId: id }),

  updateSegment: (id, updates) =>
    set(state => ({
      segments: state.segments.map(s => (s.id === id ? { ...s, ...updates } : s))
    })),

  setSegments: (segments) => set({ segments }),

  setTranslatingId: (id) => set({ translatingId: id }),

  setViewMode: (mode) => set({ viewMode: mode }),

  translateChapter: async (chapterId, novelId) => {
    set({ translatingChapter: true, chapterProgress: { current: 0, total: 0 }, showCompletionPopup: false, translateError: null, llmStatus: '' })
    try {
      const result = await api.post<ChapterTranslationResult>(`/chapters/${chapterId}/translate-all`, { novel_id: novelId })
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
      console.error('Chapter translate failed', e)
      const msg = e?.message || String(e)
      set({ translatingChapter: false, chapterProgress: null, translateError: msg, llmStatus: 'error' })
    }
  },

  cancelTranslation: async (chapterId) => {
    try {
      await api.post(`/chapters/${chapterId}/cancel-translation`)
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

  clear: () => set({
    activeChapterId: null, segments: [], activeSegmentId: null,
    loading: false, translatingId: null, viewMode: 'translate',
    translatingChapter: false, chapterProgress: null, chapterResult: null,
    showCompletionPopup: false,
  }),
}))
