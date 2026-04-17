import Store from 'electron-store'
import { app } from 'electron'
import * as path from 'path'
import type { AppSettings } from '../../shared/types'

// 패키징 시: 실행 파일(.exe) 옆, 개발 시: 프로젝트 루트
const STORE_CWD = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : app.getAppPath()

const DEFAULT_SETTINGS: AppSettings = {
  protoDir: '',
  excelDir: '',
  jsonDir: '',
  outputDirs: [],
  protocPath: ''
}

const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS,
  cwd: STORE_CWD
})

export class SettingsService {
  get(): AppSettings {
    return {
      protoDir: store.get('protoDir'),
      excelDir: store.get('excelDir'),
      jsonDir: store.get('jsonDir'),
      outputDirs: store.get('outputDirs'),
      protocPath: store.get('protocPath')
    }
  }

  set(settings: Partial<AppSettings>): void {
    if (settings.protoDir !== undefined) store.set('protoDir', settings.protoDir)
    if (settings.excelDir !== undefined) store.set('excelDir', settings.excelDir)
    if (settings.jsonDir !== undefined) store.set('jsonDir', settings.jsonDir)
    if (settings.outputDirs !== undefined) store.set('outputDirs', settings.outputDirs)
    if (settings.protocPath !== undefined) store.set('protocPath', settings.protocPath)
  }
}

export const settingsService = new SettingsService()
