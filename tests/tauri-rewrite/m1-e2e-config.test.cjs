const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

test('M1: the root E2E command builds a Tauri binary with the embedded WebDriver provider', async () => {
  const rootPackage = require(path.join(repositoryRoot, 'package.json'))
  const desktopPackage = require(path.join(repositoryRoot, 'apps', 'desktop', 'package.json'))
  const e2eConfig = await import(
    pathToFileURL(path.join(repositoryRoot, 'apps', 'desktop', 'wdio.conf.mjs')).href
  )

  assert.equal(
    rootPackage.scripts['test:e2e'],
    'pnpm --filter @datamanager/desktop exec tauri build --features e2e --no-bundle --config src-tauri/tauri.e2e.conf.json && pnpm --filter @datamanager/desktop test:e2e'
  )
  assert.match(desktopPackage.scripts['test:e2e'], /prepare-edgedriver\.mjs/)
  assert.match(desktopPackage.scripts['test:e2e'], /wdio run/)
  assert.match(desktopPackage.scripts.lint, /wdio\.conf\.mjs/)
  assert.match(rootPackage.scripts.lint, /lint:e2e/)
  assert.match(rootPackage.scripts['lint:e2e'], /eslint\.e2e\.config\.mjs/)
  assert.equal(e2eConfig.config.framework, 'mocha')
  assert.equal(e2eConfig.config.services[0][0], '@wdio/tauri-service')
  assert.equal(e2eConfig.config.services[0][1].driverProvider, 'embedded')
  assert.equal(e2eConfig.config.services[0][1].autoDownloadEdgeDriver, false)
  assert.equal(e2eConfig.config.capabilities[0].browserName, 'tauri')
  assert.match(e2eConfig.config.specs[0], /tests[\\/]e2e/)
})
