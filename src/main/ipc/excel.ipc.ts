import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC } from '../../shared/ipc-channels'
import { excelService } from '../services/ExcelService'
import { jsonService } from '../services/JsonService'
import { settingsService } from '../services/SettingsService'
import { protoParserService } from '../services/ProtoParserService'
import type { IpcResult, ExcelReadResult, ExcelFileInfo } from '../../shared/types'

export function registerExcelIpc(): void {
  // proto 기반 Excel 파일 생성 (selectedProtoFiles 가 있으면 해당 파일만, 없으면 전체)
  ipcMain.handle(IPC.EXCEL_GENERATE, async (_event, selectedProtoFiles?: string[]): Promise<IpcResult<string[]>> => {
    try {
      const settings = settingsService.get()
      if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
      if (!settings.excelDir) return { success: false, error: 'Excel 디렉토리가 설정되지 않았습니다.' }

      const parsed = protoParserService.parseDirectory(settings.protoDir)
      if (parsed.messages.length === 0) return { success: false, error: '파싱된 테이블이 없습니다.' }

      const messages =
        selectedProtoFiles && selectedProtoFiles.length > 0
          ? parsed.messages.filter((m) => selectedProtoFiles.includes(m.sourceFile))
          : parsed.messages

      if (messages.length === 0) return { success: false, error: '선택된 proto 파일에 테이블이 없습니다.' }

      const createdFiles = await excelService.generateExcel(settings.excelDir, messages)
      return { success: true, data: createdFiles }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // proto 파일별 Excel 파일 목록 + 존재 여부 반환
  ipcMain.handle(IPC.EXCEL_LIST_EXISTING, async (): Promise<IpcResult<ExcelFileInfo[]>> => {
    try {
      const settings = settingsService.get()
      if (!settings.protoDir) return { success: true, data: [] }

      const parsed = protoParserService.parseDirectory(settings.protoDir)

      const groups = new Map<string, string[]>()
      for (const msg of parsed.messages) {
        if (!groups.has(msg.sourceFile)) groups.set(msg.sourceFile, [])
        groups.get(msg.sourceFile)!.push(msg.name)
      }

      const result: ExcelFileInfo[] = []
      for (const [protoFile, msgNames] of groups) {
        const excelFile = protoFile.replace(/\.proto$/, '') + '.xlsx'
        const excelPath = settings.excelDir ? path.join(settings.excelDir, excelFile) : ''
        const exists = excelPath ? fs.existsSync(excelPath) : false
        result.push({ protoFile, excelFile, excelPath, msgNames, exists })
      }

      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Excel 파일 읽기 → JSON 저장
  // xlsx 파일명에서 proto 파일명을 도출해 해당 proto의 Message만 허용합니다.
  // 예: GameItemTable.xlsx → GameItemTable.proto → GameItemTable, GameItemTypeTable 시트만 읽음
  ipcMain.handle(IPC.EXCEL_READ, async (_event, excelFilePath: string): Promise<IpcResult<ExcelReadResult[]>> => {
    try {
      const settings = settingsService.get()
      if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
      if (!settings.jsonDir) return { success: false, error: 'JSON 디렉토리가 설정되지 않았습니다.' }

      const parsed = protoParserService.parseDirectory(settings.protoDir)

      // xlsx 파일명 → proto 파일명 도출
      const baseName = path.basename(excelFilePath, '.xlsx') // e.g. "GameItemTable"
      const protoFileName = baseName + '.proto'               // e.g. "GameItemTable.proto"
      const allowedMessages = parsed.messages
        .filter((m) => m.sourceFile === protoFileName)
        .map((m) => m.name)

      if (allowedMessages.length === 0) {
        return { success: false, error: `${protoFileName} 에 정의된 테이블을 찾을 수 없습니다.` }
      }

      const results = await excelService.readExcel(excelFilePath, allowedMessages)
      jsonService.exportExcelToJson(settings.jsonDir, results)

      return { success: true, data: results }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
