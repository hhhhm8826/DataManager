import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { env, platform } from 'node:process'
import { fileURLToPath } from 'node:url'

const desktopDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(desktopDirectory, '..', '..')
const binaryName = platform === 'win32' ? 'datamanager-desktop.exe' : 'datamanager-desktop'
const binaryCandidates = [
  env.DATAMANAGER_E2E_BINARY,
  resolve(repositoryDirectory, 'target', 'release', binaryName),
  resolve(desktopDirectory, 'src-tauri', 'target', 'release', binaryName)
].filter(Boolean)
const appBinaryPath =
  binaryCandidates.find((candidate) => existsSync(candidate)) ?? binaryCandidates[0]
const edgeDriverDirectory = resolve(repositoryDirectory, '.e2e-runtime', 'msedgedriver')
const profileDirectory = resolve(repositoryDirectory, '.e2e-appdata-profile')
const workspaceDirectory = resolve(repositoryDirectory, '.e2e-appdata-workspace')

if (platform === 'win32' && existsSync(resolve(edgeDriverDirectory, 'msedgedriver.exe'))) {
  env.PATH = `${edgeDriverDirectory};${env.PATH ?? ''}`
}

function prepareAppDataWorkspace() {
  resetOwnedDirectory(profileDirectory, '.e2e-appdata-profile')
  resetOwnedDirectory(workspaceDirectory, '.e2e-appdata-workspace')

  const protoRoot = resolve(workspaceDirectory, 'proto')
  const excelRoot = resolve(workspaceDirectory, 'excel')
  const jsonRoot = resolve(workspaceDirectory, 'json')
  const sourceRoot = resolve(repositoryDirectory, 'tests', 'fixtures', 'm0-legacy', 'proto')
  for (const directory of [protoRoot, excelRoot, jsonRoot]) {
    mkdirSync(directory, { recursive: true })
  }
  for (const fileName of readdirSync(sourceRoot).filter((name) => name.endsWith('.proto'))) {
    copyFileSync(resolve(sourceRoot, fileName), resolve(protoRoot, fileName))
  }

  const localAppData = resolve(profileDirectory, 'AppData', 'Local')
  const roamingAppData = resolve(profileDirectory, 'AppData', 'Roaming')
  mkdirSync(localAppData, { recursive: true })
  mkdirSync(roamingAppData, { recursive: true })

  delete env.DATAMANAGER_E2E_SETTINGS_PATH
  delete env.DATAMANAGER_E2E_WORKSPACE
  Object.assign(env, {
    USERPROFILE: profileDirectory,
    HOME: profileDirectory,
    LOCALAPPDATA: localAppData,
    APPDATA: roamingAppData,
    DATAMANAGER_E2E_APPDATA_PROFILE: profileDirectory,
    DATAMANAGER_E2E_APPDATA_PROTO_ROOT: protoRoot,
    DATAMANAGER_E2E_APPDATA_EXCEL_ROOT: excelRoot,
    DATAMANAGER_E2E_APPDATA_JSON_ROOT: jsonRoot
  })
  env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ??= '--no-sandbox'
}

function resetOwnedDirectory(path, expectedName) {
  removeOwnedDirectory(path, expectedName)
  mkdirSync(path, { recursive: true })
}

function removeOwnedDirectory(path, expectedName) {
  if (dirname(path) !== repositoryDirectory || basename(path) !== expectedName) {
    throw new Error(`Refusing to reset unexpected E2E path: ${path}`)
  }
  rmSync(path, { force: true, maxRetries: 5, recursive: true, retryDelay: 200 })
}

export const config = {
  runner: 'local',
  specs: [resolve(repositoryDirectory, 'tests', 'e2e', 'appdata', '*.e2e.mjs')],
  maxInstances: 1,
  logLevel: 'warn',
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 30_000 },
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
      'tauri:options': { application: appBinaryPath }
    }
  ],
  onPrepare() {
    prepareAppDataWorkspace()
  }
}
