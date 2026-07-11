import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyWorkspaceMetadataSectionUpdate,
  createMemoColumnId,
  defaultWorkspaceMetadata,
  normalizeTableMetadataKey,
  parseWorkspaceMetadata,
  validateMemoColumnName,
  WorkspaceMetadataRevisionConflictError
} from '../src/projectMetadata'

describe('D1003/D1007/D1009/D1012 project metadata', () => {
  it('validates Unicode memo names and generates crypto-backed stable ids', () => {
    const existing = [{ id: 'memo-existing', name: '기획 메모', order: 0 }]
    expect(validateMemoColumnName('  밸런스 검토  ', ['id'], existing)).toEqual({
      success: true,
      name: '밸런스 검토'
    })
    expect(validateMemoColumnName('ID', ['id'], existing).success).toBe(false)
    expect(validateMemoColumnName('기획 메모', ['id'], existing).success).toBe(false)
    expect(validateMemoColumnName('줄\n바꿈', [], []).success).toBe(false)
    expect(createMemoColumnId()).toMatch(/^memo-[0-9a-f-]{36}$/)
  })

  it('parses the shared long Korean path fixture', () => {
    const fixturePath = resolve(
      process.cwd(),
      '..',
      '..',
      'tests',
      'fixtures',
      'd1000-d1012',
      '긴 한글 경로',
      'PROTO',
      '.datamanager',
      'workspace.json'
    )
    const metadata = parseWorkspaceMetadata(JSON.parse(readFileSync(fixturePath, 'utf8')))

    expect(metadata.tables).toEqual({})
    expect(metadata.diagram.savedLayout?.positions).toHaveProperty('message:HubTable.proto:Hub')
  })

  it('opens a missing project with stable defaults without sharing mutable state', () => {
    const first = defaultWorkspaceMetadata()
    const second = defaultWorkspaceMetadata()

    first.tables['ItemTable.proto#Item'] = { memoColumns: [] }

    expect(second).toEqual({
      version: 1,
      revision: 0,
      primaryKeyTypePolicy: 'unrestricted',
      tables: {},
      diagram: { hubThreshold: 5, savedLayout: null }
    })
  })

  it('round-trips memo, policy, threshold, positions, and viewport', () => {
    const metadata = parseWorkspaceMetadata({
      version: 1,
      revision: 4,
      primaryKeyTypePolicy: 'numeric-or-enum',
      tables: {
        'nested/ItemTable.proto#Item': {
          memoColumns: [{ id: 'memo-018f6f74', name: '기획 메모', order: 0 }]
        }
      },
      diagram: {
        hubThreshold: 7,
        savedLayout: {
          positions: { 'message:ItemTable.proto:Item': { x: 120.1, y: 80.2 } },
          viewport: { x: 0, y: 0, zoom: 1.125 }
        }
      }
    })

    expect(parseWorkspaceMetadata(JSON.parse(JSON.stringify(metadata)))).toEqual(metadata)
  })

  it('updates one section with compare-and-swap and preserves concurrent sections', () => {
    const initial = defaultWorkspaceMetadata()
    const withPolicy = applyWorkspaceMetadataSectionUpdate(initial, {
      expectedRevision: 0,
      section: 'primaryKeyTypePolicy',
      value: 'string'
    })
    const withDiagram = applyWorkspaceMetadataSectionUpdate(withPolicy, {
      expectedRevision: 1,
      section: 'diagram',
      value: { hubThreshold: 8, savedLayout: null }
    })

    expect(withDiagram).toMatchObject({
      revision: 2,
      primaryKeyTypePolicy: 'string',
      tables: {},
      diagram: { hubThreshold: 8, savedLayout: null }
    })
    expect(initial).toEqual(defaultWorkspaceMetadata())
  })

  it('rejects a stale section update with both revisions', () => {
    const current = { ...defaultWorkspaceMetadata(), revision: 3 }

    expect(() =>
      applyWorkspaceMetadataSectionUpdate(current, {
        expectedRevision: 2,
        section: 'tables',
        value: {}
      })
    ).toThrowError(new WorkspaceMetadataRevisionConflictError(2, 3))
  })

  it('normalizes relative table keys and rejects escape or absolute keys', () => {
    expect(normalizeTableMetadataKey('.\\nested\\ItemTable.proto', 'Item')).toBe(
      'nested/ItemTable.proto#Item'
    )
    expect(() => normalizeTableMetadataKey('../ItemTable.proto', 'Item')).toThrow()
    expect(() => normalizeTableMetadataKey('C:\\Proto\\ItemTable.proto', 'Item')).toThrow()
    expect(() => normalizeTableMetadataKey('ItemTable.proto', '1Item')).toThrow()
  })

  it('rejects corrupt versions, non-finite geometry, duplicate memo fields, and excess entries', () => {
    expect(() => parseWorkspaceMetadata({ version: 99 })).toThrow()

    const invalidGeometry = defaultWorkspaceMetadata()
    invalidGeometry.diagram.savedLayout = {
      positions: { item: { x: Number.NaN, y: 0 } },
      viewport: { x: 0, y: 0, zoom: 1 }
    }
    expect(() => parseWorkspaceMetadata(invalidGeometry)).toThrow()

    const invalidMemo = defaultWorkspaceMetadata()
    invalidMemo.tables['ItemTable.proto#Item'] = {
      memoColumns: [
        { id: 'memo-one', name: '메모 1', order: 0 },
        { id: 'memo-one', name: '메모 2', order: 0 }
      ]
    }
    expect(() => parseWorkspaceMetadata(invalidMemo)).toThrow()

    const tooMany = defaultWorkspaceMetadata()
    tooMany.diagram.savedLayout = {
      positions: Object.fromEntries(
        Array.from({ length: 10_001 }, (_, index) => [`message:${index}`, { x: 0, y: 0 }])
      ),
      viewport: { x: 0, y: 0, zoom: 1 }
    }
    expect(() => parseWorkspaceMetadata(tooMany)).toThrow()
  })
})
