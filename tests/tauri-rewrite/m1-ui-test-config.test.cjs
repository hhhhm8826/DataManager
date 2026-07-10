const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

test('M1: desktop Vitest config supports React Testing Library settings tests', () => {
  const desktopPackage = require(path.join(repositoryRoot, 'apps', 'desktop', 'package.json'))
  const configPath = path.join(repositoryRoot, 'apps', 'desktop', 'vitest.config.ts')
  const testPath = path.join(repositoryRoot, 'apps', 'desktop', 'test', 'SettingsScreen.test.tsx')
  const config = fs.readFileSync(configPath, 'utf8')
  const settingsTest = fs.readFileSync(testPath, 'utf8')

  assert.equal(desktopPackage.devDependencies['@testing-library/dom'], '10.4.1')
  assert.equal(desktopPackage.devDependencies['@testing-library/react'], '16.3.2')
  assert.equal(desktopPackage.devDependencies['@testing-library/user-event'], '14.6.1')
  assert.equal(desktopPackage.devDependencies.jsdom, '29.1.1')
  assert.match(config, /@tauri-apps\/api\/core/)
  assert.match(settingsTest, /@testing-library\/react/)
  assert.match(settingsTest, /nativePort=\{nativePort\}/)
})
