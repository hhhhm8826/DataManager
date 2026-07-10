import { env } from 'node:process'

describe('M1 default AppData restart', () => {
  it('reloads settings in a fresh native application session', async () => {
    await clickButton('설정')
    await (await $('h2=설정')).waitForDisplayed()

    await assertInput('Proto 루트', requiredEnvironment('DATAMANAGER_E2E_APPDATA_PROTO_ROOT'))
    await assertInput('Excel 루트', requiredEnvironment('DATAMANAGER_E2E_APPDATA_EXCEL_ROOT'))
    await assertInput('JSON 루트', requiredEnvironment('DATAMANAGER_E2E_APPDATA_JSON_ROOT'))
    await assertInput('열당 최대 테이블 수', '17')
  })
})

async function assertInput(label, expected) {
  const input = await $(`[aria-label="${label}"]`)
  await input.waitForDisplayed()
  const actual = await input.getValue()
  if (actual !== expected) throw new Error(`${label} expected '${expected}', received '${actual}'.`)
}

async function clickButton(name) {
  const button = await $(`button=${name}`)
  await button.waitForClickable()
  await button.click()
}

function requiredEnvironment(name) {
  const value = env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}
