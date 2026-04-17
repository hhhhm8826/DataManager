import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { jsonService } from '../services/JsonService'
import type { IpcResult } from '../../shared/types'

export function registerJsonIpc(): void {
  // JSON 파일 읽기
  ipcMain.handle(IPC.JSON_READ, async (_event, filePath: string): Promise<IpcResult<unknown>> => {
    try {
      const data = jsonService.readJson(filePath)
      return { success: true, data }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // JSON 파일 저장
  ipcMain.handle(IPC.JSON_WRITE, async (_event, filePath: string, data: unknown): Promise<IpcResult> => {
    try {
      jsonService.writeJson(filePath, data)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
