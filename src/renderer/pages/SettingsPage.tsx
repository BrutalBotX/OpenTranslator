import { useEffect, useState, useCallback } from 'react'
import { Save, Loader2, AlertTriangle, RefreshCw, FolderOpen, RotateCw } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { api } from '../services/apiClient'

type ModelList = { id: string; name: string }[]

const DEFAULT_MODELS: Record<string, string> = {
  ollama: "llama3:70b", openai: "gpt-4o", deepseek: "deepseek-chat",
  anthropic: "claude-sonnet-4-20250514", "google-gemini": "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile", mistral: "mistral-large-latest",
  together: "meta-llama/llama-3.3-70b-instruct-turbo", perplexity: "sonar-pro",
  cohere: "command-r-plus", opencode: "openai/deepseek-v4-pro", "opencode-go": "openai/deepseek-v4-pro",
  xai: "grok-2", openrouter: "openai/gpt-4o",
  fireworks: "accounts/fireworks/models/qwen3-70b",
  deepinfra: "meta-llama/llama-3.3-70b-instruct",
}

export default function SettingsPage() {
  const { values, meta, loaded, error, load, save, setValue, requiresKey, pricing } = useSettingsStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [models, setModels] = useState<Record<string, ModelList>>({})
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({})
  const [modelErrors, setModelErrors] = useState<Record<string, string>>({})

  useEffect(() => { if (!loaded) load() }, [])

  const handleSave = async () => {
    setSaving(true)
    await save(values)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fetchModelsFor = useCallback(async (key: string, provider: string) => {
    const current = useSettingsStore.getState().values
    const urlKey = key.replace('_provider', '_base_url')
    const apiKeyKey = key.replace('_provider', '_api_key')

    setLoadingModels(prev => ({ ...prev, [key]: true }))
    setModelErrors(prev => ({ ...prev, [key]: '' }))

    try {
      const params = new URLSearchParams({ provider })
      const baseUrl = current[urlKey] || ''
      const apiKey = current[apiKeyKey] || ''
      if (baseUrl) params.set('base_url', baseUrl)
      if (apiKey) params.set('api_key', apiKey)
      const data = await api.get<{ models: ModelList; error?: string }>(`/settings/models?${params}`)
      if (data.error) {
        setModelErrors(prev => ({ ...prev, [key]: data.error || '' }))
        setModels(prev => ({ ...prev, [key]: [] }))
      } else {
        setModels(prev => ({ ...prev, [key]: data.models || [] }))
      }
    } catch (e: any) {
      setModelErrors(prev => ({ ...prev, [key]: e.message }))
      setModels(prev => ({ ...prev, [key]: [] }))
    } finally {
      setLoadingModels(prev => ({ ...prev, [key]: false }))
    }
  }, [])

  const handleProviderChange = useCallback((key: string, provider: string) => {
    setValue(key, provider)
    const modelKey = key.replace('_provider', '_model')
    if (provider && DEFAULT_MODELS[provider]) {
      setValue(modelKey, DEFAULT_MODELS[provider])
    }
    setModels(prev => ({ ...prev, [key]: [] }))
    setModelErrors(prev => ({ ...prev, [key]: '' }))

    if (provider && provider !== 'custom') {
      fetchModelsFor(key, provider)
    }
  }, [setValue, fetchModelsFor])

  const renderProviderSection = (prefix: string, label: string) => {
    const providerKey = `${prefix}_provider`
    const modelKey = `${prefix}_model`
    const urlKey = `${prefix}_base_url`
    const apiKeyKey = `${prefix}_api_key`
    const field = meta[providerKey]
    if (!field) return null

    const provider = values[providerKey] ?? ''
    const currentModel = values[modelKey] ?? ''
    const currentModels = models[providerKey] || []
    const isLoading = loadingModels[providerKey] || false
    const modelError = modelErrors[providerKey] || ''
    const isCustom = provider === 'custom'

    return (
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">{label}</h4>
          {provider && (
            <span className={`px-2 py-0.5 text-xs rounded truncate max-w-[140px] ${provider === 'ollama' ? 'bg-green-900/50 text-green-300' : 'bg-blue-900/50 text-blue-300'}`}>
              {field.labels?.[provider] || provider}
            </span>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
            <select value={provider} onChange={e => handleProviderChange(providerKey, e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">
            {(field.options || []).map(opt => {
                const label = field.labels?.[opt] || opt || '(none)'
                const price = pricing[opt]
                const display = price ? `${label} — ${price}` : label
                return <option key={opt} value={opt}>{display}</option>
              })}
            </select>
          </div>

          {provider && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <div className="flex gap-2">
                  {currentModels.length > 0 ? (
                    <select value={currentModel} onChange={e => setValue(modelKey, e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">
                      <option value="">Select a model...</option>
                      {currentModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={currentModel} onChange={e => setValue(modelKey, e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                      placeholder={isLoading ? 'Loading models...' : 'e.g. gpt-4o, llama3:70b'} />
                  )}
                  <button onClick={() => fetchModelsFor(providerKey, provider)} disabled={isLoading}
                    className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50" title="Refresh models">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                  </button>
                </div>
                {isLoading && <p className="text-xs text-gray-500 mt-1">Fetching available models...</p>}
                {modelError && <p className="text-xs text-red-400 mt-1">{modelError}</p>}
                {currentModels.length > 0 && <p className="text-xs text-gray-500 mt-1">{currentModels.length} models available</p>}
              </div>

              {isCustom && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">API URL (required)</label>
                  <input type="text" value={values[urlKey] ?? ''} onChange={e => setValue(urlKey, e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                    placeholder="https://your-endpoint.com/v1" />
                </div>
              )}

              {(() => {
                const keyReq = requiresKey[provider]
                if (keyReq === false) return null
                const hint = typeof keyReq === 'string' ? keyReq : provider === 'ollama' ? 'Not needed for local Ollama' : `API key for ${field.labels?.[provider] || provider}`
                const isOptional = typeof keyReq === 'string'
                return (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      API Key {isOptional ? '(required for translation)' : `(required)`}
                    </label>
                    <input type="password" value={values[apiKeyKey] ?? ''} onChange={e => setValue(apiKeyKey, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                      placeholder={hint} />
                    {isOptional && <p className="text-xs text-gray-500 mt-1">{keyReq}</p>}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-gray-500 mr-2" />
        <span className="text-sm text-gray-500">Connecting to backend...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="mx-auto mb-3 text-yellow-500" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">Cannot Load Settings</h3>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors"><RefreshCw size={16} /> Retry</button>
        </div>
      </div>
    )
  }

  const keys = Object.keys(meta)
  const langKeys = keys.filter(k => k.startsWith('default_') && k !== 'default_project_dir')
  const dirKeys = keys.filter(k => k === 'default_project_dir')

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-xl font-bold mb-6">Settings</h2>

        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">LLM Providers</h3>
          <div className="space-y-6">
            {renderProviderSection('primary', 'Primary Provider')}
            {renderProviderSection('fallback', 'Fallback Provider')}
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">LLM Settings</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 max-w-md">
              {(() => {
                const k = 'batch_size'
                const field = meta[k]
                if (!field) return null
                const raw = values[k] ?? '4'
                const val = parseInt(raw, 10) || 4
                const min = field.min ?? 1
                const max = field.max ?? 10
                const step = field.step ?? 1
                const warning = field.warning_above ?? 6
                const isDangerous = val > warning
                const isSlow = val <= 2

                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-500">{field.label}</label>
                      <span className={`text-sm font-mono px-2 py-0.5 rounded ${
                        isDangerous ? 'bg-red-900/50 text-red-300' :
                        isSlow ? 'bg-green-900/50 text-green-300' :
                        'bg-cyan-900/50 text-cyan-300'
                      }`}>{val}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={val}
                      onChange={e => setValue(k, e.target.value)}
                      className="w-full accent-cyan-500" />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>Slower · Precise</span>
                      <span>Faster · Batched</span>
                    </div>
                    {field.description && <p className="text-xs text-gray-500 mt-2">{field.description}</p>}
                    {isDangerous && (
                      <p className="text-xs text-red-400 mt-1">? High values may cause the AI to skip segments or mix up content.</p>
                    )}
                    {isSlow && (
                      <p className="text-xs text-green-400 mt-1">? One segment per call — most precise but slowest.</p>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 max-w-md">
              {(() => {
                const k = 'llm_timeout'
                const field = meta[k]
                if (!field) return null
                const raw = values[k] ?? '60'
                const val = parseInt(raw, 10) || 60
                const min = field.min ?? 10
                const max = field.max ?? 300
                const step = field.step ?? 5
                const isFast = val <= 30
                const isSlow = val >= 120

                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-500">{field.label}</label>
                      <span className={`text-sm font-mono px-2 py-0.5 rounded ${
                        isFast ? 'bg-red-900/50 text-red-300' :
                        isSlow ? 'bg-green-900/50 text-green-300' :
                        'bg-cyan-900/50 text-cyan-300'
                      }`}>{val}s</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={val}
                      onChange={e => setValue(k, e.target.value)}
                      className="w-full accent-cyan-500" />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>Faster fail</span>
                      <span>Patient</span>
                    </div>
                    {field.description && <p className="text-xs text-gray-500 mt-2">{field.description}</p>}
                    {isFast && (
                      <p className="text-xs text-red-400 mt-1">? Low timeout may abort slow LLM providers mid-response.</p>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 max-w-md">
              {(() => {
                const k = 'auto_backup_interval'
                const field = meta[k]
                if (!field) return null
                const raw = values[k] ?? '0'
                const val = parseInt(raw, 10) || 0
                const options = field.options as string[] | undefined
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-500">{field.label}</label>
                      <span className="text-sm font-mono px-2 py-0.5 rounded text-cyan-300 bg-cyan-900/50">
                        {val === 0 ? 'Off' : `Every ${val} chapter${val > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    {options && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {options.map(opt => {
                          const num = parseInt(opt, 10)
                          return (
                            <button key={opt} onClick={() => setValue(k, opt)}
                              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                                raw === opt ? 'bg-cyan-600/40 text-cyan-300 border border-cyan-700' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                              }`}>
                              {num === 0 ? 'Off' : num === 1 ? 'Every' : `Every ${num}`}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {field.description && <p className="text-xs text-gray-500 mt-2">{field.description}</p>}
                  </div>
                )
              })()}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Defaults</h3>
          <div className="grid grid-cols-2 gap-3">
            {langKeys.map(k => {
              const field = meta[k]
              if (!field) return null
              return (
                <div key={k} className="p-4 bg-gray-900 rounded-lg border border-gray-800">
                  <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                  {field.type === 'select' && field.options ? (
                    <select value={values[k] ?? ''} onChange={e => setValue(k, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600">
                      {field.options.map(opt => <option key={opt} value={opt}>{field.labels?.[opt] || opt}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={values[k] ?? ''} onChange={e => setValue(k, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" />
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {dirKeys.length > 0 && (
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Project Storage</h3>
            <div className="p-4 bg-gray-900 rounded-lg border border-gray-800 max-w-md">
              {dirKeys.map(k => {
                const field = meta[k]
                if (!field) return null
                return (
                  <div key={k}>
                    <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                    <div className="flex gap-2">
                      <input type="text" value={values[k] ?? ''} onChange={e => setValue(k, e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600" />
                      <button onClick={async () => {
                        const dir = window.electronAPI?.selectDirectory ? await window.electronAPI.selectDirectory() : null
                        if (dir) setValue(k, dir)
                      }} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors">
                        <FolderOpen size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg text-sm transition-colors">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
