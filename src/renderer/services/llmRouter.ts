import { useSettingsStore, LLMProvider } from '../stores/settingsStore'

interface RouteConfig {
  task: 'translate' | 'detect' | 'postprocess' | 'summarize'
  contextLength: number
}

const taskDefaults: Record<string, Partial<LLMProvider>> = {
  detect: { model: 'mistral:7b' },
  translate: {},
  postprocess: {},
  summarize: {}
}

export function selectBestProvider(config: RouteConfig): LLMProvider {
  const { primaryProvider, fallbackProvider } = useSettingsStore.getState()

  if (!primaryProvider) {
    throw new Error('No LLM provider configured')
  }

  const taskOverrides = taskDefaults[config.task]
  const selected = { ...primaryProvider, ...taskOverrides }

  if (config.contextLength > 8000 && selected.name === 'ollama') {
    if (fallbackProvider) return fallbackProvider
  }

  return selected
}

export function buildRequestBody(
  prompt: string,
  systemPrompt: string,
  provider: LLMProvider
) {
  return {
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 4096,
    ...(provider.baseUrl ? { base_url: provider.baseUrl } : {}),
    ...(provider.apiKey ? { api_key: provider.apiKey } : {})
  }
}
