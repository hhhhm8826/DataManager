const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')
const nativeRoot = path.join(repositoryRoot, 'apps', 'desktop', 'src-tauri')

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(nativeRoot, relativePath), 'utf8'))
}

function readNativeSource(relativePath) {
  return fs.readFileSync(path.join(nativeRoot, relativePath), 'utf8')
}

test('M1: the main window is limited to the dialog open permission', () => {
  const config = readJson('tauri.conf.json')
  const capability = readJson(path.join('capabilities', 'main.json'))

  assert.deepEqual(config.app.security.capabilities, ['main-capability'])
  assert.deepEqual(capability.windows, ['main'])
  assert.deepEqual(capability.permissions, ['dialog:allow-open'])
})

test('M1: native settings commands stage and replace writes without deleting the target', () => {
  const settingsSource = readNativeSource(path.join('src', 'commands', 'settings.rs'))
  const appSource = readNativeSource(path.join('src', 'lib.rs'))

  assert.match(settingsSource, /\.create_new\(true\)/)
  assert.match(settingsSource, /file\.sync_all\(\)\?;/)
  assert.match(settingsSource, /fs::rename\(temporary_path, target_path\)/)
  assert.doesNotMatch(settingsSource, /fs::remove_file\(path\)/)
  assert.match(settingsSource, /atomic_write_replaces_an_existing_settings_file/)
  assert.match(settingsSource, /failed_replacement_preserves_the_original/)
  assert.match(appSource, /commands::settings::load_settings/)
  assert.match(appSource, /commands::settings::save_settings/)
})
