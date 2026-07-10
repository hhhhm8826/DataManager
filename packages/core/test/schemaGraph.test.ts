import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseProtoWorkspace } from '../src/proto/workspace'
import { buildSchemaGraph, layoutSchemaGraph, schemaGraphNeighbors } from '../src/schemaGraph'

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

describe('schema graph', () => {
  it('matches the M0 fixture node and reference-edge contract', () => {
    const graph = buildSchemaGraph(fixtureWorkspace())

    expect(graph.nodes.map(({ kind, name }) => `${kind}:${name}`)).toEqual([
      'enum:FixtureState',
      'message:CompositeTarget',
      'message:CycleA',
      'message:CycleB',
      'message:GroupTarget',
      'message:MiddleTarget',
      'message:NoKeyTarget',
      'message:RootTarget',
      'message:SingleTarget'
    ])
    expect(
      graph.edges.map(
        ({ messageName, fieldName, fieldType }) => `${messageName}.${fieldName}->${fieldType}`
      )
    ).toEqual([
      'CycleA.b->CycleB',
      'CycleB.a->CycleA',
      'MiddleTarget.single->SingleTarget',
      'RootTarget.composite->CompositeTarget',
      'RootTarget.group->GroupTarget',
      'RootTarget.middle->MiddleTarget',
      'RootTarget.noKey->NoKeyTarget',
      'RootTarget.single->SingleTarget',
      'RootTarget.state->FixtureState',
      'SingleTarget.state->FixtureState'
    ])
    expect(graph.unresolvedReferences).toEqual([])
  })

  it('lays nodes out by the configured maximum and reports neighbors', () => {
    const graph = buildSchemaGraph(fixtureWorkspace())
    const positions = layoutSchemaGraph(graph, 3)

    expect(positions.slice(0, 4)).toEqual([
      { id: graph.nodes[0]?.id, x: 0, y: 0 },
      { id: graph.nodes[1]?.id, x: 0, y: 220 },
      { id: graph.nodes[2]?.id, x: 0, y: 440 },
      { id: graph.nodes[3]?.id, x: 340, y: 0 }
    ])
    const root = graph.nodes.find(({ name }) => name === 'RootTarget')!
    const neighbors = [...schemaGraphNeighbors(graph, root.id)]
      .map((id) => graph.nodes.find((node) => node.id === id)?.name)
      .sort()
    expect(neighbors).toEqual([
      'CompositeTarget',
      'FixtureState',
      'GroupTarget',
      'MiddleTarget',
      'NoKeyTarget',
      'RootTarget',
      'SingleTarget'
    ])
  })

  it('surfaces unresolved non-primitive field types', () => {
    const workspace = parseProtoWorkspace([
      {
        sourceFile: 'BrokenTable.proto',
        source: `syntax = "proto3"; message Broken { MissingType missing = 1; }`
      }
    ])
    const graph = buildSchemaGraph(workspace)

    expect(graph.unresolvedReferences).toEqual([
      {
        sourceFile: 'BrokenTable.proto',
        messageName: 'Broken',
        fieldName: 'missing',
        fieldType: 'MissingType'
      }
    ])
  })
})
