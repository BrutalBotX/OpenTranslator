import { ipcMain, dialog } from 'electron'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, extname } from 'path'

export function registerFileHandlers(projectsDir: string): void {
  if (!existsSync(projectsDir)) mkdirSync(projectsDir, { recursive: true })

  ipcMain.handle('project:open', async (_event, path?: string) => {
    if (!path) {
      const result = await dialog.showOpenDialog({ filters: [{ name: 'OpenTranslator Project', extensions: ['novelproj'] }] })
      if (result.canceled || !result.filePaths.length) return null
      path = result.filePaths[0]
    }
    const data = readFileSync(path, 'utf-8')
    return { path, data: JSON.parse(data) }
  })

  ipcMain.handle('project:save', (_event, data: any) => {
    const path = data.path || join(projectsDir, `${data.name || 'untitled'}.novelproj`)
    writeFileSync(path, JSON.stringify(data, null, 2))
    return { path }
  })

  ipcMain.handle('project:list', () => {
    if (!existsSync(projectsDir)) return []
    return readdirSync(projectsDir)
      .filter(f => extname(f) === '.novelproj')
      .map(f => ({ name: f, path: join(projectsDir, f) }))
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
    const content = readFileSync(filePath, 'utf-8')
    const name = filePath.split(/[/\\]/).pop() || 'chapter'
    return { name, content, path: filePath }
  })
}
