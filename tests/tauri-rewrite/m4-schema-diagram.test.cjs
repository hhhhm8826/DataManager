const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repositoryRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
}

test('M4: fixture graph, deterministic layout, and unresolved references are contracted', () => {
  const graph = read('packages/core/src/schemaGraph.ts')
  const tests = read('packages/core/test/schemaGraph.test.ts')

  for (const api of ['buildSchemaGraph', 'layoutSchemaGraph', 'schemaGraphNeighbors']) {
    assert.match(graph, new RegExp(`export function ${api}`))
  }
  assert.match(tests, /M0 fixture node and reference-edge contract/)
  assert.match(tests, /'enum:FixtureState'/)
  assert.match(tests, /'RootTarget\.state->FixtureState'/)
  assert.match(tests, /surfaces unresolved non-primitive field types/)
})

test('M4: React Flow diagram includes interaction, search, hover, and detail surfaces', () => {
  const screen = read('apps/desktop/src/features/diagram/DiagramScreen.tsx')
  const tests = read('apps/desktop/test/DiagramScreen.test.tsx')

  for (const marker of [
    'ReactFlow',
    'MiniMap',
    'Controls',
    'onNodeMouseEnter',
    'onEdgeMouseEnter',
    'diagram-node-dimmed',
    'TypeDetailDialog',
    'projectSchemaDiagram',
    'layoutRunner',
    'savedLayout',
    'fileColors'
  ]) {
    assert.match(screen, new RegExp(marker))
  }
  assert.match(tests, /nonmatching search results/)
  assert.match(tests, /Status_ACTIVE/)
})

test('M4: six work areas, keyboard navigation, key exclusivity, and persisted layout are tested', () => {
  const app = read('apps/desktop/src/app/App.tsx')
  const appTests = read('apps/desktop/test/App.test.tsx')
  const schemaTests = read('apps/desktop/test/SchemaScreen.test.tsx')
  const nativeTests = read('apps/desktop/test/browserMockNativePort.test.ts')

  for (const label of ['관계도', '테이블', 'Enum', 'Excel', '코드 생성', '설정']) {
    assert.match(app, new RegExp(label))
  }
  assert.match(appTests, /supports keyboard activation/)
  assert.match(schemaTests, /one key-mode control/)
  assert.match(nativeTests, /new BrowserMockNativePort\(\)\.loadSettings/)
  assert.match(nativeTests, /fileColors/)
  assert.match(nativeTests, /maxNodesPerColumn/)
})
