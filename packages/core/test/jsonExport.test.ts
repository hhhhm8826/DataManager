import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ExcelReadResult } from '../src/excel'
import { collectJsonExportDependencies, exportResolvedJson } from '../src/jsonExport'
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
})
