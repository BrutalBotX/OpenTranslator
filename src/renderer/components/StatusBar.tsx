import { useEffect } from 'react'
import { useStatusStore } from '../stores/statusStore'
import { useProjectStore } from '../stores/projectStore'
import { Sun, Moon } from 'lucide-react'

const statusConfig = {
  connecting: { dot: 'bg-yellow-500', text: 'Connecting...', textColor: 'text-yellow-400' },
  connected: { dot: 'bg-green-500', text: 'Connected', textColor: 'text-green-400' },
  error: { dot: 'bg-red-500', text: 'Error', textColor: 'text-red-400' },
}

export default function StatusBar() {
  const backendStatus = useStatusStore(s => s.backendStatus)
  const backendError = useStatusStore(s => s.backendError)
  const activity = useStatusStore(s => s.activity)
  const progress = useStatusStore(s => s.progress)
  const appVersion = useStatusStore(s => s.appVersion)
  const theme = useStatusStore(s => s.theme)
  const setTheme = useStatusStore(s => s.setTheme)
  const novel = useProjectStore(s => s.novel)
  const chapters = useProjectStore(s => s.chapters)
  const cls = chapters || []

  const cfg = statusConfig[backendStatus] || statusConfig.error
  const statusLabel = backendStatus === 'error' && backendError ? `Error: ${backendError.slice(0, 60)}` : (cfg?.text || 'Unknown')

  const progressPct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  useEffect(() => {
    document.documentElement.className = theme === 'light' ? 'theme-light' : ''
  }, [theme])

  return (
    <div className="h-7 bg-gray-900 border-t border-gray-800 flex items-center px-3 text-xs shrink-0 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} title={statusLabel} />
        <span className={`${cfg.textColor} truncate max-w-[200px]`}>{statusLabel}</span>
      </div>

      {activity && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-gray-400 truncate">{activity}</span>
          {progress && (
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-gray-500 tabular-nums">{progress.current}/{progress.total}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto text-gray-500 shrink-0">
        {novel && (
          <>
            <span className="hidden sm:inline truncate max-w-[120px]">{novel.title}</span>
            <span className="hidden sm:inline text-gray-700">·</span>
            <span>{cls.length} chapter{cls.length !== 1 ? 's' : ''}</span>
          </>
        )}
        <span className="text-gray-700">|</span>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-gray-500 hover:text-gray-300 transition-colors" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        </button>
        <span className="text-gray-700">|</span>
        <span className="text-gray-600">v{appVersion || '0.0.0'}</span>
      </div>
    </div>
  )
}
