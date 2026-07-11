import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(desktopDirectory, '..', '..')
const binaryName = process.platform === 'win32' ? 'datamanager-desktop.exe' : 'datamanager-desktop'
const binaryCandidates = [
  process.env.DATAMANAGER_E2E_BINARY,
  resolve(desktopDirectory, '..', '..', 'target', 'release', binaryName),
  resolve(desktopDirectory, 'src-tauri', 'target', 'release', binaryName)
].filter(Boolean)
const appBinaryPath =
  binaryCandidates.find((candidate) => existsSync(candidate)) ?? binaryCandidates[0]
const e2eWorkspace = resolve(repositoryDirectory, '.e2e-workspace')
const edgeDriverDirectory = resolve(repositoryDirectory, '.e2e-runtime', 'msedgedriver')

if (process.platform === 'win32' && existsSync(resolve(edgeDriverDirectory, 'msedgedriver.exe'))) {
  process.env.PATH = `${edgeDriverDirectory};${process.env.PATH ?? ''}`
}

prepareWorkspace()

function prepareWorkspace() {
  const protoRoot = resolve(e2eWorkspace, 'proto')
  const excelRoot = resolve(e2eWorkspace, 'excel')
  const jsonRoot = resolve(e2eWorkspace, 'json')
  const codeRoot = resolve(e2eWorkspace, 'code')
  const sourceRoot = resolve(repositoryDirectory, 'tests', 'fixtures', 'm0-legacy', 'proto')
  const selfReferenceSource = resolve(
    repositoryDirectory,
    'tests',
    'fixtures',
    'd1000-d1012',
    '긴 한글 경로',
    'PROTO',
    'CategoryTable.proto'
  )
  const protocRoot = resolve(repositoryDirectory, 'examples', 'PROTOC')
  const settingsPath = resolve(e2eWorkspace, 'settings.v2.json')

  rmSync(e2eWorkspace, { force: true, recursive: true })
  const protocLanguages = ['cpp', 'csharp', 'java', 'python', 'go', 'rust', 'ruby', 'php']
  for (const directory of [
    protoRoot,
    excelRoot,
    jsonRoot,
    ...protocLanguages.map((language) => resolve(codeRoot, language)),
    resolve(codeRoot, 'unreal')
  ]) {
    mkdirSync(directory, { recursive: true })
  }
  for (const fileName of readdirSync(sourceRoot).filter((fileName) =>
    fileName.endsWith('.proto')
  )) {
    copyFileSync(resolve(sourceRoot, fileName), resolve(protoRoot, fileName))
  }
  copyFileSync(selfReferenceSource, resolve(protoRoot, 'CategoryTable.proto'))
  writeFileSync(
    settingsPath,
    `${JSON.stringify(
      {
        version: 2,
        protoRoot,
        excelRoot,
        jsonRoot,
        codegenOutputs: [
          ...protocLanguages.map((language) => ({
            language,
            directory: resolve(codeRoot, language)
          })),
          { language: 'unreal', directory: resolve(codeRoot, 'unreal') }
        ],
        protocExecutable: resolve(protocRoot, 'protoc.exe'),
        diagram: { fileColors: {}, maxNodesPerColumn: 8 },
        legacyImport: null
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  Object.assign(process.env, {
    DATAMANAGER_E2E_SETTINGS_PATH: settingsPath,
    DATAMANAGER_E2E_WORKSPACE: e2eWorkspace
  })
}

if (process.platform === 'win32') {
  const profileDirectory =
    process.env.DATAMANAGER_E2E_PROFILE ?? resolve(repositoryDirectory, '.e2e-profile')
  const localAppData = resolve(profileDirectory, 'AppData', 'Local')
  const roamingAppData = resolve(profileDirectory, 'AppData', 'Roaming')

  mkdirSync(localAppData, { recursive: true })
  mkdirSync(roamingAppData, { recursive: true })

  Object.assign(process.env, {
    USERPROFILE: profileDirectory,
    HOME: profileDirectory,
    LOCALAPPDATA: localAppData,
    APPDATA: roamingAppData
  })
  process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ??= '--no-sandbox'
}

export const config = {
  runner: 'local',
  specs: [resolve(desktopDirectory, '..', '..', 'tests', 'e2e', '*.e2e.mjs')],
  maxInstances: 1,
  logLevel: 'warn',
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000
  },
  services: [
    [
      '@wdio/tauri-service',
      {
        appBinaryPath,
        driverProvider: 'embedded',
        autoDownloadEdgeDriver: false,
        captureBackendLogs: false,
        captureFrontendLogs: false
      }
    ]
  ],
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: appBinaryPath
      }
    }
  ]
}
