import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppSettings } from '@datamanager/core'
import { BrowserMockNativePort } from '../src/adapters/native/BrowserMockNativePort'

let storage: Map<string, string>
let promptResult: string | null

beforeEach(() => {
  storage = new Map<string, string>()
  promptResult = null
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    },
    prompt: () => promptResult
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BrowserMockNativePort', () => {
  it('persists validated versioned settings and trims a selected directory', async () => {
    const port = new BrowserMockNativePort()
    const saved = await port.saveSettings({
      ...defaultAppSettings,
      protoRoot: 'D:\\Workspace\\PROTO',
      diagram: {
        fileColors: { 'ItemTable.proto': '#2457a6' },
        maxNodesPerColumn: 12
      }
    })

    expect(await new BrowserMockNativePort().loadSettings()).toEqual(saved)

    promptResult = '  D:\\Workspace\\EXCEL  '
    await expect(port.selectDirectory()).resolves.toBe('D:\\Workspace\\EXCEL')
  })

  it('normalizes malformed persisted settings into a structured error', async () => {
    storage.set('datamanager.settings.v2', '{"version":99}')
    const port = new BrowserMockNativePort()

    await expect(port.loadSettings()).rejects.toMatchObject({
      code: 'NATIVE_UNKNOWN',
      context: {}
    })
  })
})
