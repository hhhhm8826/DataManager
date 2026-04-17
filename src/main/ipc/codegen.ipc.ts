import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { codeGeneratorService } from '../services/CodeGeneratorService'
import { protoParserService } from '../services/ProtoParserService'
import { settingsService } from '../services/SettingsService'
import type { IpcResult } from '../../shared/types'

export function registerCodegenIpc(): void {
  // 등록된 언어 목록 반환
  ipcMain.handle(IPC.CODEGEN_LIST_LANGUAGES, (): IpcResult<string[]> => {
    return { success: true, data: codeGeneratorService.getSupportedLanguages() }
  })

  // 특정 언어 코드 생성
  ipcMain.handle(
    IPC.CODEGEN_GENERATE,
    async (_event, language: string): Promise<IpcResult> => {
      try {
        const settings = settingsService.get()
        if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }

        const targetOutput = settings.outputDirs.find((o) => o.language === language)
        if (!targetOutput?.dir) return { success: false, error: `${language} 출력 경로가 설정되지 않았습니다.` }

        const parsed = protoParserService.parseDirectory(settings.protoDir)
        if (parsed.errors.length > 0) return { success: false, error: parsed.errors.join('\n') }

        codeGeneratorService.generate(language, parsed.messages, parsed.enums, targetOutput.dir)
        return { success: true }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // 설정된 모든 언어 일괄 생성
  ipcMain.handle(IPC.CODEGEN_GENERATE_ALL, async (): Promise<IpcResult<string[]>> => {
    try {
      const settings = settingsService.get()
      if (!settings.protoDir) return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }

      const parsed = protoParserService.parseDirectory(settings.protoDir)
      if (parsed.errors.length > 0) return { success: false, error: parsed.errors.join('\n') }

      const configured = settings.outputDirs.filter((o) => o.dir)
      if (configured.length === 0) return { success: false, error: '출력 경로가 설정된 언어가 없습니다.' }

      const generated: string[] = []
      for (const o of configured) {
        codeGeneratorService.generate(o.language, parsed.messages, parsed.enums, o.dir)
        generated.push(o.language)
      }
      return { success: true, data: generated }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}

