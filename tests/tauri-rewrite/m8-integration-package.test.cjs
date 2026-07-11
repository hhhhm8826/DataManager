const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M8: native E2E uses an isolated workspace and covers the core flow', () => {
  const config = read('apps/desktop/wdio.conf.mjs')
  const appDataConfig = read('apps/desktop/wdio.appdata.conf.mjs')
  const flow = read('tests/e2e/m8-core-flow.e2e.mjs')
  const appDataSave = read('tests/e2e/appdata/01-save-settings.e2e.mjs')
  const appDataReload = read('tests/e2e/appdata/02-reload-settings.e2e.mjs')
  const settings = read('apps/desktop/src-tauri/src/commands/settings.rs')
  const e2eTauri = JSON.parse(read('apps/desktop/src-tauri/tauri.e2e.conf.json'))
  const cargo = read('apps/desktop/src-tauri/Cargo.toml')
  const rustEntry = read('apps/desktop/src-tauri/src/lib.rs')
  const frontendEntry = read('apps/desktop/src/main.tsx')
  const edgeSetup = read('apps/desktop/scripts/prepare-edgedriver.mjs')
  const appDataCleanup = read('apps/desktop/scripts/cleanup-appdata-e2e.mjs')
  const edgePatch = read('patches/@wdio__tauri-service@1.2.0.patch')

  assert.match(config, /\.e2e-workspace/)
  assert.match(config, /DATAMANAGER_E2E_SETTINGS_PATH/)
  assert.match(config, /'cpp', 'csharp', 'java', 'python', 'go', 'rust', 'ruby', 'php'/)
  assert.match(config, /WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS \?\?= '--no-sandbox'/)
  assert.match(config, /driverProvider: 'embedded'/)
  assert.match(appDataConfig, /delete env\.DATAMANAGER_E2E_SETTINGS_PATH/)
  assert.match(appDataConfig, /\.e2e-appdata-profile/)
  assert.match(appDataConfig, /resetOwnedDirectory/)
  assert.match(appDataSave, /settings\.v2\.json/)
  assert.match(appDataReload, /fresh native application session/)
  assert.match(appDataCleanup, /Refusing to remove unexpected E2E path/)
  assert.match(appDataCleanup, /removeWithRetry/)
  assert.match(settings, /#\[cfg\(feature = "e2e"\)\]/)
  assert.equal(e2eTauri.app.withGlobalTauri, true)
  assert.match(e2eTauri.build.beforeBuildCommand, /--mode e2e/)
  assert.deepEqual(e2eTauri.app.security.capabilities[0].permissions, [
    'core:default',
    'core:window:default',
    'core:window:allow-set-size',
    'dialog:allow-open',
    'wdio:default',
    'wdio-webdriver:default'
  ])
  assert.match(cargo, /dep:tauri-plugin-wdio/)
  assert.match(rustEntry, /tauri_plugin_wdio::init/)
  assert.match(frontendEntry, /VITE_WDIO/)
  assert.match(frontendEntry, /@wdio\/tauri-plugin/)
  assert.match(edgeSetup, /\.e2e-runtime/)
  assert.match(edgePatch, /Microsoft Edge WebDriver/)
  assert.ok(edgePatch.includes('split(/\\r?\\n/)[0]?.trim()'))
  for (const marker of [
    "openArea('설정'",
    "openArea('테이블'",
    "openArea('관계도'",
    "openArea('Excel'",
    "openArea('코드 생성'",
    'exerciseSchemaCrud',
    'E2eTempTable.proto',
    'E2eStatusEnumType.proto',
    'Cancelling a referenced Message deletion',
    'Cancelling a referenced Enum deletion',
    'exerciseDiagramInteractions',
    'exerciseResponsiveDiagramLayout',
    'bodyOverflow',
    'toolbarDoesNotOverlap',
    'setNativeWindowSize',
    'populateWorkbooks',
    '백업 없이 덮어쓰기',
    '백업 후 생성',
    'assertResolvedRootJson',
    'exerciseExcelCancellationAndDiagnostics',
    '9_998',
    '작업이 취소되었습니다',
    'EXCEL_CELL_TYPE_MISMATCH',
    "'9개 성공'",
    'createCancellationFixtures',
    'PROTOC_EXECUTION_FAILED',
    '가져오기 검토',
    '이 설정 가져오기',
    'originalLegacyConfig',
    'RootTarget.json',
    'DataTables.h'
  ]) {
    assert.match(flow, new RegExp(marker.replace(/[()]/g, '\\$&')))
  }
  assert.match(flow, /plugin:window\|set_size/)
})

test('M8: Windows CI verifies, runs E2E, packages NSIS, and uploads the installer', () => {
  const rootPackage = JSON.parse(read('package.json'))
  const workflow = read('.github/workflows/windows.yml')
  const installerSmoke = read('scripts/windows-installer-smoke.ps1')
  const tauri = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json'))
  const capability = JSON.parse(read('apps/desktop/src-tauri/capabilities/main.json'))

  for (const marker of [
    'windows-latest',
    'pnpm install --frozen-lockfile',
    'pnpm format:check',
    'cargo test --all-features',
    'pnpm test:e2e',
    'pnpm tauri:build',
    'windows-installer-smoke.ps1',
    'target/release/bundle/nsis/*.exe'
  ]) {
    assert.match(workflow, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.deepEqual(tauri.bundle.targets, ['nsis'])
  assert.equal(tauri.bundle.useLocalToolsDir, true)
  assert.equal(tauri.app.windows[0].minWidth, 520)
  assert.deepEqual(capability.permissions, ['dialog:allow-open'])
  assert.match(installerSmoke, /Start-Process -FilePath \$installer/)
  assert.match(installerSmoke, /datamanager-desktop\.exe/)
  assert.match(installerSmoke, /DataManager-installer-profile-/)
  assert.match(installerSmoke, /LOCALAPPDATA/)
  assert.match(installerSmoke, /Restore-ProfileEnvironment/)
  assert.match(installerSmoke, /Remove-TemporaryProfile/)
  assert.match(installerSmoke, /Refusing to remove profile outside the temporary root/)
  assert.match(installerSmoke, /Start-Process -FilePath \$uninstaller/)
  assert.equal(rootPackage.scripts['interactive:smoke'], undefined)
  assert.equal(rootPackage.scripts['excel:smoke'], undefined)
  assert.match(read('docs/settings.md'), /experimental-codegen=enabled,kernel=upb/)
})

test('M8: rewrite examples regenerate separately from the legacy baseline', () => {
  const rootPackage = JSON.parse(read('package.json'))
  const generator = read('scripts/regenerate-rewrite-fixtures.ts')
  const fixture = read('tests/fixtures/m8-rewrite/README.md')
  const attributes = read('.gitattributes')
  const editorConfig = read('.editorconfig')

  assert.match(rootPackage.scripts.test, /fixtures:rewrite:check/)
  assert.match(rootPackage.scripts['fixtures:rewrite'], /--write/)
  assert.match(generator, /examplesRoot, 'TAURI_REWRITE'/)
  assert.match(
    generator,
    /protocLanguages = \['cpp', 'csharp', 'java', 'python', 'go', 'rust', 'ruby', 'php'\]/
  )
  assert.match(generator, /Refusing to reset unexpected examples path/)
  assert.match(fixture, /legacy baseline and stale repository examples remain separate/)
  assert.match(attributes, /^\* text=auto eol=lf$/m)
  for (const extension of ['exe', 'xlsx', 'png', 'ico', 'icns']) {
    assert.match(attributes, new RegExp(`^\\*\\.${extension} binary$`, 'm'))
  }
  assert.match(editorConfig, /^end_of_line = lf$/m)
})

test('M8: final active build is Tauri-only with baseline and rollback evidence', () => {
  const rootPackage = JSON.parse(read('package.json'))
  const workspace = read('pnpm-workspace.yaml')
  const readme = read('README.md')
  const migration = read('docs/migration.md')
  const dependencies = {
    ...(rootPackage.dependencies ?? {}),
    ...(rootPackage.devDependencies ?? {})
  }

  assert.equal(rootPackage.main, undefined)
  assert.equal(
    Object.keys(rootPackage.scripts).some((name) => name.startsWith('legacy:')),
    false
  )
  for (const packageName of [
    'electron',
    'electron-builder',
    'electron-store',
    'electron-vite',
    '@electron-toolkit/preload',
    '@electron-toolkit/utils'
  ]) {
    assert.equal(dependencies[packageName], undefined)
  }
  for (const relativePath of [
    'electron-builder.yml',
    'electron.vite.config.ts',
    'package-lock.json',
    'src/main/index.ts',
    'src/preload/index.ts',
    'src/renderer/index.html'
  ]) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, relativePath)), false)
  }
  assert.doesNotMatch(workspace, /^\s+electron(?:-winstaller)?:/m)
  assert.equal(fs.existsSync(path.join(repositoryRoot, 'tests/baseline/m0-golden.test.cjs')), true)
  assert.match(rootPackage.scripts.test, /test:baseline/)
  assert.match(readme, /활성 브랜치에는 Electron 런타임이나 빌드 경로가 없습니다/)
  assert.match(migration, /git worktree add/)
  assert.match(migration, /3a4ba6ec652d750d88c88dcc9af8ada13b6eb169/)
})
