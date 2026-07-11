import { useEffect } from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import WorkspaceLayout from './layouts/WorkspaceLayout'
import ProjectHome from './pages/ProjectHome'
import TranslateView from './pages/TranslateView'
import CharactersPanel from './pages/CharactersPanel'
import GlossaryPanel from './pages/GlossaryPanel'
import QAPanel from './pages/QAPanel'
import SettingsPage from './pages/SettingsPage'
import { useStatusStore } from './stores/statusStore'
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

  useEffect(() => {
    if (!window.electronAPI?.onBackendStatus) {
      window.electronAPI?.getBackendStatus?.().then(data => {
        setBackendStatus(data.status as any, data.error || undefined)
      })
      return
    }
    const unsub = window.electronAPI.onBackendStatus(data => {
      setBackendStatus(data.status as any, data.error || undefined)

      // Start polling model init once backend is connected
      if (data.status === 'connected') {
        pollModelInit()
      }
    })
    window.electronAPI.getBackendStatus().then(data => {
      setBackendStatus(data.status as any, data.error || undefined)
    })
    return unsub
  }, [])

  const pollModelInit = async () => {
    setActivity('Loading AI model...')
    const poll = setInterval(async () => {
      try {
        const status = await api.get<{ chromadb: string }>('/init/status')
        if (status.chromadb === 'ready') {
          clearInterval(poll)
          setActivity(null)
        } else if (status.chromadb === 'error') {
          clearInterval(poll)
          setActivity(null)
        }
      } catch { clearInterval(poll); setActivity(null) }
    }, 2000)
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route index element={<ProjectHome />} />
          <Route path="translate/:novelId" element={<TranslateView />} />
          <Route path="characters" element={<NoProjectMessage label="Characters" />} />
          <Route path="characters/:novelId" element={<CharactersPanel />} />
          <Route path="glossary" element={<NoProjectMessage label="Glossary" />} />
          <Route path="glossary/:novelId" element={<GlossaryPanel />} />
          <Route path="qa" element={<NoProjectMessage label="QA Queue" />} />
          <Route path="qa/:novelId" element={<QAPanel />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
