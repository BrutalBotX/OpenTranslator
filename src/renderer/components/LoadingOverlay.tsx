import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useStatusStore } from '../stores/statusStore'
import { api } from '../services/apiClient'

const STEPS = [
  { id: 'backend', label: 'Initializing...' },
  { id: 'chromadb', label: 'Loading...' },
  { id: 'ready', label: 'Ready' },
]

export default function LoadingOverlay() {
  const { backendStatus, backendError, appVersion } = useStatusStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [chromadbReady, setChromadbReady] = useState(false)
  const [chromadbError, setChromadbError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 0 → Step 1 when backend health check succeeds
  useEffect(() => {
    if (currentStep === 0 && backendStatus === 'connected') {
      setCurrentStep(1)
    }
  }, [backendStatus, currentStep])

  // Step 1: Poll ChromaDB init status
  const attemptsRef = useRef(0)
  useEffect(() => {
    if (backendStatus !== 'connected' || chromadbReady || currentStep !== 1) return
    attemptsRef.current = 0
    pollRef.current = setInterval(async () => {
      attemptsRef.current++
      try {
        const status = await api.get<{ chromadb: string; error?: string }>('/init/status')
        if (status.chromadb === 'ready') {
          setChromadbReady(true)
          setCurrentStep(2)
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (status.chromadb === 'error') {
          setChromadbError(status.error || 'ChromaDB initialization failed')
          if (pollRef.current) clearInterval(pollRef.current)
        } else if (attemptsRef.current >= 15) {
          setChromadbError('Loading timed out. Proceeding without cache.')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {
        if (attemptsRef.current >= 15) {
          setChromadbError('Backend init status unreachable.')
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }
    }, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [backendStatus, chromadbReady, currentStep])

  useEffect(() => {
    if (chromadbError && currentStep < 2) {
      setCurrentStep(2)
    }
  }, [chromadbError, currentStep])

  // Stay visible until backend is connected AND chromadb is ready (or errored)
  const showOverlay = backendStatus === 'connecting' || backendStatus === 'error' ||
    (backendStatus === 'connected' && !chromadbReady && !chromadbError && currentStep < 2)
  if (!showOverlay) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
        {backendStatus === 'error' ? (
          <>
            <AlertTriangle size={36} className="mx-auto mb-4 text-red-400" />
            <h2 className="text-lg font-bold text-gray-100 mb-2">Startup Error</h2>
            <p className="text-sm text-gray-400 mb-2">OpenTranslator could not start.</p>
            {backendError && (
              <p className="text-xs text-red-300 bg-red-900/20 rounded p-2 mb-4 font-mono break-words whitespace-pre-wrap">
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
              <p className="text-xs text-gray-500">v{appVersion || '0.0.0'}</p>
            </div>
            <div className="space-y-3 text-left">
              {STEPS.map((step, i) => {
                const isActive = i === currentStep
                const isDone = i < currentStep
                const isError = i === 1 && chromadbError
                return (
                  <div key={step.id} className={`flex items-center gap-3 text-sm ${isDone ? (isError ? 'text-yellow-400' : 'text-green-400') : isActive ? 'text-cyan-300' : 'text-gray-600'}`}>
                    {isDone && !isError ? (
                      <CheckCircle2 size={16} className="shrink-0" />
                    ) : isError ? (
                      <AlertTriangle size={16} className="shrink-0 text-yellow-400" />
                    ) : isActive ? (
                      <Loader2 size={16} className="animate-spin shrink-0 text-cyan-400" />
                    ) : (
                      <div className="w-4 h-4 shrink-0" />
                    )}
                    <div>
                      <span>{step.label}</span>
                      {i === 1 && chromadbError && (
                        <p className="text-xs text-yellow-500 mt-0.5">{chromadbError}</p>
                      )}
                    </div>
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
