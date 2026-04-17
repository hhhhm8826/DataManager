import { ipcMain, dialog, shell } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { settingsService } from '../services/SettingsService'
import type { IpcResult, AppSettings } from '../../shared/types'

export function registerSettingsIpc(): void {
  // 설정 조회
  ipcMain.handle(IPC.SETTINGS_GET, async (): Promise<IpcResult<AppSettings>> => {
    try {
      const data = settingsService.get()
      return { success: true, data }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // 설정 저장
  ipcMain.handle(IPC.SETTINGS_SET, async (_event, settings: Partial<AppSettings>): Promise<IpcResult> => {
    try {
      settingsService.set(settings)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // 폴더 선택 다이얼로그
  ipcMain.handle(IPC.SETTINGS_SELECT_DIR, async (): Promise<IpcResult<string>> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '취소됨' }
    }
    return { success: true, data: result.filePaths[0] }
  })

  // Excel 파일 선택 다이얼로그
  ipcMain.handle('dialog:openFile', async (_event, options: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], ...options })
    if (result.canceled) return null
    return result.filePaths
  })

  // 폴더를 파일 탐색기로 열기
  ipcMain.handle(IPC.SETTINGS_OPEN_DIR, async (_event, dirPath: string): Promise<IpcResult> => {
    try {
      const err = await shell.openPath(dirPath)
      if (err) return { success: false, error: err }
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // 파일 선택 다이얼로그 (protoc 등 실행파일 선택용)
  ipcMain.handle(IPC.SETTINGS_SELECT_FILE, async (_event, options?: Electron.OpenDialogOptions): Promise<IpcResult<string>> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      ...options
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '취소됨' }
    }
    return { success: true, data: result.filePaths[0] }
  })
}
