import { ipcMain, dialog } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join, extname, resolve, relative } from 'path'
import http from 'http'

const BACKEND = 'http://127.0.0.1:8712/api'

function backendFetch(path: string, options?: { method?: string; body?: any }): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${BACKEND}${path}`
    const method = options?.method || 'GET'
    const body = options?.body ? JSON.stringify(options.body) : undefined
    const req = http.request(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body).toString() } : {},
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)) } catch { resolve(data) }
        } else {
          reject(new Error(`${res.statusCode}: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Backend request timed out')) })
    if (body) req.write(body)
    req.end()
  })
}

function isPathSafe(target: string, base: string): string | null {
  const resolved = resolve(base, target)
  if (relative(base, resolved).startsWith('..')) return null
  return resolved
}

export function registerFileHandlers(projectsDir: string): void {
  if (!existsSync(projectsDir)) mkdirSync(projectsDir, { recursive: true })

  ipcMain.handle('project:open', async (_event, path?: string) => {
    if (!path) {
      const result = await dialog.showOpenDialog({ filters: [{ name: 'OpenTranslator Project', extensions: ['novelproj'] }] })
      if (result.canceled || !result.filePaths.length) return null
      path = result.filePaths[0]
    }
    const raw = await readFile(path, 'utf-8')
    const data = JSON.parse(raw)
    const novelId = data.novel?.id
    if (novelId) {
      try {
        await backendFetch('/projects/import-proj', { method: 'POST', body: { data } })
        return { path, data: { id: novelId } }
      } catch (e: any) {
        return { path, data: { id: novelId }, error: e.message }
      }
    }
    return { path, data: null }
  })

  ipcMain.handle('project:save', async (_event, data: any) => {
    const novelId = data.id
    if (!novelId) return { path: null }
    const exportData = await backendFetch(`/projects/${novelId}/export-proj`).catch(() => null)
    if (!exportData) return { path: null }

    const title = String(exportData.novel?.title || 'untitled')
    const dir = data.savePath || projectsDir
    mkdirSync(dir, { recursive: true })
    const target = join(dir, `${title.replace(/[<>:"/\\|?*]/g, '_')}.novelproj`)
    const safe = isPathSafe(target, dir)
    if (!safe) throw new Error('Invalid project path')
    await writeFile(safe, JSON.stringify(exportData, null, 2))
    return { path: safe }
  })

  ipcMain.handle('chapter:import', async (_event, filePath?: string) => {
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        filters: [
          { name: 'Text Files', extensions: ['txt', 'epub', 'html', 'md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (result.canceled || !result.filePaths.length) return null
      filePath = result.filePaths[0]
    }
    const content = await readFile(filePath, 'utf-8')
    const name = filePath.split(/[/\\]/).pop() || 'chapter'
    return { name, content, path: filePath }
  })
}
