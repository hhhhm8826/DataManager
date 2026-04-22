import Store from 'electron-store'
import { app } from 'electron'
import * as path from 'path'
import type { AppSettings } from '../../shared/types'

// 패키징 시: 실행 파일(.exe) 옆, 개발 시: 프로젝트 루트
const STORE_CWD = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()

// 상대경로는 STORE_CWD 기준으로 절대경로로 변환
export function resolvePath(p: string): string {
  if (!p) return p
  if (path.isAbsolute(p)) return p
  return path.resolve(STORE_CWD, p)
}

const DEFAULT_SETTINGS: AppSettings = {
  protoDir: '',
  excelDir: '',
  jsonDir: '',
  outputDirs: [],
  protocPath: '',
  fileColors: {},
  diagramMaxPerCol: 8
}

const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS,
  cwd: STORE_CWD
})

export class SettingsService {
  /** UI 표시용: config에 저장된 경로 그대로 반환 (상대경로 유지) */
  get(): AppSettings {
    return {
      protoDir: store.get('protoDir'),
      excelDir: store.get('excelDir'),
      jsonDir: store.get('jsonDir'),
      outputDirs: store.get('outputDirs'),
      protocPath: store.get('protocPath'),
      fileColors: (store.get('fileColors') as Record<string, string>) ?? {},
      diagramMaxPerCol: (store.get('diagramMaxPerCol') as number) ?? 8
    }
  }

  /** 파일 조작용: 상대경로를 STORE_CWD 기준 절대경로로 변환 */
  getResolved(): AppSettings {
    return {
      protoDir: resolvePath(store.get('protoDir')),
      excelDir: resolvePath(store.get('excelDir')),
      jsonDir: resolvePath(store.get('jsonDir')),
      outputDirs: store.get('outputDirs').map((o) => ({ ...o, dir: resolvePath(o.dir) })),
      protocPath: resolvePath(store.get('protocPath')),
      fileColors: (store.get('fileColors') as Record<string, string>) ?? {},
      diagramMaxPerCol: (store.get('diagramMaxPerCol') as number) ?? 8
    }
  }

  set(settings: Partial<AppSettings>): void {
    if (settings.protoDir !== undefined) store.set('protoDir', settings.protoDir)
    if (settings.excelDir !== undefined) store.set('excelDir', settings.excelDir)
    if (settings.jsonDir !== undefined) store.set('jsonDir', settings.jsonDir)
    if (settings.outputDirs !== undefined) store.set('outputDirs', settings.outputDirs)
    if (settings.protocPath !== undefined) store.set('protocPath', settings.protocPath)
    if (settings.fileColors !== undefined) store.set('fileColors', settings.fileColors)
    if (settings.diagramMaxPerCol !== undefined) store.set('diagramMaxPerCol', settings.diagramMaxPerCol)
  }
}

export const settingsService = new SettingsService()
