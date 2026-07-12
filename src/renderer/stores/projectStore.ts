import { create } from 'zustand'
import { api } from '../services/apiClient'

export interface Chapter {
  id: string
  novel_id: string
  number: number
  title: string
  translated: boolean
  word_count: number
  segment_count: number
}

export interface Novel {
  id: string
  title: string
  source_lang: string
  target_lang: string
  genre: string
  summary: string
  chapter_count: number
  created_at: string
  updated_at: string
}

interface ProjectState {
  novel: Novel | null
  chapters: Chapter[]
  loading: boolean
  projects: Novel[]
  fetchProjects: () => Promise<void>
  createProject: (data: { title: string; source_lang: string; target_lang: string; genre: string }) => Promise<Novel>
  loadNovel: (id: string) => Promise<void>
  fetchChapters: (novelId: string) => Promise<void>
  importChapter: (novelId: string, title: string, content: string) => Promise<Chapter>
  deleteChapter: (chapterId: string, novelId: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  novel: null,
  chapters: [],
  loading: false,
  projects: [],

  fetchProjects: async () => {
    try {
      const projects = await api.get<Novel[]>('/projects')
      set({ projects })
    } catch { /* fail silently — ProjectHome retries */ }
  },

  createProject: async (data) => {
    const novel = await api.post<Novel>('/projects', data)
    set({ novel, chapters: [] })
    const savePath = (data as any).save_dir || null
    try {
      await window.electronAPI.saveProject({
        id: novel.id, title: novel.title,
        source_lang: novel.source_lang, target_lang: novel.target_lang,
        genre: novel.genre, savePath,
      })
    } catch (e) { console.error('Failed to save .novelproj', e) }
    return novel
  },

  loadNovel: async (id) => {
    set({ loading: true })
    try {
      const [novel, chapters] = await Promise.all([
        api.get<Novel>(`/projects/${id}`),
        api.get<Chapter[]>(`/projects/${id}/chapters`),
      ])
      set({ novel, chapters, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  fetchChapters: async (novelId) => {
    try {
      const chapters = await api.get<Chapter[]>(`/projects/${novelId}/chapters`)
      set({ chapters })
    } catch { /* fail silently */ }
  },

  importChapter: async (novelId, title, content) => {
    const chapter = await api.post<Chapter>('/chapters/import', { novel_id: novelId, title, content })
    await get().fetchChapters(novelId)
    return chapter
  },

  deleteChapter: async (chapterId, novelId) => {
    await api.delete(`/chapters/${chapterId}`)
    await get().fetchChapters(novelId)
  },

  deleteProject: async (id) => {
    await api.delete(`/projects/${id}`)
    set(state => ({ projects: state.projects.filter(p => p.id !== id) }))
    if (get().novel?.id === id) set({ novel: null, chapters: [] })
  },
}))
