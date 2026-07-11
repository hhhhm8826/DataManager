const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const test = require('node:test')

const root = resolve(__dirname, '..', '..')

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('G2 projection keeps semantic Enum data while projecting only Message nodes', () => {
  const projection = read('packages/core/src/diagramProjection.ts')
  const tests = read('packages/core/test/diagramProjection.test.ts')

  assert.match(projection, /export function projectSchemaDiagram/)
  assert.match(projection, /enumReferences/)
  assert.match(projection, /incomingEdges\.get\(edge\.target\)/)
  assert.match(tests, /incoming-reference threshold/)
  assert.match(tests, /outgoing count/)
})

test('G2 ELK worker and geometry replace the deprecated desktop grid input', () => {
  const desktopPackage = JSON.parse(read('apps/desktop/package.json'))
  const screen = read('apps/desktop/src/features/diagram/DiagramScreen.tsx')
  const layout = read('apps/desktop/src/features/diagram/diagramLayout.ts')
  const engine = read('apps/desktop/src/features/diagram/diagramLayoutEngine.ts')
  const geometryTests = read('packages/core/test/diagramGeometry.test.ts')

  assert.equal(desktopPackage.dependencies.elkjs, '0.11.1')
  assert.doesNotMatch(screen, /layoutSchemaGraph|maxNodesPerColumn/)
  assert.match(layout, /layoutDiagramWithElk/)
  assert.match(engine, /elk-worker\.min\.js\?url/)
  assert.match(engine, /new ELKConstructor\(\{ workerUrl: elkWorkerUrl \}\)/)
  assert.match(engine, /ORTHOGONAL/)
  assert.match(engine, /source::\$\{edge\.fieldName\}/)
  assert.match(geometryTests, /non-overlapping fallback/)
  assert.match(geometryTests, /long collinear shared segments/)
})

test('G2 UI exposes modal table type buttons and explicit layout persistence', () => {
  const screen = read('apps/desktop/src/features/diagram/DiagramScreen.tsx')
  const tests = read('apps/desktop/test/DiagramScreen.test.tsx')

  for (const marker of [
    'TypeDetailDialog',
    '연결 모달 기준',
    '모달 테이블',
    '배치 저장',
    '저장 배치 불러오기',
    '저장 배치 삭제',
    '저장되지 않은 배치'
  ]) {
    assert.match(screen, new RegExp(marker))
  }
  assert.match(tests, /document\.activeElement\)\.toBe\(enumButton\)/)
  assert.match(tests, /persists valid thresholds/)
  assert.match(tests, /incoming-threshold modal tables/)
  assert.match(tests, /keeps saved coordinates for currently hidden Messages/)
})
