import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { env } from 'node:process'

describe('M1 default AppData persistence', () => {
  it('saves settings through the default application data path', async () => {
    const profile = requiredEnvironment('DATAMANAGER_E2E_APPDATA_PROFILE')
    const protoRoot = requiredEnvironment('DATAMANAGER_E2E_APPDATA_PROTO_ROOT')
    const excelRoot = requiredEnvironment('DATAMANAGER_E2E_APPDATA_EXCEL_ROOT')
    const jsonRoot = requiredEnvironment('DATAMANAGER_E2E_APPDATA_JSON_ROOT')

    await openSettings()
    await setInput('Proto 루트', protoRoot)
    await setInput('Excel 루트', excelRoot)
    await setInput('JSON 루트', jsonRoot)
    await setInput('열당 최대 테이블 수', '17')
    await clickButton('저장')
    await waitForToast('설정을 저장했습니다.')

    const settingsPath = await waitForSettingsPath(profile)
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    if (
      settings.protoRoot !== protoRoot ||
      settings.excelRoot !== excelRoot ||
      settings.jsonRoot !== jsonRoot ||
      settings.diagram?.maxNodesPerColumn !== 17
    ) {
      throw new Error(`Default AppData settings were not persisted: ${JSON.stringify(settings)}`)
    }
  })
})

async function openSettings() {
  await clickButton('설정')
  const heading = await $('h2=설정')
  await heading.waitForDisplayed()
}

async function setInput(label, value) {
  const input = await $(`[aria-label="${label}"]`)
  await input.waitForDisplayed()
  await input.setValue(value)
}

async function clickButton(name) {
  const button = await $(`button=${name}`)
  await button.waitForClickable()
  await button.click()
}

async function waitForToast(expected) {
  const toast = await $('[data-sonner-toast]')
  await toast.waitForDisplayed()
  if (!(await toast.getText()).includes(expected)) throw new Error(`Expected toast '${expected}'.`)
}

async function waitForSettingsPath(profile) {
  let path
  await browser.waitUntil(
    async () => {
      path = findFile(profile, 'settings.v2.json')
      return Boolean(path && existsSync(path))
    },
    { timeoutMsg: `settings.v2.json was not written below ${profile}.` }
  )
  return path
}

function findFile(root, name) {
  if (!existsSync(root)) return undefined
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) {
      const found = findFile(path, name)
      if (found) return found
    } else if (entry.name === name) {
      return path
    }
  }
  return undefined
}

function requiredEnvironment(name) {
  const value = env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}
