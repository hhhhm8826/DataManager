import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseProtoWorkspace } from '../src/proto/workspace'
import { generateUnrealFiles } from '../src/unreal'

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

function fixtureWorkspace() {
  return parseProtoWorkspace(
    ['FixtureEnumType.proto', 'KeyTable.proto', 'ReferenceTable.proto'].map((sourceFile) => ({
      sourceFile,
      source: readFileSync(resolve(fixtureRoot, sourceFile), 'utf8')
    }))
  )
}

describe('Unreal generator', () => {
  it('ignores Message-local @Memo virtual members', () => {
    const generated = generateUnrealFiles(
      parseProtoWorkspace([
        {
          sourceFile: 'ItemTable.proto',
          source: `syntax = "proto3";
message Item {
  int32 id = 1;
  // @Memo(memo-plan) 기획 메모
}
`
        }
      ])
    )
    const output = generated.files.map(({ contents }) => contents).join('\n')
    expect(output).toContain('int32 id = 0;')
    expect(output).not.toContain('memo-plan')
    expect(output).not.toContain('기획 메모')
  })

  it('corrects enum prefixes, declaration order, loader naming, and cyclic values', () => {
    const generated = generateUnrealFiles(fixtureWorkspace())
    expect(generated.files.map(({ fileName }) => fileName)).toEqual([
      'FixtureEnumType.h',
      'DataTables.h',
      'DataTableLoader.h',
      'DataTableLoader.cpp'
    ])
    const enumHeader = generated.files[0]!.contents
    expect(enumHeader).toContain('FixtureState_NONE = 0')
    expect(enumHeader).not.toContain('FixtureState_FixtureState_NONE')
    const tables = generated.files.find(({ fileName }) => fileName === 'DataTables.h')!.contents
    expect(tables.indexOf('struct FSingleTarget :')).toBeLessThan(
      tables.indexOf('struct FMiddleTarget :')
    )
    expect(tables.indexOf('struct FMiddleTarget :')).toBeLessThan(
      tables.indexOf('struct FRootTarget :')
    )
    expect(tables).toContain('TSharedPtr<FCycleB> b;')
    expect(tables).toContain('TSharedPtr<FCycleA> a;')
    expect(
      generated.files.find(({ fileName }) => fileName === 'DataTableLoader.h')?.contents
    ).toContain('struct FDataTableLoader')
    expect(generated.diagnostics.map(({ code }) => code)).toEqual([
      'UNREAL_MESSAGE_CYCLE_POINTER',
      'UNREAL_MESSAGE_CYCLE_POINTER'
    ])
  })

  it('produces stable normalized fixture snapshots with balanced braces', () => {
    const generated = generateUnrealFiles(fixtureWorkspace())
    const hashes = Object.fromEntries(
      generated.files.map(({ fileName, contents }) => [
        fileName,
        createHash('sha256').update(contents.replace(/\r\n/g, '\n')).digest('hex')
      ])
    )
    expect(hashes).toMatchInlineSnapshot(`
      {
        "DataTableLoader.cpp": "ca654efe21b399e57771fbf547dc408ec21ab315b6dd0094db99e2f12cdbbbe7",
        "DataTableLoader.h": "6ef1061b6c5fa389ca15c1c7078ef66bcb365b4eac00ef13f18ef70bbb505a67",
        "DataTables.h": "e50bdb46363d7ad99b8c24bac222b05840a878e08c87d53c01af2766cd602f81",
        "FixtureEnumType.h": "b2234600615f10651739f4d94d0d0343352bf38969c0527459e2c4e0c951165b",
      }
    `)
    for (const { contents } of generated.files) {
      expect([...contents].filter((value) => value === '{')).toHaveLength(
        [...contents].filter((value) => value === '}').length
      )
      expect(contents.endsWith('\n')).toBe(true)
    }
  })

  it('generates valid parsing paths for primitive, repeated, bytes, enum, and message fields', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'TypesEnumType.proto',
        source: `syntax = "proto3";
enum Kind { Kind_NONE = 0; Kind_ONE = 1; Kind_MAX = 2; }
`
      },
      {
        sourceFile: 'TypesTable.proto',
        source: `syntax = "proto3";
message Child { int32 id = 1; }
message Types {
  string text = 1;
  bool enabled = 2;
  int64 count = 3;
  bytes payload = 4;
  Kind kind = 5;
  Child child = 6;
  repeated string tags = 7;
  repeated bool flags = 8;
  repeated double values = 9;
  repeated bytes payloads = 10;
  repeated Kind kinds = 11;
  repeated Child children = 12;
}
`
      }
    ])
    const generated = generateUnrealFiles(workspace)
    expect(generated.diagnostics).toEqual([])
    const tables = generated.files.find(({ fileName }) => fileName === 'DataTables.h')!.contents
    const loader = generated.files.find(
      ({ fileName }) => fileName === 'DataTableLoader.cpp'
    )!.contents

    expect(tables).toContain('TArray<uint8> payload;')
    expect(tables).toContain('TArray<TArray<uint8>> payloads;')
    expect(tables).toContain('class FJsonObject;')
    expect(loader).toContain('#include "Misc/Base64.h"')
    expect(loader).toContain('FBase64::Decode(Value, payload)')
    expect(loader).toContain('FBase64::Decode(Text, Bytes)')
    expect(loader).toContain('payloads.Reset();')
    expect(loader).not.toContain('static_cast<TArray<uint8>>')
    expect(loader).toContain('ParseEnumFromString<EKind>')
    expect(loader).toContain('FChild Row; Row.ParseFromJson(*Object);')
  })

  it('finds cycles through alternate graph branches and rejects unresolved types', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'GraphTable.proto',
        source: `syntax = "proto3";
message A { B first = 1; C second = 2; }
message B { D dead_end = 1; }
message C { D path = 1; }
message D { A back = 1; }
message Broken { Missing value = 1; }
`
      }
    ])
    const generated = generateUnrealFiles(workspace)

    expect(generated.files).toEqual([])
    expect(generated.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNREAL_UNRESOLVED_FIELD_TYPE',
          declarationName: 'Broken'
        }),
        expect.objectContaining({
          code: 'UNREAL_MESSAGE_CYCLE_POINTER',
          declarationName: 'A'
        }),
        expect.objectContaining({
          code: 'UNREAL_MESSAGE_CYCLE_POINTER',
          declarationName: 'D'
        })
      ])
    )
  })

  it('rejects enum values that cannot be represented by Blueprint uint8 enums', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'WideEnumType.proto',
        source: `syntax = "proto3";
enum Wide { Wide_NONE = 0; Wide_VALUE = 256; Wide_MAX = 257; }
`
      }
    ])
    const generated = generateUnrealFiles(workspace)
    expect(generated.files).toEqual([])
    expect(generated.diagnostics.map(({ code }) => code)).toEqual([
      'UNREAL_ENUM_VALUE_OUT_OF_RANGE',
      'UNREAL_ENUM_VALUE_OUT_OF_RANGE'
    ])
  })

  it('generates direct optional and repeated self references with pointer-safe Unreal fields', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'CategoryTable.proto',
        source: `syntax = "proto3";
message Category {
  // @PK
  int32 id = 1;
  optional Category parent = 2;
  repeated Category children = 3;
}
`
      }
    ])
    const generated = generateUnrealFiles(workspace)
    const tables = generated.files.find(({ fileName }) => fileName === 'DataTables.h')!.contents
    const loader = generated.files.find(
      ({ fileName }) => fileName === 'DataTableLoader.cpp'
    )!.contents

    expect(tables).toContain('TSharedPtr<FCategory> parent;')
    expect(tables).toContain('TArray<TSharedPtr<FCategory>> children;')
    expect(loader).toContain('parent = MakeShared<FCategory>()')
    expect(loader).toContain('TSharedPtr<FCategory> Row = MakeShared<FCategory>()')
    expect(generated.diagnostics.map(({ code }) => code)).toEqual([
      'UNREAL_MESSAGE_CYCLE_POINTER',
      'UNREAL_MESSAGE_CYCLE_POINTER'
    ])
  })
})
