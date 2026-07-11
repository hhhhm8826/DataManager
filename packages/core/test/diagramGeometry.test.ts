import { describe, expect, it } from 'vitest'
import {
  buildSchemaGraph,
  countOrthogonalRouteCrossings,
  deterministicDiagramGrid,
  normalizeDiagramPosition,
  normalizeDiagramViewport,
  overlappingNodePairs,
  parseProtoWorkspace,
  routeNodeIntersections,
  sharedRouteSegments
} from '../src'

const nodes = buildSchemaGraph(
  parseProtoWorkspace([
    {
      sourceFile: 'GeometryTable.proto',
      source: `syntax = "proto3";
message Small { int32 id = 1; }
message Tall { int32 a = 1; int32 b = 2; int32 c = 3; int32 d = 4; }
message Other { string value = 1; }
`
    }
  ])
).nodes

describe('diagram geometry', () => {
  it('creates a deterministic non-overlapping fallback without legacy column settings', () => {
    const first = deterministicDiagramGrid(nodes)
    const second = deterministicDiagramGrid([...nodes].reverse())

    expect(first).toEqual(second)
    expect(overlappingNodePairs(first, 24)).toEqual([])
    expect(first.find(({ id }) => id.includes(':Tall'))?.height).toBeGreaterThan(
      first.find(({ id }) => id.includes(':Small'))?.height ?? 0
    )
  })

  it('detects orthogonal routes that pass through a node', () => {
    const boxes = [{ id: 'middle', x: 100, y: 100, width: 200, height: 120 }]
    expect(
      routeNodeIntersections(
        [
          {
            id: 'blocked',
            points: [
              { x: 0, y: 150 },
              { x: 400, y: 150 }
            ]
          }
        ],
        boxes
      )
    ).toEqual([{ routeId: 'blocked', nodeId: 'middle' }])
    expect(
      routeNodeIntersections(
        [
          {
            id: 'clear',
            points: [
              { x: 0, y: 50 },
              { x: 400, y: 50 }
            ]
          }
        ],
        boxes
      )
    ).toEqual([])
  })

  it('normalizes saved position and viewport precision', () => {
    expect(normalizeDiagramPosition({ x: 1.26, y: -2.24 })).toEqual({ x: 1.3, y: -2.2 })
    expect(normalizeDiagramViewport({ x: 1.26, y: -2.24, zoom: 0.87654 })).toEqual({
      x: 1.3,
      y: -2.2,
      zoom: 0.877
    })
  })

  it('counts crossings and long collinear shared segments deterministically', () => {
    const routes = [
      {
        id: 'horizontal',
        points: [
          { x: 0, y: 50 },
          { x: 100, y: 50 }
        ]
      },
      {
        id: 'vertical',
        points: [
          { x: 50, y: 0 },
          { x: 50, y: 100 }
        ]
      },
      {
        id: 'shared',
        points: [
          { x: 20, y: 50 },
          { x: 90, y: 50 }
        ]
      }
    ]
    expect(countOrthogonalRouteCrossings(routes)).toBe(2)
    expect(sharedRouteSegments(routes, 24, 0)).toEqual([
      { firstRouteId: 'horizontal', secondRouteId: 'shared', length: 70 }
    ])
  })
})
