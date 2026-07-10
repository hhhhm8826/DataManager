import { rmSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const repositoryDirectory = resolve(import.meta.dirname, '..', '..', '..')
const targets = [
  [resolve(repositoryDirectory, '.e2e-appdata-profile'), '.e2e-appdata-profile'],
  [resolve(repositoryDirectory, '.e2e-appdata-workspace'), '.e2e-appdata-workspace']
]

for (const [path, expectedName] of targets) {
  if (dirname(path) !== repositoryDirectory || basename(path) !== expectedName) {
    throw new Error(`Refusing to remove unexpected E2E path: ${path}`)
  }
  await removeWithRetry(path)
}

async function removeWithRetry(path) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      rmSync(path, { force: true, maxRetries: 2, recursive: true, retryDelay: 100 })
      return
    } catch (error) {
      if (attempt === 20) throw error
      await delay(250)
    }
  }
}
