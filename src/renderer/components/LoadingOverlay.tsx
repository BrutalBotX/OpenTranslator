import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useStatusStore } from '../stores/statusStore'
import { api } from '../services/apiClient'

const STEPS = [
  { id: 'backend', label: 'Starting Python backend...' },
  { id: 'chromadb', label: 'Loading translation memory...' },
  { id: 'ready', label: 'Ready' },
]

export default function LoadingOverlay() {
  const { backendStatus, backendError } = useStatusStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [chromadbReady, setChromadbReady] = useState(false)

  useEffect(() => {
    if (backendStatus !== 'connecting') return
    if (currentStep === 0) {
      const t = setTimeout(() => setCurrentStep(1), 3000)
      return () => clearTimeout(t)
    }
  }, [backendStatus, currentStep])

  useEffect(() => {
    if (backendStatus !== 'connecting' || chromadbReady) return
    const poll = setInterval(async () => {
      try {
        const status = await api.get<{ chromadb: string }>('/init/status')
        if (status.chromadb === 'ready') {
          setChromadbReady(true)
          setCurrentStep(2)
          clearInterval(poll)
        } else if (status.chromadb === 'error') {
          clearInterval(poll)
        }
      } catch { clearInterval(poll) }
    }, 2000)
    return () => clearInterval(poll)
  }, [backendStatus, chromadbReady])

  if (backendStatus !== 'connecting' && backendStatus !== 'error') return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
        {backendStatus === 'error' ? (
          <>
            <AlertTriangle size={36} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-lg font-bold text-gray-100 mb-2">Startup Error</h2>
            <p className="text-sm text-gray-400 mb-2">OpenTranslator could not start.</p>
            {backendError && (
              <p className="text-xs text-red-300 bg-red-900/20 rounded p-2 mb-4 font-mono break-words">
                {backendError}
              </p>
            )}
            <button onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw size={16} /> Retry
            </button>
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-cyan-400 mb-1">OpenTranslator</h1>
              <p className="text-xs text-gray-500">v0.2.0</p>
            </div>
            <div className="space-y-3 text-left">
              {STEPS.map((step, i) => {
                const isActive = i === currentStep
                const isDone = i < currentStep
                return (
                  <div key={step.id} className={`flex items-center gap-3 text-sm ${isDone ? 'text-green-400' : isActive ? 'text-cyan-300' : 'text-gray-600'}`}>
                    {isDone ? (
                      <CheckCircle2 size={16} className="shrink-0" />
                    ) : isActive ? (
                      <Loader2 size={16} className="animate-spin shrink-0 text-cyan-400" />
                    ) : (
                      <div className="w-4 h-4 shrink-0" />
                    )}
                    <span>{step.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
