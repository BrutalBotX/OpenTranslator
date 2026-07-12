import { create } from 'zustand'

export type BackendStatus = 'connecting' | 'connected' | 'error'

interface Progress {
  current: number
  total: number
  label?: string
}

interface StatusState {
  backendStatus: BackendStatus
  backendError: string | null
  activity: string | null
  progress: Progress | null
  appVersion: string
  setBackendStatus: (status: BackendStatus, error?: string | null) => void
  setActivity: (activity: string | null) => void
  setProgress: (progress: Progress | null) => void
  setAppVersion: (version: string) => void
  clear: () => void
}

export const useStatusStore = create<StatusState>(set => ({
  backendStatus: 'connecting',
  backendError: null,
  activity: null,
  progress: null,
  appVersion: '0.0.0',

  setBackendStatus: (status, error = null) => set({ backendStatus: status, backendError: error }),
  setActivity: activity => set({ activity }),
  setProgress: progress => set({ progress }),
  setAppVersion: version => set({ appVersion: version }),
  clear: () => set({ activity: null, progress: null }),
}))
