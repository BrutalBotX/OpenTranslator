import { create } from 'zustand'
import { api } from '../services/apiClient'
import { useStatusStore } from './statusStore'

export interface MetaField {
  label: string
  type: string
  options?: string[]
  labels?: Record<string, string>
}

export interface SettingsState {
  values: Record<string, string>
  meta: Record<string, MetaField>
  loaded: boolean
  error: string | null
  requiresKey: Record<string, string | boolean>
  pricing: Record<string, string>
  availableModels: { id: string; name: string }[]
  modelsLoading: boolean
  modelsError: string | null
  load: () => Promise<void>
  save: (values: Record<string, string>) => Promise<void>
  setValue: (key: string, value: string) => void
  fetchModels: (provider: string, baseUrl?: string, apiKey?: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  values: {},
  meta: {},
  loaded: false,
  error: null,
  requiresKey: {},
  pricing: {},
  availableModels: [],
  modelsLoading: false,
  modelsError: null,

  load: async () => {
    if (useStatusStore.getState().backendStatus === 'error') {
      set({ loaded: true, error: 'Backend is not available. Check the status bar for details.' })
      return
    }
    try {
      const data = await api.get<{ values: any; meta: any; requires_key?: any; pricing?: any }>('/settings')
      set({
        values: data.values || {},
        meta: data.meta || {},
        requiresKey: data.requires_key || {},
        pricing: data.pricing || {},
        loaded: true,
        error: null,
      })
    } catch (e: any) {
      set({ loaded: true, error: `Cannot load settings: ${e.message}` })
    }
  },

  save: async (values) => {
    try {
      await api.put('/settings', { values })
      set({ values, error: null })
    } catch (e: any) {
      set({ error: `Save failed: ${e.message}` })
    }
  },

  setValue: (key, value) => {
    set(state => ({ values: { ...state.values, [key]: value } }))
  },

  fetchModels: async (provider, baseUrl, apiKey) => {
    set({ modelsLoading: true, modelsError: null })
    try {
      const params = new URLSearchParams({ provider })
      if (baseUrl) params.set('base_url', baseUrl)
      if (apiKey) params.set('api_key', apiKey)
      const data = await api.get<{ models: { id: string; name: string }[]; error?: string }>(`/settings/models?${params}`)
      if (data.error) {
        set({ modelsLoading: false, modelsError: data.error, availableModels: [] })
      } else {
        set({ modelsLoading: false, availableModels: data.models || [] })
      }
    } catch (e: any) {
      set({ modelsLoading: false, modelsError: e.message, availableModels: [] })
    }
  },
}))
