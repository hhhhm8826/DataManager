import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
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

describe('parseProtoDocument', () => {
  it('matches the M0 fixture declaration and annotation snapshot', () => {
    const keyDocument = parseProtoDocument(readFixture('KeyTable.proto'), 'KeyTable.proto')
    const referenceDocument = parseProtoDocument(
      readFixture('ReferenceTable.proto'),
      'ReferenceTable.proto'
    )
    const enumDocument = parseProtoDocument(
      readFixture('FixtureEnumType.proto'),
      'FixtureEnumType.proto'
    )

    expect(keyDocument.readOnly).toBe(false)
    expect(keyDocument.syntax).toBe('proto3')
    expect(keyDocument.packageName).toBe('DATA_MANAGER_FIXTURE')
    expect(keyDocument.goPackage).toBe('./DATA_MANAGER_FIXTURE')
    expect(keyDocument.imports.map((entry) => entry.path)).toEqual(['FixtureEnumType.proto'])
    expect(
      keyDocument.messages.map((message) => ({
        name: message.name,
        fields: message.fields.map((field) => ({
          name: field.name,
          type: field.type,
          number: field.fieldNumber,
          primary: field.isPrimaryKey,
          group: field.isGroupKey
        }))
      }))
    ).toEqual([
      {
        name: 'SingleTarget',
        fields: [
          { name: 'id', type: 'int32', number: 1, primary: true, group: false },
          { name: 'label', type: 'string', number: 2, primary: false, group: false },
          { name: 'state', type: 'FixtureState', number: 3, primary: false, group: false }
        ]
      },
      {
        name: 'CompositeTarget',
        fields: [
          { name: 'region', type: 'int32', number: 1, primary: true, group: false },
          { name: 'id', type: 'int32', number: 2, primary: true, group: false },
          { name: 'label', type: 'string', number: 3, primary: false, group: false }
        ]
      },
      {
        name: 'GroupTarget',
        fields: [
          { name: 'groupId', type: 'int32', number: 1, primary: false, group: true },
          { name: 'label', type: 'string', number: 2, primary: false, group: false }
        ]
      },
      {
        name: 'NoKeyTarget',
        fields: [{ name: 'label', type: 'string', number: 1, primary: false, group: false }]
      }
    ])

    expect(referenceDocument.messages.map((message) => message.name)).toEqual([
      'MiddleTarget',
      'RootTarget',
      'CycleA',
      'CycleB'
    ])
    expect(enumDocument.enums).toHaveLength(1)
    expect(enumDocument.enums[0]?.values.map(({ name, number }) => ({ name, number }))).toEqual([
      { name: 'FixtureState_NONE', number: 0 },
      { name: 'FixtureState_ACTIVE', number: 1 },
      { name: 'FixtureState_MAX', number: 2 }
    ])

    for (const declaration of keyDocument.messages) {
      expect(keyDocument.source.slice(declaration.span.start, declaration.span.end)).toContain(
        `message ${declaration.name}`
      )
    }
    for (const declaration of enumDocument.enums) {
      expect(enumDocument.source.slice(declaration.span.start, declaration.span.end)).toContain(
        `enum ${declaration.name}`
      )
    }
  })

  it('preserves CRLF detection, qualified field types, options, and raw spans', () => {
    const source = [
      'syntax = "proto3";',
      '',
      'package sample.data;',
      'option go_package = "./sample";',
      '',
      'message Item {',
      '  // ordinary comment',
      '  // @PK',
      '  optional .sample.types.Id id = 7 [deprecated = true];',
      '}',
      ''
    ].join('\r\n')
    const document = parseProtoDocument(source, 'ItemTable.proto')
    const field = document.messages[0]?.fields[0]

    expect(document.readOnly).toBe(false)
    expect(document.lineEnding).toBe('\r\n')
    expect(field).toMatchObject({
      name: 'id',
      type: '.sample.types.Id',
      fieldNumber: 7,
      label: 'optional',
      isPrimaryKey: true,
      optionsText: '[deprecated = true]'
    })
    expect(field?.leadingTrivia).toContain('// ordinary comment')
    expect(source.slice(field?.span.start, field?.span.end)).toBe(
      'optional .sample.types.Id id = 7 [deprecated = true];'
    )
  })

  it('marks unsupported grammar read-only with concrete diagnostics', () => {
    const source = `syntax = "proto3";
package sample;
option go_package = "./sample";

message Unsafe {
  oneof choice {
    string name = 1;
  }
  map<string, int32> counts = 2;
}

service UnsafeService {}
`
    const document = parseProtoDocument(source, 'UnsafeTable.proto')

    expect(document.readOnly).toBe(true)
    expect(document.messages[0]?.readOnly).toBe(true)
    expect(document.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'PROTO_MESSAGE_MEMBER_UNSUPPORTED',
        'PROTO_TOP_LEVEL_DECLARATION_UNSUPPORTED'
      ])
    )
  })

  it('rejects duplicate and reserved field numbers in existing source', () => {
    const document = parseProtoDocument(
      `syntax = "proto3";
message Invalid {
  string value = 1;
  int32 value = 1;
  bool reserved = 19000;
}
`,
      'InvalidTable.proto'
    )

    expect(document.readOnly).toBe(true)
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'PROTO_FIELD_NAME_DUPLICATE',
        'PROTO_FIELD_NUMBER_DUPLICATE',
        'PROTO_FIELD_NUMBER_INVALID'
      ])
    )
  })

  it('keeps a fixable enum editable while reporting missing sentinels', () => {
    const document = parseProtoDocument(
      `syntax = "proto3";
enum State { State_ACTIVE = 1; }
`,
      'StateEnumType.proto'
    )

    expect(document.readOnly).toBe(false)
    expect(document.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['PROTO_ENUM_NONE_MISSING', 'PROTO_ENUM_MAX_MISSING'])
    )
  })
})
