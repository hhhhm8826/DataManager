/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const TypeScript = require('typescript')

const repositoryRoot = path.resolve(__dirname, '..', '..')
const storage = new Map()
let promptResult = null
let invokeHandler = async () => {
  throw new Error('Tauri invoke handler was not configured.')
}
let dialogOpenHandler = async () => null

global.window = {
  localStorage: {
    getItem(key) {
      return storage.get(key) ?? null
    },
    setItem(key, value) {
      storage.set(key, value)
    }
  },
  prompt() {
    return promptResult
  }
}

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = TypeScript.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: TypeScript.ModuleKind.CommonJS,
      target: TypeScript.ScriptTarget.ES2022
    }
  }).outputText
  module._compile(output, filename, 'commonjs')
}

const core = require(path.join(repositoryRoot, 'packages', 'core', 'src', 'settings.ts'))
const originalModuleLoad = Module._load
Module._load = function loadWorkspaceCore(request, parent, isMain) {
  if (request === '@datamanager/core') return core
  if (request === '@tauri-apps/api/core') {
    return {
      invoke: (...args) => invokeHandler(...args)
    }
  }
  if (request === '@tauri-apps/plugin-dialog') {
    return {
      open: (...args) => dialogOpenHandler(...args)
    }
  }
  return originalModuleLoad.call(this, request, parent, isMain)
}

const { BrowserMockNativePort } = require(
  path.join(
    repositoryRoot,
    'apps',
    'desktop',
    'src',
    'adapters',
    'native',
    'BrowserMockNativePort.ts'
  )
)
const { TauriNativePort } = require(
  path.join(repositoryRoot, 'apps', 'desktop', 'src', 'adapters', 'native', 'TauriNativePort.ts')
)

test('M1: browser native bridge persists and validates versioned settings', async () => {
  const port = new BrowserMockNativePort()
  const initial = await port.loadSettings()
  assert.deepEqual(initial, core.defaultAppSettings)

  const saved = await port.saveSettings({
    ...initial,
    protoRoot: 'D:\\Workspace\\PROTO',
    diagram: { ...initial.diagram, maxNodesPerColumn: 12 }
  })
  assert.equal(saved.protoRoot, 'D:\\Workspace\\PROTO')
  assert.equal(saved.diagram.maxNodesPerColumn, 12)

  const reloaded = await port.loadSettings()
  assert.deepEqual(reloaded, saved)

  promptResult = '  D:\\Workspace\\EXCEL  '
  assert.equal(await port.selectDirectory(), 'D:\\Workspace\\EXCEL')
})

test('M1: browser native bridge reports corrupted persisted settings as a structured error', async () => {
  storage.set('datamanager.settings.v2', '{"version":99}')
  const port = new BrowserMockNativePort()

  await assert.rejects(port.loadSettings(), (error) => {
    assert.equal(error.code, 'NATIVE_VALIDATION_FAILED')
    assert.equal(typeof error.message, 'string')
    return true
  })
})

test('M1: Tauri bridge preserves serialized native errors and validates settings before invoke', async () => {
  const nativeError = {
    code: 'SETTINGS_READ_FAILED',
    message: 'Unable to read settings.',
    context: { path: 'D:\\DataManager\\settings.v2.json' }
  }
  const port = new TauriNativePort()
  let invokeCalls = 0
  let savedSettings = null

  invokeHandler = async (command, payload) => {
    invokeCalls += 1
    if (command === 'load_settings') throw JSON.stringify(nativeError)
    assert.equal(command, 'save_settings')
    savedSettings = payload.settings
    return payload.settings
  }
  dialogOpenHandler = async (options) => {
    assert.deepEqual(options, {
      directory: true,
      multiple: false,
      title: '폴더 선택',
      defaultPath: 'D:\\DataManager\\PROTO'
    })
    return 'D:\\DataManager\\EXCEL'
  }

  await assert.rejects(port.loadSettings(), (error) => {
    assert.deepEqual(error, nativeError)
    return true
  })

  await assert.rejects(
    port.saveSettings({
      ...core.defaultAppSettings,
      diagram: { ...core.defaultAppSettings.diagram, maxNodesPerColumn: 0 }
    }),
    (error) => {
      assert.equal(error.code, 'NATIVE_VALIDATION_FAILED')
      return true
    }
  )
  assert.equal(invokeCalls, 1)

  const settings = { ...core.defaultAppSettings, protoRoot: 'D:\\DataManager\\PROTO' }
  assert.deepEqual(await port.saveSettings(settings), settings)
  assert.deepEqual(savedSettings, settings)
  assert.equal(invokeCalls, 2)

  invokeHandler = async () => {
    invokeCalls += 1
    throw new Error(JSON.stringify(nativeError))
  }
  await assert.rejects(port.loadSettings(), (error) => {
    assert.deepEqual(error, nativeError)
    return true
  })
  assert.equal(invokeCalls, 3)

  assert.equal(await port.selectDirectory(settings.protoRoot), 'D:\\DataManager\\EXCEL')
})
