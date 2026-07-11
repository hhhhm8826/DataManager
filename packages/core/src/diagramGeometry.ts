import type { SchemaGraphNode } from './schemaGraph'

export interface DiagramPoint {
  x: number
  y: number
}

export interface DiagramNodeBox extends DiagramPoint {
  id: string
  width: number
  height: number
}

export interface DiagramRoute {
  id: string
  points: DiagramPoint[]
}

export interface SharedRouteSegment {
  firstRouteId: string
  secondRouteId: string
  length: number
}

export const DIAGRAM_NODE_WIDTH = 286
export const DIAGRAM_NODE_HEADER_HEIGHT = 68
export const DIAGRAM_FIELD_ROW_HEIGHT = 32
export const DIAGRAM_NODE_FOOTER_HEIGHT = 12

export function diagramNodeSize(node: SchemaGraphNode): {
  width: number
  height: number
} {
  const rows = node.declaration.kind === 'message' ? node.declaration.fields.length : 0
  return {
    width: DIAGRAM_NODE_WIDTH,
    height:
      DIAGRAM_NODE_HEADER_HEIGHT +
      Math.max(1, rows) * DIAGRAM_FIELD_ROW_HEIGHT +
      DIAGRAM_NODE_FOOTER_HEIGHT
  }
}

export function deterministicDiagramGrid(
  nodes: readonly SchemaGraphNode[],
  horizontalGap = 110,
  verticalGap = 90
): DiagramNodeBox[] {
  const sorted = [...nodes].sort((left, right) => left.id.localeCompare(right.id, 'en'))
  const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length)))
  const rowHeights: number[] = []
  const sizes = sorted.map((node) => diagramNodeSize(node))
  for (const [index, size] of sizes.entries()) {
    const row = Math.floor(index / columns)
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, size.height)
  }
  const rowOffsets = rowHeights.map((_, row) =>
    rowHeights.slice(0, row).reduce((total, height) => total + height + verticalGap, 0)
  )
  return sorted.map((node, index) => {
    const size = sizes[index]!
    return {
      id: node.id,
      x: (index % columns) * (DIAGRAM_NODE_WIDTH + horizontalGap),
      y: rowOffsets[Math.floor(index / columns)] ?? 0,
      ...size
    }
  })
}

export function overlappingNodePairs(
  boxes: readonly DiagramNodeBox[],
  padding = 0
): Array<[string, string]> {
  const overlaps: Array<[string, string]> = []
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    const left = boxes[leftIndex]!
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const right = boxes[rightIndex]!
      if (
        left.x < right.x + right.width + padding &&
        left.x + left.width + padding > right.x &&
        left.y < right.y + right.height + padding &&
        left.y + left.height + padding > right.y
      ) {
        overlaps.push([left.id, right.id])
      }
    }
  }
  return overlaps
}

export function routeNodeIntersections(
  routes: readonly DiagramRoute[],
  boxes: readonly DiagramNodeBox[],
  endpointAllowance = 24
): Array<{ routeId: string; nodeId: string }> {
  const intersections: Array<{ routeId: string; nodeId: string }> = []
  for (const route of routes) {
    for (const box of boxes) {
      const hit = segments(route.points).some(([start, end], index, all) => {
        const firstOrLast = index === 0 || index === all.length - 1
        return segmentIntersectsBox(start, end, box, firstOrLast ? endpointAllowance : 0)
      })
      if (hit) intersections.push({ routeId: route.id, nodeId: box.id })
    }
  }
  return intersections
}

export function countOrthogonalRouteCrossings(routes: readonly DiagramRoute[]): number {
  let crossings = 0
  for (let firstIndex = 0; firstIndex < routes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < routes.length; secondIndex += 1) {
      for (const [firstStart, firstEnd] of segments(routes[firstIndex]!.points)) {
        for (const [secondStart, secondEnd] of segments(routes[secondIndex]!.points)) {
          if (orthogonalSegmentsCross(firstStart, firstEnd, secondStart, secondEnd)) crossings += 1
        }
      }
    }
  }
  return crossings
}

export function sharedRouteSegments(
  routes: readonly DiagramRoute[],
  minimumLength = 24,
  endpointAllowance = 24
): SharedRouteSegment[] {
  const shared: SharedRouteSegment[] = []
  for (let firstIndex = 0; firstIndex < routes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < routes.length; secondIndex += 1) {
      const first = routes[firstIndex]!
      const second = routes[secondIndex]!
      for (const firstSegment of trimmedSegments(first.points, endpointAllowance)) {
        for (const secondSegment of trimmedSegments(second.points, endpointAllowance)) {
          const length = collinearOverlapLength(firstSegment, secondSegment)
          if (length > minimumLength) {
            shared.push({ firstRouteId: first.id, secondRouteId: second.id, length })
          }
        }
      }
    }
  }
  return shared
}

export function normalizeDiagramPosition(point: DiagramPoint): DiagramPoint {
  return { x: roundTo(point.x, 1), y: roundTo(point.y, 1) }
}

export function normalizeDiagramViewport(
  viewport: DiagramPoint & { zoom: number }
): DiagramPoint & {
  zoom: number
} {
  return {
    ...normalizeDiagramPosition(viewport),
    zoom: roundTo(viewport.zoom, 3)
  }
}

function segments(points: readonly DiagramPoint[]): Array<[DiagramPoint, DiagramPoint]> {
  return points.slice(1).map((point, index) => [points[index]!, point])
}

function trimmedSegments(
  points: readonly DiagramPoint[],
  endpointAllowance: number
): Array<[DiagramPoint, DiagramPoint]> {
  const result = segments(points)
  return result.map(([start, end], index) => {
    const nextStart = index === 0 ? moveToward(start, end, endpointAllowance) : start
    const nextEnd = index === result.length - 1 ? moveToward(end, start, endpointAllowance) : end
    return [nextStart, nextEnd]
  })
}

function moveToward(start: DiagramPoint, end: DiagramPoint, distance: number): DiagramPoint {
  const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
  if (length === 0) return start
  const ratio = Math.min(distance, length / 2) / length
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  }
}

function segmentIntersectsBox(
  start: DiagramPoint,
  end: DiagramPoint,
  box: DiagramNodeBox,
  allowance: number
): boolean {
  const left = box.x + allowance
  const right = box.x + box.width - allowance
  const top = box.y + allowance
  const bottom = box.y + box.height - allowance
  if (left >= right || top >= bottom) return false
  if (start.x === end.x) {
    return start.x > left && start.x < right && rangesOverlap(start.y, end.y, top, bottom)
  }
  if (start.y === end.y) {
    return start.y > top && start.y < bottom && rangesOverlap(start.x, end.x, left, right)
  }
  return false
}

function rangesOverlap(first: number, second: number, minimum: number, maximum: number): boolean {
  const low = Math.min(first, second)
  const high = Math.max(first, second)
  return low < maximum && high > minimum
}

function orthogonalSegmentsCross(
  firstStart: DiagramPoint,
  firstEnd: DiagramPoint,
  secondStart: DiagramPoint,
  secondEnd: DiagramPoint
): boolean {
  const firstHorizontal = firstStart.y === firstEnd.y
  const secondHorizontal = secondStart.y === secondEnd.y
  if (firstHorizontal === secondHorizontal) return false
  const horizontalStart = firstHorizontal ? firstStart : secondStart
  const horizontalEnd = firstHorizontal ? firstEnd : secondEnd
  const verticalStart = firstHorizontal ? secondStart : firstStart
  const verticalEnd = firstHorizontal ? secondEnd : firstEnd
  const x = verticalStart.x
  const y = horizontalStart.y
  return (
    x > Math.min(horizontalStart.x, horizontalEnd.x) &&
    x < Math.max(horizontalStart.x, horizontalEnd.x) &&
    y > Math.min(verticalStart.y, verticalEnd.y) &&
    y < Math.max(verticalStart.y, verticalEnd.y)
  )
}

function collinearOverlapLength(
  [firstStart, firstEnd]: [DiagramPoint, DiagramPoint],
  [secondStart, secondEnd]: [DiagramPoint, DiagramPoint]
): number {
  if (
    firstStart.y === firstEnd.y &&
    secondStart.y === secondEnd.y &&
    firstStart.y === secondStart.y
  ) {
    return overlapLength(firstStart.x, firstEnd.x, secondStart.x, secondEnd.x)
  }
  if (
    firstStart.x === firstEnd.x &&
    secondStart.x === secondEnd.x &&
    firstStart.x === secondStart.x
  ) {
    return overlapLength(firstStart.y, firstEnd.y, secondStart.y, secondEnd.y)
  }
  return 0
}

function overlapLength(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
): number {
  return Math.max(
    0,
    Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd)) -
      Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd))
  )
}

function roundTo(value: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}
