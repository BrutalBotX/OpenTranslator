import { useStatusStore } from '../stores/statusStore'
import { useProjectStore } from '../stores/projectStore'

const statusConfig = {
  connecting: { dot: 'bg-yellow-500', text: 'Connecting...', textColor: 'text-yellow-400' },
  connected: { dot: 'bg-green-500', text: 'Connected', textColor: 'text-green-400' },
  error: { dot: 'bg-red-500', text: 'Error', textColor: 'text-red-400' },
}

export default function StatusBar() {
  const { backendStatus, backendError, activity, progress } = useStatusStore()
  const { novel, chapters } = useProjectStore()

  const cfg = statusConfig[backendStatus]
  const statusLabel = backendStatus === 'error' && backendError ? `Error: ${backendError.slice(0, 60)}` : cfg.text

  const progressPct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

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
            <span>{chapters.length} chapter{chapters.length !== 1 ? 's' : ''}</span>
          </>
        )}
        <span className="text-gray-700">|</span>
        <span className="text-gray-600">v0.1.0</span>
      </div>
    </div>
  )
}
