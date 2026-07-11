import type { SchemaGraph, SchemaGraphEdge, SchemaGraphNode } from './schemaGraph'

export interface DiagramProjection {
  nodes: SchemaGraphNode[]
  edges: SchemaGraphEdge[]
  hiddenNodes: SchemaGraphNode[]
  enumNodes: SchemaGraphNode[]
  enumReferences: SchemaGraphEdge[]
  messageRelations: SchemaGraphEdge[]
}

export function projectSchemaDiagram(graph: SchemaGraph, hubThreshold: number): DiagramProjection {
  if (!Number.isInteger(hubThreshold) || hubThreshold < 1 || hubThreshold > 50) {
    throw new RangeError('hubThreshold must be an integer from 1 to 50.')
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const messageNodes = graph.nodes.filter((node) => node.kind === 'message')
  const enumNodes = graph.nodes.filter((node) => node.kind === 'enum')
  const enumReferences = graph.edges.filter((edge) => nodeById.get(edge.target)?.kind === 'enum')
  const messageRelations = graph.edges.filter(
    (edge) =>
      nodeById.get(edge.source)?.kind === 'message' && nodeById.get(edge.target)?.kind === 'message'
  )
  const incomingEdges = new Map(messageNodes.map((node) => [node.id, [] as SchemaGraphEdge[]]))
  for (const edge of messageRelations) incomingEdges.get(edge.target)?.push(edge)

  const modalIds = new Set(
    messageNodes
      .filter((node) => (incomingEdges.get(node.id)?.length ?? 0) >= hubThreshold)
      .map((node) => node.id)
  )
  const nodes = messageNodes.filter((node) => !modalIds.has(node.id))
  const edges = messageRelations.filter(
    (edge) => !modalIds.has(edge.source) && !modalIds.has(edge.target)
  )
  return {
    nodes,
    edges,
    hiddenNodes: messageNodes.filter((node) => modalIds.has(node.id)),
    enumNodes,
    enumReferences,
    messageRelations
  }
}
