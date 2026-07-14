import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import WorkspaceLayout from './layouts/WorkspaceLayout'
import ProjectHome from './pages/ProjectHome'
import TranslateView from './pages/TranslateView'
import CharactersPanel from './pages/CharactersPanel'
import GlossaryPanel from './pages/GlossaryPanel'
import QAPanel from './pages/QAPanel'
import SettingsPage from './pages/SettingsPage'
import { useStatusStore, BackendStatus } from './stores/statusStore'
import { api } from './services/apiClient'

function NoProjectMessage({ label }: { label: string }) {
  return (
    <div className="p-6 h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <FolderOpen size={40} className="mx-auto mb-3 text-gray-600" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">{label}</h3>
        <p className="text-sm text-gray-500 mb-6">Open or create a project to access this section.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors">
          <FolderOpen size={16} />
          Go to Projects
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  const setBackendStatus = useStatusStore(s => s.setBackendStatus)
  const setActivity = useStatusStore(s => s.setActivity)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { setAppVersion } = useStatusStore()
  const fetchVersion = async () => {
    try {
      const data = await api.get<{ version: string }>('/health')
      if (data?.version) setAppVersion(data.version)
    } catch {}
  }
  useEffect(() => {
    if (!window.electronAPI?.onBackendStatus) {
      window.electronAPI?.getBackendStatus?.().then(data => {
        const s: BackendStatus = data.status === 'connected' ? 'connected' : data.status === 'error' ? 'error' : 'connecting'
        setBackendStatus(s, data.error || undefined)
      })
      return
    }
    const unsub = window.electronAPI.onBackendStatus(data => {
      const s: BackendStatus = data.status === 'connected' ? 'connected' : data.status === 'error' ? 'error' : 'connecting'
      setBackendStatus(s, data.error || undefined)
      if (data.status === 'connected') {
        fetchVersion()
        pollModelInit()
      }
    })
    window.electronAPI.getBackendStatus().then(data => {
      const s: BackendStatus = data.status === 'connected' ? 'connected' : data.status === 'error' ? 'error' : 'connecting'
      setBackendStatus(s, data.error || undefined)
      if (data.status === 'connected') fetchVersion()
    })
    return () => {
      unsub()
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [])
  const pollModelInit = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setActivity('Loading AI model...')
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.get<{ chromadb: string }>('/init/status')
        if (status.chromadb === 'ready' || status.chromadb === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          setActivity(null)
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        setActivity(null)
      }
    }, 2000)
  }

  return (
      <HashRouter>
        <Routes>
          <Route element={<ErrorBoundary><WorkspaceLayout /></ErrorBoundary>}>
          <Route index element={<ProjectHome />} />
          <Route path="translate/:novelId" element={<TranslateView />} />
          <Route path="characters/:novelId" element={<CharactersPanel />} />
          <Route path="glossary/:novelId" element={<GlossaryPanel />} />
          <Route path="qa/:novelId" element={<QAPanel />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<div className="p-6 text-center text-gray-500"><h2 className="text-lg font-bold mb-2">404</h2><p className="text-sm">Page not found</p></div>} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
