import { ipcMain } from 'electron'

const BACKEND_URL = 'http://127.0.0.1:8712/api'

export function registerLLMHandlers(): void {
  ipcMain.handle('http:fetch', async (_event, endpoint: string, options?: any) => {
    const url = `${BACKEND_URL}${endpoint}`
    let response: Response | null = null
    const timeoutMs = 65_000

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      response = await fetch(url, {
        method: options?.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })
    } catch (err: any) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. The LLM provider may be slow or unreachable. Try increasing the timeout in Settings.')
      }
      if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
        throw new Error('Backend is not running. Make sure the server started successfully.')
      }
      throw new Error(`Network error: ${err.message}`)
    }

    clearTimeout(timer)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`${response.status}: ${text.slice(0, 200)}`)
    }

    return response.json()
  })
}
