import { create } from 'zustand'
import ver from '../../../version.json'

export type BackendStatus = 'connecting' | 'connected' | 'error'

interface Progress {
  current: number
  total: number
  label?: string
}

export type Theme = 'dark' | 'light'

interface StatusState {
  backendStatus: BackendStatus
  backendError: string | null
  activity: string | null
  progress: Progress | null
  appVersion: string
  theme: Theme
  setBackendStatus: (status: BackendStatus, error?: string | null) => void
  setActivity: (activity: string | null) => void
  setProgress: (progress: Progress | null) => void
  setAppVersion: (version: string) => void
  setTheme: (theme: Theme) => void
  clear: () => void
}

const initialTheme: Theme = (typeof localStorage !== 'undefined' && localStorage.getItem('opentranslator-theme') as Theme) || 'dark'

export const useStatusStore = create<StatusState>(set => ({
  backendStatus: 'connecting',
  backendError: null,
  activity: null,
  progress: null,
  appVersion: ver.version || '0.0.0',
  theme: initialTheme,

  setBackendStatus: (status, error = null) => set({ backendStatus: status, backendError: error }),
  setActivity: activity => set({ activity }),
  setProgress: progress => set({ progress }),
  setAppVersion: version => set({ appVersion: version }),
  setTheme: theme => {
    localStorage.setItem('opentranslator-theme', theme)
    set({ theme })
  },
  clear: () => set({ activity: null, progress: null }),
}))
