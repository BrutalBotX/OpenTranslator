export {}

declare global {
  interface Window {
    electronAPI: {
      getBackendPort: () => Promise<number>
      getBackendStatus: () => Promise<{ status: string; error: string | null }>
      onBackendStatus: (callback: (data: { status: string; error: string | null }) => void) => () => void
      selectDirectory: () => Promise<string | null>
      getPath: (name: string) => Promise<string>
      openProject: (path?: string) => Promise<any>
      saveProject: (data: any) => Promise<void>
      listProjects: () => Promise<any[]>
      importChapter: (filePath?: string) => Promise<any>
      exportProject: (format: string, path: string) => Promise<void>
      fetch: (endpoint: string, options?: any) => Promise<any>
    }
  }
}
