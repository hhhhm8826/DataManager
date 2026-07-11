import {
  deterministicDiagramGrid,
  diagramNodeSize,
  normalizeDiagramPosition,
  type DiagramPoint,
  type DiagramProjection
} from '@datamanager/core'

export interface DiagramLayoutInputNode {
  id: string
  width: number
  height: number
  fieldNames: string[]
  incomingEdgeIds: string[]
}

export interface DiagramLayoutInputEdge {
  id: string
  source: string
  target: string
  fieldName: string
}

export interface DiagramLayoutInput {
  nodes: DiagramLayoutInputNode[]
  edges: DiagramLayoutInputEdge[]
}

export interface DiagramLayoutNode extends DiagramPoint {
  id: string
  width: number
  height: number
}

export interface DiagramLayoutEdge {
  id: string
  points: DiagramPoint[]
}

export interface DiagramLayoutResult {
  nodes: DiagramLayoutNode[]
  edges: DiagramLayoutEdge[]
}

export type DiagramLayoutRunner = (
  projection: DiagramProjection,
  revision: number
) => Promise<DiagramLayoutResult>

export function createDiagramLayoutInput(projection: DiagramProjection): DiagramLayoutInput {
  return {
    nodes: [...projection.nodes]
      .sort((left, right) => left.id.localeCompare(right.id, 'en'))
      .map((node) => {
        const size = diagramNodeSize(node)
        return {
          id: node.id,
          ...size,
          fieldNames:
            node.declaration.kind === 'message'
              ? node.declaration.fields.map(({ name }) => name)
              : [],
          incomingEdgeIds: projection.edges
            .filter((edge) => edge.target === node.id)
            .map((edge) => edge.id)
            .sort((left, right) => left.localeCompare(right, 'en'))
        }
      }),
    edges: [...projection.edges]
      .sort((left, right) => left.id.localeCompare(right.id, 'en'))
      .map(({ id, source, target, fieldName }) => ({ id, source, target, fieldName }))
  }
}

export const runDiagramLayoutWorker: DiagramLayoutRunner = async (projection, revision) => {
  void revision
  const { layoutDiagramWithElk } = await import('./diagramLayoutEngine')
  return layoutDiagramWithElk(createDiagramLayoutInput(projection))
}

export function fallbackDiagramLayout(projection: DiagramProjection): DiagramLayoutResult {
  const boxes = deterministicDiagramGrid(projection.nodes).map((box) => {
    const node = projection.nodes.find(({ id }) => id === box.id)!
    const size = diagramNodeSize(node)
    return { ...box, ...size, ...normalizeDiagramPosition(box) }
  })
  return { nodes: boxes, edges: [] }
}
