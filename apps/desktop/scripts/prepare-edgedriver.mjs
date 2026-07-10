import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { platform, stdout } from 'node:process'
import { download } from 'edgedriver'

if (platform === 'win32') {
  const repositoryDirectory = resolve(import.meta.dirname, '..', '..', '..')
  const cacheDirectory = resolve(repositoryDirectory, '.e2e-runtime', 'msedgedriver')
  const driverPath = resolve(cacheDirectory, 'msedgedriver.exe')
  const webViewVersion = detectWebViewVersion()

  if (existsSync(driverPath) && driverMajor(driverPath) !== major(webViewVersion)) {
    rmSync(driverPath, { force: true })
  }
  const downloadedPath = await download(webViewVersion, cacheDirectory)
  const downloadedMajor = driverMajor(downloadedPath)
  if (downloadedMajor !== major(webViewVersion)) {
    throw new Error(
      `EdgeDriver ${downloadedMajor} does not match WebView2 ${major(webViewVersion)}.`
    )
  }
  stdout.write(`EdgeDriver ready: ${downloadedPath}\n`)
}

function detectWebViewVersion() {
  const registryPaths = [
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  ]
  for (const registryPath of registryPaths) {
    try {
      const output = execFileSync('reg.exe', ['query', registryPath, '/v', 'pv'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      })
      const match = output.match(/pv\s+REG_SZ\s+([\d.]+)/)
      if (match?.[1]) return match[1]
    } catch {
      // Try the next machine/user registry location.
    }
  }
  throw new Error('Microsoft Edge WebView2 runtime version was not found.')
}

function driverMajor(path) {
  const output = execFileSync(path, ['--version'], { encoding: 'utf8' })
  const match = output.match(/(?:MSEdgeDriver|Microsoft Edge WebDriver)\s+([\d.]+)/)
  if (!match?.[1]) throw new Error(`Could not read EdgeDriver version from ${path}.`)
  return major(match[1])
}

function major(version) {
  return version.split('.')[0]
}
