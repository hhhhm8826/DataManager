import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addMessage,
  buildProtoFileName,
  createProtoDocument,
  findReferenceImpacts,
  isEnumFileName,
  isMessageFileName,
  normalizeProtoFileStem,
  updateEnum,
  updateMessage
} from '../src/proto/patcher'
import { parseProtoDocument } from '../src/proto/parser'

const fixtureRoot = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'tests',
  'fixtures',
  'm0-legacy',
  'proto'
)

function readFixture(name: string): string {
  return readFileSync(resolve(fixtureRoot, name), 'utf8')
}

describe('message patching', () => {
  it('writes and reorders @Memo directives as Message-local virtual members', () => {
    const document = parseProtoDocument(
      `syntax = "proto3";\nmessage GameItem {\n  int32 id = 1;\n}\n`,
      'GameItemTable.proto'
    )
    const result = updateMessage(document, 'GameItem', {
      name: 'GameItem',
      fields: [{ originalName: 'id', name: 'id', type: 'int32', fieldNumber: 1, order: 1 }],
      memos: [{ id: 'memo-planning', name: '기획 메모', order: 0 }]
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source).toContain('// @Memo(memo-planning) 기획 메모')
    expect(result.value.source.indexOf('@Memo')).toBeLessThan(
      result.value.source.indexOf('int32 id')
    )
    expect(result.value.declaration.fields).toHaveLength(1)
    expect(result.value.declaration.memos[0]).toMatchObject({
      id: 'memo-planning',
      name: '기획 메모',
      order: 0
    })
  })

  it('normalizes a pasted extension and appends .proto exactly once', () => {
    expect(buildProtoFileName('message', 'CustomTable')).toEqual({
      success: true,
      value: 'CustomTable.proto'
    })
    expect(buildProtoFileName('message', normalizeProtoFileStem('CustomTable.PROTO'))).toEqual({
      success: true,
      value: 'CustomTable.proto'
    })
  })

  it.each(['Foo.proto.proto', ' FooTable', 'FooTable.', 'folder/FooTable', 'Foo'])(
    'rejects an invalid filename stem: %s',
    (stem) => {
      const result = buildProtoFileName('message', stem)
      expect(result.success).toBe(false)
      if (!result.success) expect(result.diagnostics[0]?.code).toBe('PROTO_FILE_NAME_INVALID')
    }
  )

  it('preserves bytes outside the target and keeps field numbers through reorder and rename', () => {
    const source = readFixture('KeyTable.proto')
    const document = parseProtoDocument(source, 'KeyTable.proto')
    const target = document.messages.find((message) => message.name === 'CompositeTarget')
    expect(target).toBeTruthy()
    const before = source.slice(0, target?.span.start)
    const after = source.slice(target?.span.end)

    const result = updateMessage(document, 'CompositeTarget', {
      name: 'CompositeTarget',
      fields: [
        { originalName: 'label', name: 'title', type: 'string' },
        { originalName: 'region', name: 'region', type: 'int32', isPrimaryKey: true },
        { originalName: 'id', name: 'id', type: 'int32', isPrimaryKey: true },
        { name: 'enabled', type: 'bool' }
      ]
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source.slice(0, before.length)).toBe(before)
    expect(result.value.source.slice(-after.length)).toBe(after)
    expect(
      result.value.declaration.fields.map((field) => ({
        name: field.name,
        number: field.fieldNumber,
        primary: field.isPrimaryKey
      }))
    ).toEqual([
      { name: 'title', number: 3, primary: false },
      { name: 'region', number: 1, primary: true },
      { name: 'id', number: 2, primary: true },
      { name: 'enabled', number: 4, primary: false }
    ])
    expect(result.value.source).toContain('// @PK')
  })

  it('preserves ordinary comments and legacy group-key annotations on round-trip', () => {
    const source = `syntax = "proto3";
package sample;
option go_package = "./sample";

// declaration comment remains outside the target
message GroupTable {
  // ordinary field comment
  // @Key
  int32 groupId = 5;
  string label = 9;
}

// unrelated trailing comment
message OtherTable {
  int32 id = 1;
}
`
    const document = parseProtoDocument(source, 'GroupTable.proto')
    const result = updateMessage(document, 'GroupTable', {
      name: 'GroupTable',
      fields: [
        { name: 'groupId', type: 'int32', isGroupKey: true },
        { name: 'label', type: 'string' }
      ]
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source).toContain('// declaration comment remains outside the target')
    expect(result.value.source).toContain('// ordinary field comment')
    expect(result.value.source).toContain('// unrelated trailing comment')
    expect(result.value.declaration.fields[0]).toMatchObject({
      name: 'groupId',
      fieldNumber: 5,
      isGroupKey: true
    })
    expect(result.value.declaration.fields[1]?.fieldNumber).toBe(9)
  })

  it('changes only annotation comments without duplicating indentation', () => {
    const source = `syntax = "proto3";
message Keyed {
  // ordinary field comment
  // @PK
  int32 id = 1;
}
`
    const document = parseProtoDocument(source, 'KeyedTable.proto')
    const result = updateMessage(document, 'Keyed', {
      name: 'Keyed',
      fields: [{ name: 'id', type: 'int32', isGroupKey: true }]
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source).toContain('  // ordinary field comment\n  // @Key\n  int32 id = 1;')
    expect(result.value.source).not.toContain('@PK')
  })

  it('preserves CRLF line endings while modifying and reparsing a target', () => {
    const source = [
      'syntax = "proto3";',
      'message First {',
      '  string name = 2;',
      '}',
      '',
      'message Other {',
      '  int32 id = 1;',
      '}',
      ''
    ].join('\r\n')
    const document = parseProtoDocument(source, 'FirstTable.proto')
    const other = document.messages.find(({ name }) => name === 'Other')!
    const otherBytes = source.slice(other.span.start)
    const result = updateMessage(document, 'First', {
      name: 'First',
      fields: [{ name: 'title', originalName: 'name', type: 'string' }]
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source).not.toMatch(/(^|[^\r])\n/)
    expect(result.value.source.endsWith(otherBytes)).toBe(true)
    expect(result.value.declaration.fields[0]).toMatchObject({ name: 'title', fieldNumber: 2 })
  })

  it('adds deterministic imports for referenced types', () => {
    const document = createProtoDocument('InventoryTable.proto', 'sample', './sample')
    const typeSources = new Map([
      ['ItemType', 'ItemEnumType.proto'],
      ['Owner', 'OwnerTable.proto']
    ])
    const result = addMessage(
      document,
      {
        name: 'Inventory',
        fields: [
          { name: 'id', type: 'int32', isPrimaryKey: true },
          { name: 'itemType', type: 'ItemType' },
          { name: 'owner', type: 'Owner' }
        ]
      },
      typeSources
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source).toContain('import "ItemEnumType.proto";')
    expect(result.value.source).toContain('import "OwnerTable.proto";')
    expect(result.value.declaration.fields.map((field) => field.fieldNumber)).toEqual([1, 2, 3])
    expect(isMessageFileName('InventoryTable.proto')).toBe(true)
    expect(isMessageFileName('Inventory.proto')).toBe(false)
    expect(isEnumFileName('ItemEnumType.proto')).toBe(true)
    expect(isEnumFileName('ItemType.proto')).toBe(false)
  })

  it('adds a missing import when an existing field changes to an external type', () => {
    const document = parseProtoDocument(
      `syntax = "proto3";\npackage sample;\noption go_package = "./sample";\n\nmessage Inventory {\n  int32 owner = 1;\n}\n`,
      'InventoryTable.proto'
    )
    const result = updateMessage(
      document,
      'Inventory',
      {
        name: 'Inventory',
        fields: [{ name: 'owner', type: 'Owner' }]
      },
      new Map([['Owner', 'OwnerTable.proto']])
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.source.match(/import "OwnerTable\.proto";/g)).toHaveLength(1)
    expect(result.value.declaration.fields[0]).toMatchObject({
      name: 'owner',
      type: 'Owner',
      fieldNumber: 1
    })
  })

  it('refuses to patch declarations containing unsupported grammar', () => {
    const document = parseProtoDocument(
      `syntax = "proto3";
package sample;
option go_package = "./sample";
message Unsafe { oneof choice { string name = 1; } }
`,
      'UnsafeTable.proto'
    )
    const result = updateMessage(document, 'Unsafe', {
      name: 'Unsafe',
      fields: [{ name: 'name', type: 'string' }]
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'PROTO_MESSAGE_MEMBER_UNSUPPORTED'
    )
  })
})

describe('enum patching', () => {
  it('adds NONE and MAX and rejects duplicate names and numbers', () => {
    const document = parseProtoDocument(
      readFixture('FixtureEnumType.proto'),
      'FixtureEnumType.proto'
    )
    const result = updateEnum(document, 'FixtureState', {
      name: 'FixtureState',
      values: [
        { name: 'FixtureState_ACTIVE', number: 1 },
        { name: 'FixtureState_DISABLED', number: 4 }
      ]
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.declaration.values.map(({ name, number }) => ({ name, number }))).toEqual([
      { name: 'FixtureState_NONE', number: 0 },
      { name: 'FixtureState_ACTIVE', number: 1 },
      { name: 'FixtureState_DISABLED', number: 4 },
      { name: 'FixtureState_MAX', number: 5 }
    ])

    const duplicate = updateEnum(document, 'FixtureState', {
      name: 'FixtureState',
      values: [
        { name: 'FixtureState_ACTIVE', number: 1 },
        { name: 'FixtureState_ACTIVE', number: 2 },
        { name: 'FixtureState_DISABLED', number: 1 }
      ]
    })
    expect(duplicate.success).toBe(false)
    if (duplicate.success) return
    expect(duplicate.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'PROTO_ENUM_VALUE_NAME_DUPLICATE',
        'PROTO_ENUM_VALUE_NUMBER_DUPLICATE'
      ])
    )
  })
})

describe('reference impact analysis', () => {
  it('lists message fields affected by a delete or rename', () => {
    const documents = ['KeyTable.proto', 'ReferenceTable.proto'].map((name) =>
      parseProtoDocument(readFixture(name), name)
    )

    expect(findReferenceImpacts(documents, 'SingleTarget')).toEqual([
      {
        sourceFile: 'ReferenceTable.proto',
        messageName: 'MiddleTarget',
        fieldName: 'single',
        referencedType: 'SingleTarget'
      },
      {
        sourceFile: 'ReferenceTable.proto',
        messageName: 'RootTarget',
        fieldName: 'single',
        referencedType: 'SingleTarget'
      }
    ])
  })
})
