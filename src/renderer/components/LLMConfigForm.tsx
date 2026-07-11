interface ProviderConfig {
  name: string
  model: string
  baseUrl?: string
  apiKey?: string
}

interface LLMConfigFormProps {
  config: ProviderConfig
  onChange: (config: ProviderConfig) => void
}

export default function LLMConfigForm({ config, onChange }: LLMConfigFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Provider Name</label>
        <input
          type="text"
          value={config.name}
          onChange={e => onChange({ ...config, name: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
          placeholder="e.g. ollama, openai"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Model</label>
        <input
          type="text"
          value={config.model}
          onChange={e => onChange({ ...config, model: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
          placeholder="e.g. llama3:70b, gpt-4o"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Base URL (optional)</label>
        <input
          type="text"
          value={config.baseUrl || ''}
          onChange={e => onChange({ ...config, baseUrl: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
          placeholder="e.g. http://localhost:11434/v1"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">API Key (optional)</label>
        <input
          type="password"
          value={config.apiKey || ''}
          onChange={e => onChange({ ...config, apiKey: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
          placeholder="sk-..."
        />
      </div>
    </div>
  )
}
