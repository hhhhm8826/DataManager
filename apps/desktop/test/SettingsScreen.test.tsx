// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { defaultAppSettings, type AppSettings, type LegacyImportPreview } from '@datamanager/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type NativePort } from '../src/adapters/native/NativePort'
import { SettingsScreen } from '../src/features/settings/SettingsScreen'

afterEach(cleanup)

function createNativePort(overrides: Partial<NativePort> = {}): NativePort {
  return {
    loadSettings: async () => defaultAppSettings,
    saveSettings: async (settings) => settings,
    selectDirectory: async () => null,
    selectFile: async () => null,
    findLegacyConfig: async () => null,
    previewLegacyImport: async () => {
      throw new Error('No legacy config')
    },
    importLegacySettings: async () => {
      throw new Error('No legacy config')
    },
    listProtoFiles: async () => [],
    listExcelFiles: async () => [],
    checkCodegenEnvironment: async () => ({
      protocExecutable: 'protoc',
      protocVersion: 'libprotoc 30.2',
      plugins: []
    }),
    runProtocLanguage: async (language) => ({
      language,
      executable: 'protoc',
      args: [],
      cwd: '',
      outputDirectory: '',
      stdout: '',
      stderr: '',
      exitCode: 0
    }),
    writeUnrealFiles: async () => [],
    readFile: async () => new Uint8Array(),
    writeFile: async (path) => path,
    backupFile: async (path) => `${path}.backup`,
    openPath: async () => undefined,
    ...overrides
  }
}

describe('SettingsScreen', () => {
  it('uses the native port to select a directory and save versioned settings', async () => {
    const selectedDirectory = 'D:\\DataManager\\PROTO'
    const loadSettings = vi.fn(async (): Promise<AppSettings> => defaultAppSettings)
    const saveSettings = vi.fn(async (settings: AppSettings): Promise<AppSettings> => settings)
    const selectDirectory = vi.fn(async (): Promise<string> => selectedDirectory)
    const nativePort = createNativePort({ loadSettings, saveSettings, selectDirectory })
    const user = userEvent.setup()

    render(<SettingsScreen nativePort={nativePort} />)

    await waitFor(() => expect(loadSettings).toHaveBeenCalledTimes(1))
    const protoDirectory = await screen.findByRole('textbox', { name: 'Proto 루트' })
    await user.click(screen.getByRole('button', { name: 'Proto 루트 선택' }))
    await waitFor(() => expect((protoDirectory as HTMLInputElement).value).toBe(selectedDirectory))

    await user.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        ...defaultAppSettings,
        protoRoot: selectedDirectory
      })
    )
    expect(selectDirectory).toHaveBeenCalledWith(undefined)
  })

  it('keeps the diagram column limit within the settings contract', async () => {
    const nativePort = createNativePort()
    const user = userEvent.setup()

    render(<SettingsScreen nativePort={nativePort} />)

    const diagramLimit = await screen.findByRole('spinbutton', { name: '열당 최대 테이블 수' })
    await user.clear(diagramLimit)
    await user.type(diagramLimit, '7')
    expect((diagramLimit as HTMLInputElement).value).toBe('7')

    await user.clear(diagramLimit)
    await user.type(diagramLimit, '99')

    expect((diagramLimit as HTMLInputElement).value).toBe('50')
  })

  it('adds a known codegen language and selects its output directory', async () => {
    const outputDirectory = 'D:\\Generated\\Unreal'
    const saveSettings = vi.fn(async (settings: AppSettings) => settings)
    const selectDirectory = vi.fn(async () => outputDirectory)
    const nativePort = createNativePort({ saveSettings, selectDirectory })
    const user = userEvent.setup()

    render(<SettingsScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: '출력 추가' }))
    const language = screen.getByRole('combobox', { name: '출력 1 언어' })
    expect((language as HTMLSelectElement).value).toBe('cpp')
    await user.selectOptions(language, 'unreal')
    await user.click(screen.getByRole('button', { name: 'unreal 출력 디렉터리 선택' }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        ...defaultAppSettings,
        codegenOutputs: [{ language: 'unreal', directory: outputDirectory }]
      })
    )
  })

  it('shows a legacy dry-run before committing the one-time import', async () => {
    const sourcePath = 'D:\\DataManager\\config.json'
    const importedSettings: AppSettings = {
      ...defaultAppSettings,
      protoRoot: 'D:\\DataManager\\examples\\PROTO',
      legacyImport: { sourcePath, importedAtEpochMs: 1 }
    }
    const preview: LegacyImportPreview = {
      sourcePath,
      baseDirectory: 'D:\\DataManager',
      settings: { ...importedSettings, legacyImport: null },
      paths: [
        {
          field: 'protoDir',
          inputPath: './examples/PROTO',
          resolvedPath: importedSettings.protoRoot,
          kind: 'directory',
          status: 'ready',
          message: 'Directory is available.'
        }
      ]
    }
    const previewLegacyImport = vi.fn(async () => preview)
    const importLegacySettings = vi.fn(async () => importedSettings)
    const saveSettings = vi.fn(async (settings: AppSettings) => settings)
    const nativePort = createNativePort({
      findLegacyConfig: async () => sourcePath,
      previewLegacyImport,
      importLegacySettings,
      saveSettings
    })
    const user = userEvent.setup()

    render(<SettingsScreen nativePort={nativePort} />)

    await user.click(await screen.findByRole('button', { name: '가져오기 검토' }))
    expect(await screen.findByText(importedSettings.protoRoot)).toBeTruthy()
    expect(importLegacySettings).not.toHaveBeenCalled()
    expect(saveSettings).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '이 설정 가져오기' }))
    await waitFor(() => expect(importLegacySettings).toHaveBeenCalledWith(sourcePath))
    expect(saveSettings).not.toHaveBeenCalled()
  })
})
