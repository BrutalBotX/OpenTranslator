const API_BASE = 'http://127.0.0.1:8712/api'
const DEFAULT_TIMEOUT = 120_000

async function apiFetch<T = any>(path: string, options?: RequestInit, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  const hasIpc = !!window.electronAPI?.fetch

  if (hasIpc) {
    const method = options?.method || 'GET'
    const body = options?.body ? JSON.parse(options.body as string) : undefined
    const result = await window.electronAPI.fetch(path, { method, body })
    return result as T
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`)
    }
    return res.json()
  } catch (e: any) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('Connection timed out')
    throw e
  }
}

export const api = {
  get: <T = any>(path: string) => apiFetch<T>(path),
  post: <T = any>(path: string, body?: any) =>
    apiFetch<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(path: string, body?: any) =>
    apiFetch<T>(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
}
