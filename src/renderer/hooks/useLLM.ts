import { useSettingsStore } from '../stores/settingsStore'

interface LLMCompletionParams {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export function useLLM() {
  const { primaryProvider, fallbackProvider } = useSettingsStore()

  const complete = async (params: LLMCompletionParams) => {
    try {
      return await window.electronAPI.fetch('/api/llm/complete', {
        method: 'POST',
        body: {
          ...params,
          provider: primaryProvider
        }
      })
    } catch (err) {
      if (fallbackProvider) {
        return await window.electronAPI.fetch('/api/llm/complete', {
          method: 'POST',
          body: {
            ...params,
            provider: fallbackProvider
          }
        })
      }
      throw err
    }
  }

  return { complete }
}
