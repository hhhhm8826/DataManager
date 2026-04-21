import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { protocService, SUPPORTED_LANGUAGES } from '../services/CodeGeneratorService'
import { unrealCodeGenerator } from '../services/UnrealCodeGeneratorService'
import { ProtoParserService } from '../services/ProtoParserService'
import { settingsService } from '../services/SettingsService'
import type { IpcResult } from '../../shared/types'

const protoParser = new ProtoParserService()

export function registerCodegenIpc(): void {
  // protoc 가 지원하는 언어 목록 반환
  ipcMain.handle(IPC.CODEGEN_LIST_LANGUAGES, (): IpcResult<string[]> => {
    return { success: true, data: SUPPORTED_LANGUAGES }
  })

  // 특정 언어 코드 생성
  ipcMain.handle(IPC.CODEGEN_GENERATE, async (_event, language: string): Promise<IpcResult> => {
    try {
      const settings = settingsService.getResolved()
      if (!settings.protocPath)
        return { success: false, error: 'protoc 경로가 설정되지 않았습니다.' }
      if (!settings.protoDir)
        return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }

      const targetOutput = settings.outputDirs.find((o) => o.language === language)
      if (!targetOutput?.dir)
        return { success: false, error: `${language} 출력 경로가 설정되지 않았습니다.` }

      protocService.generate(settings.protocPath, settings.protoDir, language, targetOutput.dir)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // 설정된 모든 언어 일괄 생성
  ipcMain.handle(IPC.CODEGEN_GENERATE_ALL, async (): Promise<IpcResult<string[]>> => {
    try {
      const settings = settingsService.getResolved()
      if (!settings.protocPath)
        return { success: false, error: 'protoc 경로가 설정되지 않았습니다.' }
      if (!settings.protoDir)
        return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }

      const configured = settings.outputDirs.filter((o) => o.dir && o.language !== 'unreal')
      if (configured.length === 0)
        return { success: false, error: '출력 경로가 설정된 언어가 없습니다.' }

      const generated: string[] = []
      for (const o of configured) {
        protocService.generate(settings.protocPath, settings.protoDir, o.language, o.dir)
        generated.push(o.language)
      }
      return { success: true, data: generated }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Unreal C++ 헤더 생성
  ipcMain.handle(IPC.CODEGEN_GENERATE_UNREAL, async (): Promise<IpcResult<string[]>> => {
    try {
      const settings = settingsService.getResolved()
      if (!settings.protoDir)
        return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
      const unrealDir = settings.outputDirs.find((o) => o.language === 'unreal')?.dir
      if (!unrealDir) return { success: false, error: 'Unreal 출력 경로가 설정되지 않았습니다.' }

      const parsed = protoParser.parseDirectory(settings.protoDir)
      if (parsed.messages.length === 0 && parsed.enums.length === 0) {
        return { success: false, error: 'proto 파일에서 파싱된 메시지/Enum이 없습니다.' }
      }

      const files = unrealCodeGenerator.generate(parsed, unrealDir)
      return { success: true, data: files }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
