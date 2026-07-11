import { describe, expect, it } from 'vitest'
import {
  buildSchemaGraph,
  countOrthogonalRouteCrossings,
  overlappingNodePairs,
  parseProtoWorkspace,
  projectSchemaDiagram,
  routeNodeIntersections,
  sharedRouteSegments
} from '@datamanager/core'
import { createDiagramLayoutInput } from '../src/features/diagram/diagramLayout'
import { layoutDiagramWithElk } from '../src/features/diagram/diagramLayoutEngine'

const projection = projectSchemaDiagram(
  buildSchemaGraph(
    parseProtoWorkspace([
      {
        sourceFile: 'LayoutTable.proto',
        source: `syntax = "proto3";
message A { B first = 1; B second = 2; A parent = 3; }
message B { C next = 1; }
message C { A back = 1; }
message Isolated { int32 id = 1; string note = 2; }
`
      }
    ])
  ),
  50
)

describe('ELK diagram layout', () => {
  it('is deterministic, non-overlapping, and preserves field-specific parallel ports', async () => {
    const input = createDiagramLayoutInput(projection)
    const first = await layoutDiagramWithElk(input)
    const second = await layoutDiagramWithElk({
      nodes: [...input.nodes].reverse(),
      edges: [...input.edges].reverse()
    })

    expect(first).toEqual(second)
    expect(overlappingNodePairs(first.nodes, 20)).toEqual([])
    const parallel = input.edges.filter(
      (edge) => edge.source.includes(':A') && edge.target.includes(':B')
    )
    expect(parallel.map(({ fieldName }) => fieldName)).toEqual(['first', 'second'])
    expect(first.edges.filter(({ id }) => parallel.some((edge) => edge.id === id))).toHaveLength(2)
    const parallelRoutes = first.edges.filter(({ id }) => parallel.some((edge) => edge.id === id))
    expect(parallelRoutes[0]?.points).not.toEqual(parallelRoutes[1]?.points)
    expect(routeNodeIntersections(first.edges, first.nodes)).toEqual([])
    expect(sharedRouteSegments(first.edges)).toEqual([])
    expect(countOrthogonalRouteCrossings(first.edges)).toBeLessThanOrEqual(4)
  })

  it('routes self references outside the node bounds', async () => {
    const result = await layoutDiagramWithElk(createDiagramLayoutInput(projection))
    const selfEdge = projection.edges.find((edge) => edge.source === edge.target)!
    const route = result.edges.find(({ id }) => id === selfEdge.id)!
    const node = result.nodes.find(({ id }) => id === selfEdge.source)!

    expect(
      Math.min(...route.points.map(({ y }) => y)) < node.y ||
        Math.max(...route.points.map(({ y }) => y)) > node.y + node.height
    ).toBe(true)
    expect(Math.max(...route.points.map(({ x }) => x))).toBeGreaterThan(node.x + node.width)
  })

  it('lays out a 100 node and 300 edge synthetic graph within the worker budget', async () => {
    const nodes = Array.from({ length: 100 }, (_, index) => ({
      id: `node-${String(index).padStart(3, '0')}`,
      width: 286,
      height: 144,
      fieldNames: ['first', 'second', 'third'],
      incomingEdgeIds: Array.from(
        { length: 3 },
        (_, offset) => `edge-${String((index - offset - 1 + 100) % 100).padStart(3, '0')}-${offset}`
      )
    }))
    const edges = nodes.flatMap((node, index) =>
      [0, 1, 2].map((offset) => ({
        id: `edge-${String(index).padStart(3, '0')}-${offset}`,
        source: node.id,
        target: nodes[(index + offset + 1) % nodes.length]!.id,
        fieldName: ['first', 'second', 'third'][offset]!
      }))
    )
    const started = performance.now()
    const result = await layoutDiagramWithElk({ nodes, edges })

    expect(performance.now() - started).toBeLessThan(15_000)
    expect(result.nodes).toHaveLength(100)
    expect(result.edges).toHaveLength(300)
    expect(overlappingNodePairs(result.nodes)).toEqual([])
  }, 20_000)
})
