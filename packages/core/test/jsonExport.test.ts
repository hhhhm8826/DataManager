import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ExcelReadResult } from '../src/excel'
import {
  collectJsonExportDependencies,
  exportResolvedJson,
  JSON_REFERENCE_EXPANSION_LIMIT
} from '../src/jsonExport'
import { parseProtoWorkspace } from '../src/proto/workspace'

const fixtureRoot = resolve(import.meta.dirname, '..', '..', '..', 'tests', 'fixtures', 'm0-legacy')

function fixture() {
  const workspace = parseProtoWorkspace(
    ['FixtureEnumType.proto', 'KeyTable.proto', 'ReferenceTable.proto'].map((sourceFile) => ({
      sourceFile,
      source: readFileSync(resolve(fixtureRoot, 'proto', sourceFile), 'utf8')
    }))
  )
  const data = JSON.parse(readFileSync(resolve(fixtureRoot, 'data.json'), 'utf8')) as Record<
    string,
    Array<Record<string, string | number | boolean | null>>
  >
  const results: ExcelReadResult[] = workspace.messages.map((message) => ({
    sourceFile: message.sourceFile,
    messageName: message.name,
    rows: data[message.name] ?? []
  }))
  return { workspace, results }
}

function selfFixture(rows: ExcelReadResult['rows']) {
  const workspace = parseProtoWorkspace([
    {
      sourceFile: 'CategoryTable.proto',
      source: `syntax = "proto3";
message Category {
  // @PK
  int32 id = 1;
  string name = 2;
  Category parent = 3;
}
`
    }
  ])
  return {
    workspace,
    results: [{ sourceFile: 'CategoryTable.proto', messageName: 'Category', rows }]
  }
}

describe('resolved JSON export', () => {
  it('collects dependencies and preserves single, composite, group, and multi-level shapes as byte-identical JSON', () => {
    const { workspace, results } = fixture()
    const root = results.find(({ messageName }) => messageName === 'RootTarget')!
    root.rows = [{ ...root.rows[0]!, noKey: null }]
    const exported = exportResolvedJson(workspace, results, ['RootTarget'])

    expect(exported.diagnostics).toEqual([])
    expect(exported.order.at(-1)).toBe('RootTarget')
    const rootFile = exported.files.find(({ messageName }) => messageName === 'RootTarget')!
    const rows = JSON.parse(rootFile.contents) as Array<Record<string, unknown>>
    expect(rows[0]?.single).toMatchObject({ id: 1, label: 'Alpha' })
    expect(rows[0]?.composite).toEqual([
      { region: 1, id: 1, label: 'North A' },
      { region: 1, id: 2, label: 'North B' }
    ])
    expect(rows[0]?.group).toEqual([
      { groupId: 10, label: 'Reward A' },
      { groupId: 10, label: 'Reward B' }
    ])
    expect(rows[0]?.middle).toMatchObject({
      id: 100,
      single: { id: 1, label: 'Alpha', state: 'FixtureState_ACTIVE' }
    })
    expect(rootFile.contents.endsWith('\n')).toBe(true)
    expect(exportResolvedJson(workspace, results, ['RootTarget']).files).toEqual(exported.files)
  })

  it('returns no files and location-rich diagnostics for missing references', () => {
    const { workspace, results } = fixture()
    const root = results.find(({ messageName }) => messageName === 'RootTarget')!
    root.rows = [{ ...root.rows[1]!, noKey: null }]
    const exported = exportResolvedJson(workspace, results, ['RootTarget'])

    expect(exported.files).toEqual([])
    expect(exported.diagnostics.map(({ code }) => code)).toContain('JSON_REFERENCE_TARGET_MISSING')
    expect(exported.diagnostics[0]).toMatchObject({ sourceFile: 'ReferenceTable.proto', row: 2 })
  })

  it('diagnoses a referenced Message without a key instead of leaving a raw value', () => {
    const { workspace, results } = fixture()
    const root = results.find(({ messageName }) => messageName === 'RootTarget')!
    root.rows = [{ ...root.rows[0]! }]
    const exported = exportResolvedJson(workspace, results, ['RootTarget'])

    expect(exported.files).toEqual([])
    expect(exported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'JSON_REFERENCE_TARGET_HAS_NO_KEY',
        messageName: 'RootTarget',
        fieldName: 'noKey',
        row: 2
      })
    )
  })

  it('rejects tuple duplicates and empty keys before resolving rows', () => {
    const { workspace, results } = fixture()
    const composite = results.find(({ messageName }) => messageName === 'CompositeTarget')!
    composite.rows = [
      { region: 1, id: 1, label: 'first' },
      { region: 1, id: 1, label: 'duplicate' },
      { region: null, id: 2, label: 'empty' }
    ]
    const exported = exportResolvedJson(workspace, results, ['CompositeTarget'])

    expect(exported.files).toEqual([])
    expect(exported.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['JSON_PRIMARY_KEY_DUPLICATE', 'JSON_REQUIRED_KEY_EMPTY'])
    )
  })

  it('detects cycles deterministically and does not emit partial files', () => {
    const { workspace, results } = fixture()
    const dependency = collectJsonExportDependencies(workspace, ['CycleA'])
    const exported = exportResolvedJson(workspace, results, ['CycleA'])

    expect(dependency.diagnostics).toEqual([
      expect.objectContaining({
        code: 'JSON_REFERENCE_CYCLE',
        message: 'Reference cycle detected: CycleA -> CycleB -> CycleA.'
      })
    ])
    expect(exported.files).toEqual([])
  })

  it('excludes a direct self edge from dependency cycles and resolves a terminating chain', () => {
    const { workspace, results } = selfFixture([
      { id: 1, name: 'Root', parent: null },
      { id: 2, name: 'Child', parent: 1 },
      { id: 3, name: 'Grandchild', parent: 2 }
    ])

    expect(collectJsonExportDependencies(workspace, ['Category'])).toEqual({
      order: ['Category'],
      diagnostics: []
    })
    const exported = exportResolvedJson(workspace, results, ['Category'])
    expect(exported.diagnostics).toEqual([])
    const rows = JSON.parse(exported.files[0]!.contents) as Array<Record<string, unknown>>
    expect(rows[0]?.parent).toBeNull()
    expect(rows[2]?.parent).toMatchObject({
      id: 2,
      parent: { id: 1, name: 'Root', parent: null }
    })
  })

  it.each([
    ['direct', [{ id: 1, name: 'Self', parent: 1 }], 'Category R2 (id=1) -> Category R2 (id=1)'],
    [
      'multi-row',
      [
        { id: 1, name: 'First', parent: 2 },
        { id: 2, name: 'Second', parent: 1 }
      ],
      'Category R2 (id=1) -> Category R3 (id=2) -> Category R2 (id=1)'
    ]
  ])('reports a %s self-reference cycle with row and key path', (_label, rows, path) => {
    const self = selfFixture(rows)
    const exported = exportResolvedJson(self.workspace, self.results, ['Category'])

    expect(exported.files).toEqual([])
    expect(exported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'JSON_REFERENCE_ROW_CYCLE',
        sourceFile: 'CategoryTable.proto',
        messageName: 'Category',
        context: { path }
      })
    )
  })

  it('does not treat two branches sharing the same resolved parent as a cycle', () => {
    const { workspace, results } = selfFixture([
      { id: 1, name: 'Root', parent: null },
      { id: 2, name: 'Left', parent: 1 },
      { id: 3, name: 'Right', parent: 1 }
    ])
    const exported = exportResolvedJson(workspace, results, ['Category'])

    expect(exported.diagnostics).toEqual([])
    const rows = JSON.parse(exported.files[0]!.contents) as Array<Record<string, unknown>>
    expect(rows[1]?.parent).toEqual(rows[2]?.parent)
  })

  it('never serializes Excel-only memo keys or sentinel values', () => {
    const { workspace, results } = selfFixture([
      { id: 1, name: 'Root', parent: null, '기획 메모': 'MEMO_SENTINEL' }
    ])
    const exported = exportResolvedJson(workspace, results, ['Category'])

    expect(exported.diagnostics).toEqual([])
    expect(exported.files[0]?.contents).not.toContain('기획 메모')
    expect(exported.files[0]?.contents).not.toContain('MEMO_SENTINEL')
  })

  it('keeps self-reference lookup rules for multiple primary and group keys', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'SelfKeyTable.proto',
        source: `syntax = "proto3";
message CompositeNode {
  // @PK
  int32 region = 1;
  // @PK
  int32 id = 2;
  CompositeNode parents = 3;
}
message GroupNode {
  // @Key
  string groupId = 1;
  string label = 2;
  GroupNode members = 3;
}
`
      }
    ])
    const results: ExcelReadResult[] = [
      {
        sourceFile: 'SelfKeyTable.proto',
        messageName: 'CompositeNode',
        rows: [
          { region: 1, id: 1, parents: null },
          { region: 1, id: 2, parents: null },
          { region: 2, id: 1, parents: 1 }
        ]
      },
      {
        sourceFile: 'SelfKeyTable.proto',
        messageName: 'GroupNode',
        rows: [
          { groupId: 'root', label: 'A', members: null },
          { groupId: 'root', label: 'B', members: null },
          { groupId: 'child', label: 'C', members: 'root' }
        ]
      }
    ]

    const composite = exportResolvedJson(workspace, results, ['CompositeNode'])
    const compositeRows = JSON.parse(composite.files[0]!.contents) as Array<Record<string, unknown>>
    expect(compositeRows[2]?.parents).toHaveLength(2)
    const group = exportResolvedJson(workspace, results, ['GroupNode'])
    const groupRows = JSON.parse(group.files[0]!.contents) as Array<Record<string, unknown>>
    expect(groupRows[2]?.members).toHaveLength(2)
  })

  it('keeps missing and blank self references deterministic', () => {
    const blank = selfFixture([{ id: 1, name: 'Root', parent: null }])
    expect(exportResolvedJson(blank.workspace, blank.results, ['Category']).diagnostics).toEqual([])

    const missing = selfFixture([{ id: 1, name: 'Orphan', parent: 99 }])
    const exported = exportResolvedJson(missing.workspace, missing.results, ['Category'])
    expect(exported.files).toEqual([])
    expect(exported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'JSON_REFERENCE_TARGET_MISSING',
        row: 2,
        fieldName: 'parent'
      })
    )
  })

  it('handles a 10,000-row chain without recursion and stops at the expansion limit', () => {
    const { workspace, results } = selfFixture(
      Array.from({ length: 10_000 }, (_, index) => ({
        id: index + 1,
        name: `Node ${index + 1}`,
        parent: index === 0 ? null : index
      }))
    )
    const exported = exportResolvedJson(workspace, results, ['Category'])

    expect(exported.files).toEqual([])
    expect(exported.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'JSON_REFERENCE_EXPANSION_LIMIT',
        params: {
          limit: JSON_REFERENCE_EXPANSION_LIMIT,
          count: JSON_REFERENCE_EXPANSION_LIMIT + 1
        }
      })
    )
  }, 15_000)
})
