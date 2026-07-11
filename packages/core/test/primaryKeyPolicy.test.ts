import { describe, expect, it } from 'vitest'
import { parseProtoWorkspace, validatePrimaryKeyTypePolicy } from '../src'

const workspace = parseProtoWorkspace([
  {
    sourceFile: 'TypesEnumType.proto',
    source: `syntax = "proto3";
package sample;
enum Grade { Grade_NONE = 0; Grade_MAX = 1; }
`
  },
  {
    sourceFile: 'KeysTable.proto',
    source: `syntax = "proto3";
package sample;
message Keys {
  // @PK
  int32 id = 1;
  // @PK
  string code = 2;
  // @PK
  .sample.Grade grade = 3;
  // @Key
  bool group = 4;
}
`
  }
])

describe('primary key type policy', () => {
  it('allows int32, int64 and an exactly resolved workspace Enum', () => {
    const violations = validatePrimaryKeyTypePolicy(workspace, 'numeric-or-enum')
    expect(violations.map(({ fieldName }) => fieldName)).toEqual(['code'])
  })

  it('allows only string in string policy and ignores group keys', () => {
    const violations = validatePrimaryKeyTypePolicy(workspace, 'string')
    expect(violations.map(({ fieldName }) => fieldName)).toEqual(['id', 'grade'])
  })

  it('keeps unrestricted workspaces compatible', () => {
    expect(validatePrimaryKeyTypePolicy(workspace, 'unrestricted')).toEqual([])
  })
})
