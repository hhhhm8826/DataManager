const assert = require('node:assert/strict')
const { readdirSync, readFileSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')
const test = require('node:test')

const root = resolve(__dirname, '..', '..')
const catalogSource = readFileSync(join(root, 'packages/core/src/diagnostics.ts'), 'utf8')
const prefixes = [...catalogSource.matchAll(/^\s+'([A-Z0-9]+_)',?$/gm)].map((match) => match[1])
const familyEntries = new Set(
  [...catalogSource.matchAll(/^\s+([A-Z0-9]+_):\s*\{/gm)].map((match) => match[1])
)

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx|rs)$/.test(name) ? [path] : []
  })
}

function diagnosticCodes(source) {
  const pattern =
    /(?:code\s*:\s*|(?:validationError|diagnostic|jsonDiagnostic|excelDiagnostic|editFailure|internalPatchFailure)\s*\(\s*|(?:NativeError|CommandError)::new\s*\(\s*)['"]([A-Z][A-Z0-9_]+)['"]/g
  return [...source.matchAll(pattern)].map((match) => match[1])
}

test('every first-party diagnostic code has a registered Korean fallback family', () => {
  assert.ok(prefixes.length >= 10)
  for (const prefix of prefixes) assert.ok(familyEntries.has(prefix), `missing family ${prefix}`)

  const files = [
    ...sourceFiles(join(root, 'packages/core/src')),
    ...sourceFiles(join(root, 'apps/desktop/src')),
    ...sourceFiles(join(root, 'apps/desktop/src-tauri/src'))
  ]
  const codes = new Set(files.flatMap((path) => diagnosticCodes(readFileSync(path, 'utf8'))))
  assert.ok(codes.size >= 90, `expected broad code coverage, found ${codes.size}`)
  for (const code of codes) {
    assert.ok(
      prefixes.some((prefix) => code.startsWith(prefix)),
      `unregistered code ${code}`
    )
  }
})

test('mixed primary/group key conflict has a dedicated Korean catalog entry', () => {
  assert.match(catalogSource, /PROTO_MESSAGE_KEY_MODE_CONFLICT:\s*\{/)
  assert.match(catalogSource, /기본키와 합성키를 함께 사용할 수 없습니다/)
})
