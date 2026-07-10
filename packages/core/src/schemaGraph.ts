import type { ProtoEnumDeclaration, ProtoMessageDeclaration, ProtoWorkspace } from './proto/model'

export type SchemaGraphNodeKind = 'message' | 'enum'

export interface SchemaGraphNode {
  id: string
  kind: SchemaGraphNodeKind
  name: string
  sourceFile: string
  declaration: ProtoMessageDeclaration | ProtoEnumDeclaration
}

export interface SchemaGraphEdge {
  id: string
  source: string
  target: string
  sourceFile: string
  messageName: string
  fieldName: string
  fieldType: string
  repeated: boolean
}

export interface UnresolvedSchemaReference {
  sourceFile: string
  messageName: string
  fieldName: string
  fieldType: string
}

export interface SchemaGraph {
  nodes: SchemaGraphNode[]
  edges: SchemaGraphEdge[]
  unresolvedReferences: UnresolvedSchemaReference[]
}

export interface SchemaNodePosition {
  id: string
  x: number
  y: number
}

const primitiveTypes = new Set([
  'bool',
  'bytes',
  'double',
  'fixed32',
  'fixed64',
  'float',
  'int32',
  'int64',
  'sfixed32',
  'sfixed64',
  'sint32',
  'sint64',
  'string',
  'uint32',
  'uint64'
])

export function buildSchemaGraph(workspace: ProtoWorkspace): SchemaGraph {
  const nodes: SchemaGraphNode[] = [
    ...workspace.messages.map((declaration) => graphNode('message', declaration)),
    ...workspace.enums.map((declaration) => graphNode('enum', declaration))
  ].sort(compareNodes)
  const nodeByTypeName = new Map(
    nodes
      .filter((node) => workspace.typeSources.has(node.name))
      .map((node) => [node.name, node] as const)
  )
  const edges: SchemaGraphEdge[] = []
  const unresolvedReferences: UnresolvedSchemaReference[] = []

  for (const message of workspace.messages) {
    const source = nodeByTypeName.get(message.name)
    if (!source) continue
    for (const field of message.fields) {
      const fieldType = unqualifiedType(field.type)
      if (primitiveTypes.has(fieldType)) continue
      const target = nodeByTypeName.get(fieldType)
      if (!target) {
        unresolvedReferences.push({
          sourceFile: message.sourceFile,
          messageName: message.name,
          fieldName: field.name,
          fieldType: field.type
        })
        continue
      }
      edges.push({
        id: `${source.id}:${field.name}:${field.fieldNumber}->${target.id}`,
        source: source.id,
        target: target.id,
        sourceFile: message.sourceFile,
        messageName: message.name,
        fieldName: field.name,
        fieldType: field.type,
        repeated: field.label === 'repeated'
      })
    }
  }

  edges.sort(
    (left, right) =>
      left.messageName.localeCompare(right.messageName, 'en') ||
      left.fieldName.localeCompare(right.fieldName, 'en') ||
      left.id.localeCompare(right.id, 'en')
  )
  unresolvedReferences.sort((left, right) =>
    `${left.sourceFile}:${left.messageName}:${left.fieldName}`.localeCompare(
      `${right.sourceFile}:${right.messageName}:${right.fieldName}`,
      'en'
    )
  )
  return { nodes, edges, unresolvedReferences }
}

export function layoutSchemaGraph(
  graph: SchemaGraph,
  maxNodesPerColumn: number,
  horizontalGap = 340,
  verticalGap = 220
): SchemaNodePosition[] {
  if (!Number.isInteger(maxNodesPerColumn) || maxNodesPerColumn < 1) {
    throw new RangeError('maxNodesPerColumn must be a positive integer.')
  }
  return graph.nodes.map((node, index) => ({
    id: node.id,
    x: Math.floor(index / maxNodesPerColumn) * horizontalGap,
    y: (index % maxNodesPerColumn) * verticalGap
  }))
}

export function schemaGraphNeighbors(graph: SchemaGraph, nodeId: string): ReadonlySet<string> {
  const neighbors = new Set<string>([nodeId])
  for (const edge of graph.edges) {
    if (edge.source === nodeId) neighbors.add(edge.target)
    if (edge.target === nodeId) neighbors.add(edge.source)
  }
  return neighbors
}

function graphNode(
  kind: SchemaGraphNodeKind,
  declaration: ProtoMessageDeclaration | ProtoEnumDeclaration
): SchemaGraphNode {
  return {
    id: `${kind}:${declaration.sourceFile}:${declaration.name}`,
    kind,
    name: declaration.name,
    sourceFile: declaration.sourceFile,
    declaration
  }
}

function compareNodes(left: SchemaGraphNode, right: SchemaGraphNode): number {
  return (
    left.kind.localeCompare(right.kind, 'en') ||
    left.name.localeCompare(right.name, 'en') ||
    left.sourceFile.localeCompare(right.sourceFile, 'en')
  )
}

function unqualifiedType(type: string): string {
  return type.replace(/^\./, '').split('.').at(-1) ?? type
}
