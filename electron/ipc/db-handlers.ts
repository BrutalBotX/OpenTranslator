import { ipcMain } from 'electron'

export function registerDBHandlers(): void {
  ipcMain.handle('db:query', async (_event, _collection: string, _query?: any) => {
    return []
  })
}
