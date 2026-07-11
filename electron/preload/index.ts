import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getBackendPort: (): Promise<number> => ipcRenderer.invoke('backend:port'),
  getBackendStatus: (): Promise<{ status: string; error: string | null }> => ipcRenderer.invoke('backend:status'),
  onBackendStatus: (callback: (data: { status: string; error: string | null }) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('backend:status', handler)
    return () => ipcRenderer.removeListener('backend:status', handler)
  },
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  getPath: (name: string): Promise<string> => ipcRenderer.invoke('app:getPath', name),
  openProject: (path?: string): Promise<any> => ipcRenderer.invoke('project:open', path),
  saveProject: (data: any): Promise<void> => ipcRenderer.invoke('project:save', data),
  listProjects: (): Promise<any[]> => ipcRenderer.invoke('project:list'),
  importChapter: (filePath: string): Promise<any> => ipcRenderer.invoke('chapter:import', filePath),
  exportProject: (format: string, path: string): Promise<void> => ipcRenderer.invoke('project:export', format, path),
  fetch: (endpoint: string, options?: any): Promise<any> => ipcRenderer.invoke('http:fetch', endpoint, options)
}

contextBridge.exposeInMainWorld('electronAPI', api)
