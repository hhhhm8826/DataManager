import ELKConstructor, { type ELK } from 'elkjs/lib/elk-api.js'
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url'
import {
  DIAGRAM_FIELD_ROW_HEIGHT,
  DIAGRAM_NODE_HEADER_HEIGHT,
  normalizeDiagramPosition,
  routeNodeIntersections,
  type DiagramPoint
} from '@datamanager/core'
import type { ElkExtendedEdge, ElkNode, ElkPort } from 'elkjs/lib/elk-api'
import type {
  DiagramLayoutEdge,
  DiagramLayoutInput,
  DiagramLayoutInputNode,
  DiagramLayoutNode,
  DiagramLayoutResult
} from './diagramLayout'

let elkPromise: Promise<ELK> | null = null

export async function layoutDiagramWithElk(
  input: DiagramLayoutInput
): Promise<DiagramLayoutResult> {
  const elk = await getElk()
  const graph = await elk.layout(toElkGraph(input))
  const nodes = (graph.children ?? []).map((node): DiagramLayoutNode => ({
    id: node.id,
    ...normalizeDiagramPosition({ x: node.x ?? 0, y: node.y ?? 0 }),
    width: node.width ?? 0,
    height: node.height ?? 0
  }))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const inputNodeById = new Map(input.nodes.map((node) => [node.id, node]))
  const edges = (graph.edges ?? []).map((edge): DiagramLayoutEdge => {
    const inputEdge = input.edges.find(({ id }) => id === edge.id)!
    if (inputEdge.source === inputEdge.target) {
      return selfLoopRoute(
        inputEdge,
        inputNodeById.get(inputEdge.source)!,
        nodeById.get(inputEdge.source)!,
        nodes
      )
    }
    const section = edge.sections?.[0]
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      : []
    return { id: edge.id, points: points.map(normalizeDiagramPosition) }
  })
  return {
    nodes: nodes.sort((left, right) => left.id.localeCompare(right.id, 'en')),
    edges: edges.sort((left, right) => left.id.localeCompare(right.id, 'en'))
  }
}

async function getElk(): Promise<ELK> {
  elkPromise ??=
    typeof Worker === 'undefined'
      ? import('elkjs/lib/elk.bundled.js').then(({ default: BundledELK }) => new BundledELK())
      : Promise.resolve(new ELKConstructor({ workerUrl: elkWorkerUrl }))
  return elkPromise
}

function toElkGraph(input: DiagramLayoutInput): ElkNode {
  return {
    id: 'diagram-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.nodeNode': '90',
      'elk.spacing.edgeNode': '32',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES'
    },
    children: input.nodes.map(toElkNode),
    edges: input.edges.map((edge): ElkExtendedEdge => ({
      id: edge.id,
      sources: [`${edge.source}::source::${edge.fieldName}`],
      targets: [`${edge.target}::target::${edge.id}`]
    }))
  }
}

function toElkNode(node: DiagramLayoutInputNode): ElkNode {
  const targetPorts = node.incomingEdgeIds.map((edgeId): ElkPort => ({
    id: `${node.id}::target::${edgeId}`,
    width: 4,
    height: 4,
    layoutOptions: { 'elk.port.side': 'WEST' }
  }))
  const sourcePorts = node.fieldNames.map((fieldName): ElkPort => ({
    id: `${node.id}::source::${fieldName}`,
    width: 4,
    height: 4,
    layoutOptions: { 'elk.port.side': 'EAST' }
  }))
  return {
    id: node.id,
    width: node.width,
    height: node.height,
    ports: [...targetPorts, ...sourcePorts],
    layoutOptions: {
      'elk.portConstraints': 'FIXED_ORDER',
      'elk.layered.mergeEdges': 'false'
    }
  }
}

function selfLoopRoute(
  edge: DiagramLayoutInput['edges'][number],
  inputNode: DiagramLayoutInputNode,
  node: DiagramLayoutNode,
  allNodes: readonly DiagramLayoutNode[]
): DiagramLayoutEdge {
  const fieldIndex = Math.max(0, inputNode.fieldNames.indexOf(edge.fieldName))
  const source: DiagramPoint = {
    x: node.x + node.width,
    y: node.y + DIAGRAM_NODE_HEADER_HEIGHT + (fieldIndex + 0.5) * DIAGRAM_FIELD_ROW_HEIGHT
  }
  const target: DiagramPoint = { x: node.x, y: node.y + DIAGRAM_NODE_HEADER_HEIGHT / 2 }
  const right = node.x + node.width + 58
  const left = node.x - 42
  const loopYs = [node.y - 48, node.y + node.height + 48, node.y - 96, node.y + node.height + 96]
  const candidates = loopYs.map((loopY) => [
    source,
    { x: right, y: source.y },
    { x: right, y: loopY },
    { x: left, y: loopY },
    { x: left, y: target.y },
    target
  ])
  const otherNodes = allNodes.filter(({ id }) => id !== node.id)
  const points =
    candidates.find(
      (candidate) =>
        routeNodeIntersections([{ id: edge.id, points: candidate }], otherNodes).length === 0
    ) ?? candidates[0]!
  return { id: edge.id, points: points.map(normalizeDiagramPosition) }
}
