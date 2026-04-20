import { ipcMain } from 'electron'
import * as path from 'path'
import { IPC } from '../../shared/ipc-channels'
import { protoParserService } from '../services/ProtoParserService'
import { settingsService } from '../services/SettingsService'
import type { IpcResult, ProtoMessage, ProtoEnum } from '../../shared/types'

export function registerProtoIpc(): void {
  // proto 디렉토리 파싱
  ipcMain.handle(IPC.PROTO_LOAD, async (): Promise<IpcResult<ReturnType<typeof protoParserService.parseDirectory>>> => {
    try {
      const settings = settingsService.get()
      if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
      const parsed = protoParserService.parseDirectory(settings.protoDir)
      return { success: true, data: parsed }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // {Name}Table.proto 에 Message 추가 (message.sourceFile 로 대상 파일 결정)
  ipcMain.handle(IPC.PROTO_ADD_MESSAGE, async (_event, message: ProtoMessage): Promise<IpcResult> => {
    try {
      const settings = settingsService.get()
      if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
      if (!message.sourceFile || !message.sourceFile.endsWith('Table.proto')) {
        return { success: false, error: '저장할 파일 이름은 {Name}Table.proto 형식이어야 합니다.' }
      }
      const filePath = path.join(settings.protoDir, message.sourceFile)
      const parsed = protoParserService.parseDirectory(settings.protoDir)
      protoParserService.addMessageToFile(filePath, message, parsed.enums, parsed.messages)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Message 수정
  ipcMain.handle(
    IPC.PROTO_UPDATE_MESSAGE,
    async (_event, payload: { sourceFile: string; oldName: string; message: ProtoMessage }): Promise<IpcResult> => {
      try {
        const settings = settingsService.get()
        if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
        const filePath = path.join(settings.protoDir, payload.sourceFile)
        const parsed = protoParserService.parseDirectory(settings.protoDir)
        protoParserService.updateMessage(filePath, payload.oldName, payload.message, parsed.enums, parsed.messages)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // Message 삭제
  ipcMain.handle(
    IPC.PROTO_DELETE_MESSAGE,
    async (_event, payload: { sourceFile: string; messageName: string }): Promise<IpcResult> => {
      try {
        const settings = settingsService.get()
        if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
        const filePath = path.join(settings.protoDir, payload.sourceFile)
        protoParserService.deleteMessage(filePath, payload.messageName)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // EnumType.proto 파일에 Enum 추가
  ipcMain.handle(
    IPC.PROTO_ADD_ENUM,
    async (_event, payload: { fileName: string; protoEnum: ProtoEnum }): Promise<IpcResult> => {
      try {
        const settings = settingsService.get()
        if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
        const filePath = path.join(settings.protoDir, payload.fileName)
        const { errors } = protoParserService.addEnumToFile(filePath, payload.protoEnum)
        if (errors.length > 0) return { success: false, error: errors.join('\n') }
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // Enum 수정
  ipcMain.handle(
    IPC.PROTO_UPDATE_ENUM,
    async (_event, payload: { sourceFile: string; oldName: string; protoEnum: ProtoEnum }): Promise<IpcResult> => {
      try {
        const settings = settingsService.get()
        if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
        const filePath = path.join(settings.protoDir, payload.sourceFile)
        const { errors } = protoParserService.updateEnum(filePath, payload.oldName, payload.protoEnum)
        if (errors.length > 0) return { success: false, error: errors.join('\n') }
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // Enum 삭제
  ipcMain.handle(
    IPC.PROTO_DELETE_ENUM,
    async (_event, payload: { sourceFile: string; enumName: string }): Promise<IpcResult> => {
      try {
        const settings = settingsService.get()
        if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
        const filePath = path.join(settings.protoDir, payload.sourceFile)
        protoParserService.deleteEnum(filePath, payload.enumName)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
