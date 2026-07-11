import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { registerFileHandlers } from '../ipc/file-handlers'
import { registerLLMHandlers } from '../ipc/llm-handlers'
import { registerDBHandlers } from '../ipc/db-handlers'
import http from 'http'

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

const BACKEND_PORT = 8712
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`
let _backendStatus: 'connecting' | 'connected' | 'error' = 'connecting'
let _backendError: string | null = null

function sendStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backend:status', { status: _backendStatus, error: _backendError })
  }
}

function checkHealth() {
  const req = http.get(`${BACKEND_URL}/health`, (res) => {
    if (res.statusCode === 200) {
      _backendStatus = 'connected'
      _backendError = null
      sendStatus()
    }
  })
  req.on('error', () => {})
  req.setTimeout(2000, () => req.destroy())
}

function startHealthPoll() {
  let attempts = 0
  const maxAttempts = 30 // 30 * 500ms = 15s
  const interval = setInterval(() => {
    if (_backendStatus === 'connected') { clearInterval(interval); return }
    attempts++
    const req = http.get(`${BACKEND_URL}/health`, (res) => {
      if (res.statusCode === 200) {
        _backendStatus = 'connected'
        _backendError = null
        sendStatus()
        clearInterval(interval)
      } else if (attempts >= maxAttempts) {
        _backendStatus = 'error'
        _backendError = `Backend returned status ${res.statusCode}`
        sendStatus()
        clearInterval(interval)
      }
    })
    req.on('error', () => {
      if (attempts >= maxAttempts) {
        _backendStatus = 'error'
        _backendError = 'Backend failed to start within 15s. Check that Python and requirements are installed.'
        sendStatus()
        clearInterval(interval)
      }
    })
    req.setTimeout(2000, () => req.destroy())
  }, 500)
}

function startBackend(): void {
  _backendStatus = 'connecting'
  _backendError = null
  sendStatus()

  const isPackaged = app.isPackaged
  const backendPath = isPackaged ? join(process.resourcesPath, 'backend') : join(__dirname, '../../')
  const moduleArg = isPackaged ? 'main:app' : 'backend.main:app'
  const cwd = isPackaged ? backendPath : join(__dirname, '../../')

  try {
    backendProcess = spawn('python', ['-m', 'uvicorn', moduleArg, '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
      cwd: cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ORT_LOGGING_LEVEL: '3',
        ORT_TENSORRT_DISABLE: '1',
        CUDA_VISIBLE_DEVICES: '-1',
      }
    })

    backendProcess.stdout?.on('data', (data: Buffer) => console.log(`[backend] ${data.toString().trim()}`))
    backendProcess.stderr?.on('data', (data: Buffer) => console.error(`[backend] ${data.toString().trim()}`))

    backendProcess.on('error', (err) => {
      _backendStatus = 'error'
      _backendError = `Failed to start backend: ${err.message}`
      sendStatus()
    })

    backendProcess.on('exit', (code: number | null) => {
      console.log(`[backend] exited with code ${code}`)
      if (_backendStatus !== 'error') {
        _backendStatus = 'error'
        _backendError = code === null ? 'Backend process terminated' : `Backend exited with code ${code}`
        sendStatus()
      }
    })

    startHealthPoll()
  } catch (err: any) {
    _backendStatus = 'error'
    _backendError = `Failed to spawn backend: ${err.message}`
    sendStatus()
  }
}

function stopBackend(): void {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const projectsDir = join(app.getPath('documents'), 'OpenTranslator', 'projects')
  registerFileHandlers(projectsDir)
  registerLLMHandlers()
  registerDBHandlers()

  startBackend()
  createWindow()

  setInterval(checkHealth, 10000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopBackend()
})

ipcMain.handle('backend:port', () => BACKEND_PORT)
ipcMain.handle('backend:status', () => ({ status: _backendStatus, error: _backendError }))
ipcMain.handle('app:getPath', (_event, name: string) => app.getPath(name))
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
})
