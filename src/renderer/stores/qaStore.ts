import { create } from 'zustand'

export interface QAItem {
  id: string
  segmentId: string
  questionType: 'Pronoun' | 'Gender' | 'Name' | 'Idiom' | 'Cultural' | 'Term' | 'Plot'
  question: string
  contextSnippet: string
  suggestions: string[]
  answer: string | null
  resolved: boolean
}

interface QAState {
  items: QAItem[]
  setItems: (items: QAItem[]) => void
  addItem: (item: QAItem) => void
  resolveItem: (id: string, answer: string) => void
  dismissItem: (id: string) => void
}

export const useQAStore = create<QAState>(set => ({
  items: [],
  setItems: items => set({ items }),
  addItem: item => set(state => ({ items: [...state.items, item] })),
  resolveItem: (id, answer) =>
    set(state => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, answer, resolved: true } : item
      )
    })),
  dismissItem: id =>
    set(state => ({
      items: state.items.filter(item => item.id !== id)
    }))
}))
