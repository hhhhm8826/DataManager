import { describe, expect, it } from 'vitest'
import { buildSchemaGraph, parseProtoWorkspace, projectSchemaDiagram } from '../src'

function graphFor(source: string) {
  return buildSchemaGraph(parseProtoWorkspace([{ sourceFile: 'GraphTable.proto', source }]))
}

describe('diagram projection', () => {
  it('removes Enum nodes and edges while retaining their modal reference data', () => {
    const projection = projectSchemaDiagram(
      graphFor(`syntax = "proto3";
enum State { State_NONE = 0; State_MAX = 1; }
message Item { State state = 1; }
`),
      5
    )

    expect(projection.nodes.map(({ name }) => name)).toEqual(['Item'])
    expect(projection.edges).toEqual([])
    expect(projection.enumNodes.map(({ name }) => name)).toEqual(['State'])
    expect(projection.enumReferences.map(({ fieldName }) => fieldName)).toEqual(['state'])
  })

  it('moves targets at the incoming-reference threshold into modal data', () => {
    const projection = projectSchemaDiagram(
      graphFor(`syntax = "proto3";
message SourceA { Target first = 1; Target second = 2; Other outgoing = 3; }
message SourceB { Target third = 1; }
message Target { int32 id = 1; }
message Other { int32 id = 1; }
`),
      3
    )

    expect(projection.nodes.map(({ name }) => name)).toEqual(['Other', 'SourceA', 'SourceB'])
    expect(projection.hiddenNodes.map(({ name }) => name)).toEqual(['Target'])
    expect(projection.edges.map(({ fieldName }) => fieldName)).toEqual(['outgoing'])
  })

  it('ignores outgoing count and keeps targets below the threshold visible', () => {
    const projection = projectSchemaDiagram(
      graphFor(`syntax = "proto3";
message Source { Target first = 1; Target second = 2; Other third = 3; }
message Target { int32 id = 1; }
message Other { int32 id = 1; }
`),
      3
    )

    expect(projection.hiddenNodes).toEqual([])
    expect(projection.nodes.map(({ name }) => name)).toEqual(['Other', 'Source', 'Target'])
    expect(projection.edges).toHaveLength(3)
  })

  it('rejects invalid threshold values without changing a projection', () => {
    const graph = graphFor('syntax = "proto3"; message Item { int32 id = 1; }')
    for (const threshold of [0, 1.5, 51]) {
      expect(() => projectSchemaDiagram(graph, threshold)).toThrow(RangeError)
    }
  })
})
