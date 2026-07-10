import { describe, expect, it } from 'vitest'
import { parseProtoWorkspace, replaceWorkspaceDocument } from '../src/proto/workspace'

const header = `syntax = "proto3";
package sample;
option go_package = "./sample";
`

describe('Proto workspace', () => {
  it('builds deterministic declaration and type-source indexes', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'ZTable.proto',
        source: `${header}\nmessage Z { A value = 1; }\n`
      },
      {
        sourceFile: 'AEnumType.proto',
        source: `${header}\nenum A { A_NONE = 0; A_MAX = 1; }\n`
      }
    ])

    expect(workspace.documents.map((document) => document.sourceFile)).toEqual([
      'AEnumType.proto',
      'ZTable.proto'
    ])
    expect(workspace.typeSources.get('A')).toBe('AEnumType.proto')
    expect(workspace.typeSources.get('Z')).toBe('ZTable.proto')
    expect(workspace.diagnostics).toEqual([])
  })

  it('diagnoses duplicate symbols and excludes ambiguous type sources', () => {
    const workspace = parseProtoWorkspace([
      { sourceFile: 'OneTable.proto', source: `${header}\nmessage Shared { int32 id = 1; }\n` },
      { sourceFile: 'TwoTable.proto', source: `${header}\nmessage Shared { int32 id = 1; }\n` }
    ])

    expect(workspace.typeSources.has('Shared')).toBe(false)
    expect(
      workspace.diagnostics.filter(
        ({ diagnostic }) => diagnostic.code === 'PROTO_SYMBOL_NAME_DUPLICATE'
      )
    ).toHaveLength(2)
  })

  it('rebuilds indexes after replacing one document', () => {
    const initial = parseProtoWorkspace([
      { sourceFile: 'ItemTable.proto', source: `${header}\nmessage Item { int32 id = 1; }\n` }
    ])
    const updated = replaceWorkspaceDocument(
      initial,
      'ItemTable.proto',
      `${header}\nmessage RenamedItem { int32 id = 1; }\n`
    )

    expect(updated.typeSources.has('Item')).toBe(false)
    expect(updated.typeSources.get('RenamedItem')).toBe('ItemTable.proto')
  })
})
