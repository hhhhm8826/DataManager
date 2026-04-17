import Store from 'electron-store'
import type { AppSettings } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  protoDir: '',
  excelDir: '',
  jsonDir: '',
  outputDirs: []
}

const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS
})

export class SettingsService {
  get(): AppSettings {
    return {
      protoDir: store.get('protoDir'),
      excelDir: store.get('excelDir'),
      jsonDir: store.get('jsonDir'),
      outputDirs: store.get('outputDirs')
    }
  }

  set(settings: Partial<AppSettings>): void {
    if (settings.protoDir !== undefined) store.set('protoDir', settings.protoDir)
    if (settings.excelDir !== undefined) store.set('excelDir', settings.excelDir)
    if (settings.jsonDir !== undefined) store.set('jsonDir', settings.jsonDir)
    if (settings.outputDirs !== undefined) store.set('outputDirs', settings.outputDirs)
  }
}

export const settingsService = new SettingsService()
