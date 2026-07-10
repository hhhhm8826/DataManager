const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')
const fixtureRoot = path.join(repositoryRoot, 'tests', 'fixtures', 'm0-legacy')

function read(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

test('M0: preserved schema golden covers every compatibility case', () => {
  const schema = readJson(path.join('expected', 'parsed-schema.json'))
  const messages = new Map(schema.messages.map((message) => [message.name, message]))

  assert.deepEqual(messages.get('SingleTarget').pkFields, ['id'])
  assert.deepEqual(messages.get('CompositeTarget').pkFields, ['region', 'id'])
  assert.deepEqual(messages.get('GroupTarget').keyFields, ['groupId'])
  assert.deepEqual(messages.get('NoKeyTarget').pkFields, [])
  assert.deepEqual(messages.get('NoKeyTarget').keyFields, [])
  assert.equal(
    messages.get('MiddleTarget').fields.some((field) => field.type === 'SingleTarget'),
    true
  )
  assert.equal(
    messages.get('CycleA').fields.some((field) => field.type === 'CycleB'),
    true
  )
  assert.equal(
    messages.get('CycleB').fields.some((field) => field.type === 'CycleA'),
    true
  )
  assert.equal(
    schema.enums.some((value) => value.name === 'FixtureState'),
    true
  )

  const proto = ['FixtureEnumType.proto', 'KeyTable.proto', 'ReferenceTable.proto']
    .map((fileName) => read(path.join('proto', fileName)))
    .join('\n')
  assert.match(proto, /\/\/ @PK/)
  assert.match(proto, /\/\/ @Key/)
})

test('M0: preserved JSON and Unreal goldens retain legacy observations', () => {
  const rootText = read(path.join('expected', 'RootTarget.json'))
  const rows = JSON.parse(rootText)

  assert.equal(rootText.endsWith('\n'), true)
  assert.equal(Array.isArray(rows[0].composite), true)
  assert.equal(Array.isArray(rows[0].group), true)
  assert.equal(rows[0].single.id, 1)
  assert.equal(rows[0].middle.single.id, 1)
  assert.equal(rows[0].noKey, 'not-resolved')
  assert.equal(rows[1].single, 999)
  assert.equal(rows[1].group, 999)

  const unrealHashes = readJson(path.join('expected', 'unreal-sha256.json'))
  assert.deepEqual(Object.keys(unrealHashes).sort(), [
    'DataTableLoader.cpp',
    'DataTableLoader.h',
    'DataTables.h',
    'FixtureEnumType.h'
  ])
  assert.equal(
    Object.values(unrealHashes).every((hash) => /^[a-f0-9]{64}$/.test(hash)),
    true
  )
})
