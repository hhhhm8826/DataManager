import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  getSmoothStepPath,
  BaseEdge,
  type Node,
  type Edge,
  type Connection,
  type EdgeProps
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAppStore } from '../../store/appStore'
import { TableNode } from './TableNode'
import { toast } from 'sonner'
import type { ProtoMessage } from '../../../../shared/types'

const NODE_TYPES = { tableNode: TableNode }

const PARALLEL_OFFSET = 7

function OffsetEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  data,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius
}: EdgeProps): React.JSX.Element {
  const offset = (data as { parallelOffset?: number })?.parallelOffset ?? 0
  // 엣지 방향에 수직인 방향으로 오프셋 → 가로/세로 엣지 모두 분리
  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const perpX = (-dy / len) * offset
  const perpY = (dx / len) * offset
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sourceX + perpX,
    sourceY: sourceY + perpY,
    sourcePosition,
    targetX: targetX + perpX,
    targetY: targetY + perpY,
    targetPosition
  })
  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
    />
  )
}

const EDGE_TYPES = { offsetEdge: OffsetEdge }

const NODE_WIDTH = 260
const NODE_HEIGHT_BASE = 60
const NODE_FIELD_HEIGHT = 30
const COLUMN_GAP = 400
const ROW_GAP = 400

/** DAG 레이아웃
 *  - 연결 없는 고립 노드 → 하단 별도 행
 *  - 허브(총 연결 수 최다) 열 → 수평 중앙(x=0), 좌우로 양방향 확장
 *  - 열 내 정렬: 연결 많은 노드 → 수직 중앙
 */
function buildLayout(
  messages: ProtoMessage[],
  edges: { source: string; target: string }[],
  maxPerCol: number
): { x: number; y: number }[] {
  if (messages.length === 0) return []

  const nameToIdx = new Map(messages.map((m, i) => [m.name, i]))
  const n = messages.length
  const heights = messages.map((msg) => NODE_HEIGHT_BASE + msg.fields.length * NODE_FIELD_HEIGHT)
  const MAX_PER_COL = maxPerCol
  const SUB_COL_GAP = 40

  // 차수 및 인접 리스트
  const inDeg = new Array(n).fill(0)
  const outDeg = new Array(n).fill(0)
  const adj = new Array(n).fill(null).map(() => [] as number[])
  for (const e of edges) {
    const s = nameToIdx.get(e.source)
    const t = nameToIdx.get(e.target)
    if (s !== undefined && t !== undefined && s !== t) {
      adj[s].push(t)
      inDeg[t]++
      outDeg[s]++
    }
  }

  // 고립 노드 분리 (in=0, out=0)
  const isolated: number[] = []
  const connected: number[] = []
  for (let i = 0; i < n; i++) {
    if (inDeg[i] === 0 && outDeg[i] === 0) isolated.push(i)
    else connected.push(i)
  }

  const positions = new Array(n).fill(null).map(() => ({ x: 0, y: 0 }))

  // ── 연결 노드: Kahn BFS 깊이 할당 ──
  if (connected.length > 0) {
    const inDegreeCopy = [...inDeg]
    const depth = new Array(n).fill(0)
    const queue: number[] = []
    for (const i of connected) {
      if (inDegreeCopy[i] === 0) queue.push(i)
    }
    while (queue.length) {
      const cur = queue.shift()!
      for (const nxt of adj[cur]) {
        depth[nxt] = Math.max(depth[nxt], depth[cur] + 1)
        inDegreeCopy[nxt]--
        if (inDegreeCopy[nxt] === 0) queue.push(nxt)
      }
    }

    // 깊이별 그룹화
    const cols = new Map<number, number[]>()
    for (const i of connected) {
      const d = depth[i]
      if (!cols.has(d)) cols.set(d, [])
      cols.get(d)!.push(i)
    }
    const sortedDepths = [...cols.keys()].sort((a, b) => a - b)

    // 허브 깊이: 총 차수 합이 가장 많은 열
    let maxDegSum = -1
    let hubDepth = sortedDepths[Math.floor(sortedDepths.length / 2)]
    for (const d of sortedDepths) {
      const s = cols.get(d)!.reduce((acc, i) => acc + inDeg[i] + outDeg[i], 0)
      if (s > maxDegSum) {
        maxDegSum = s
        hubDepth = d
      }
    }

    // 열 내 정렬: 연결 많은 노드 → 수직 중앙 (인터리브 배치)
    for (const [, group] of cols) {
      group.sort((a, b) => inDeg[b] + outDeg[b] - (inDeg[a] + outDeg[a]))
      const reordered: number[] = new Array(group.length)
      let lo = Math.floor((group.length - 1) / 2)
      let hi = lo + 1
      for (let k = 0; k < group.length; k++) {
        if (k % 2 === 0) {
          reordered[lo >= 0 ? lo-- : hi++] = group[k]
        } else {
          reordered[hi < group.length ? hi++ : lo--] = group[k]
        }
      }
      group.splice(0, group.length, ...reordered)
    }

    // 열 너비 (서브 열 포함)
    const colWidth = (d: number): number => {
      const cnt = cols.get(d)?.length ?? 0
      return Math.ceil(cnt / MAX_PER_COL) * (NODE_WIDTH + SUB_COL_GAP) - SUB_COL_GAP
    }

    // 허브 열 → x=0, 우측/좌측으로 양방향 확장
    const depthStartX = new Map<number, number>()
    depthStartX.set(hubDepth, 0)
    let rx = colWidth(hubDepth) + COLUMN_GAP
    for (const d of sortedDepths.filter((d) => d > hubDepth)) {
      depthStartX.set(d, rx)
      rx += colWidth(d) + COLUMN_GAP
    }
    let lx = -COLUMN_GAP
    for (const d of sortedDepths.filter((d) => d < hubDepth).reverse()) {
      const w = colWidth(d)
      depthStartX.set(d, lx - w)
      lx -= w + COLUMN_GAP
    }

    // 위치 할당 (열마다 약간의 X 편차 부여)
    const COL_X_JITTER = 40 // 최대 편차 px
    for (let di = 0; di < sortedDepths.length; di++) {
      const d = sortedDepths[di]
      const group = cols.get(d)!
      const baseX = depthStartX.get(d)!
      const totalSubCols = Math.ceil(group.length / MAX_PER_COL)
      // 깊이 인덱스 기반 삼각함수 오프셋 → 인접 열이 서로 다른 방향으로 편차
      const depthJitter =
        Math.sin((di / Math.max(sortedDepths.length - 1, 1)) * Math.PI * 2.5) * COL_X_JITTER
      for (let chunk = 0; chunk < totalSubCols; chunk++) {
        const slice = group.slice(chunk * MAX_PER_COL, (chunk + 1) * MAX_PER_COL)
        // 서브 열마다 추가 편차 (짝/홀 반전)
        const chunkJitter = chunk % 2 === 0 ? depthJitter : -depthJitter * 0.5
        const x = baseX + chunk * (NODE_WIDTH + SUB_COL_GAP) + chunkJitter
        const totalH = slice.reduce((sum, i) => sum + heights[i] + ROW_GAP, -ROW_GAP)
        let y = -totalH / 2
        slice.forEach((i) => {
          positions[i] = { x, y }
          y += heights[i] + ROW_GAP
        })
      }
    }
  }

  // ── 고립 노드: 연결 노드 하단 별도 행 ──
  if (isolated.length > 0) {
    let maxBottom = 0
    for (const i of connected) {
      const b = positions[i].y + heights[i]
      if (b > maxBottom) maxBottom = b
    }
    const ISOLATED_GAP = 220
    const startY = connected.length > 0 ? maxBottom + ISOLATED_GAP : 0
    const rowCols = Math.min(isolated.length, MAX_PER_COL)
    const rowWidth = rowCols * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP

    isolated.forEach((nodeIdx, k) => {
      const col = k % MAX_PER_COL
      const row = Math.floor(k / MAX_PER_COL)
      positions[nodeIdx] = {
        x: -rowWidth / 2 + col * (NODE_WIDTH + COLUMN_GAP),
        y: startY + row * (heights[nodeIdx] + ROW_GAP)
      }
    })
  }

  return positions
}

export function DiagramView(): React.JSX.Element {
  const { parsed, parseErrors, isLoadingProto, loadProto, settings } = useAppStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredPair, setHoveredPair] = useState<{
    source: string
    sourceField: string
    target: string
    targetField: string
  } | null>(null)

  // 파싱 에러 → 토스트
  useEffect(() => {
    parseErrors.forEach((err) => toast.error(err))
  }, [parseErrors])

  // 노드/엣지 빌드
  useEffect(() => {
    if (!parsed) return
    const { messages, enums } = parsed

    // 엣지 빌드 + 참조되는 필드 수집
    const messageNames = new Set(messages.map((m) => m.name))
    const newEdges: Edge[] = []
    const edgeSet = new Set<string>()
    const referencedFieldsMap = new Map<string, Set<string>>()
    // 레이아웃용 간선 목록
    const layoutEdges: { source: string; target: string }[] = []

    messages.forEach((msg) => {
      msg.fields.forEach((field) => {
        if (messageNames.has(field.type) && field.type !== msg.name) {
          layoutEdges.push({ source: msg.name, target: field.type })
          const edgeId = `${msg.name}.${field.name}->${field.type}`
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId)
            const targetMsg = messages.find((m) => m.name === field.type)
            const targetPk = targetMsg?.pkFields[0] ?? targetMsg?.fields[0]?.name
            if (targetPk) {
              if (!referencedFieldsMap.has(field.type))
                referencedFieldsMap.set(field.type, new Set())
              referencedFieldsMap.get(field.type)!.add(targetPk)
            }
            newEdges.push({
              id: edgeId,
              type: 'offsetEdge',
              source: msg.name,
              sourceHandle: `src-${field.name}`,
              target: field.type,
              targetHandle: targetPk ? `tgt-${targetPk}` : undefined,
              zIndex: 0,
              style: { stroke: '#a0c4ff', strokeWidth: 1.5 },
              labelStyle: { fontSize: 10, fill: '#9ca3af' }
            })
          }
        }
      })
    })

    const positions = buildLayout(messages, layoutEdges, settings?.diagramMaxPerCol ?? 8)

    const newNodes: Node[] = messages.map((msg, i) => ({
      id: msg.name,
      type: 'tableNode',
      position: positions[i],
      data: {
        message: msg,
        allEnums: enums,
        allMessages: messages,
        onMessageHover: setHoveredPair,
        referencedFields: referencedFieldsMap.get(msg.name) ?? new Set<string>()
      }
    }))

    // 동일 (source, target) 쌍 엣지에 Y 오프셋 부여 → 겹침 분리
    const pairGroups = new Map<string, string[]>()
    newEdges.forEach((e) => {
      const key = `${e.source}--${e.target}`
      if (!pairGroups.has(key)) pairGroups.set(key, [])
      pairGroups.get(key)!.push(e.id)
    })
    const edgesWithOffset: Edge[] = newEdges.map((e) => {
      const key = `${e.source}--${e.target}`
      const group = pairGroups.get(key)!
      const idx = group.indexOf(e.id)
      const offset = (idx - (group.length - 1) / 2) * PARALLEL_OFFSET
      return { ...e, data: { parallelOffset: offset } }
    })

    setNodes(newNodes)
    setEdges(edgesWithOffset)
  }, [parsed, settings?.diagramMaxPerCol, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onEdgeMouseEnter = useCallback(
    (_evt: React.MouseEvent, edge: Edge) => {
      const match = edge.id.match(/^(.+)\.(.+)->(.+)$/)
      if (match) {
        const [, source, sourceField, target] = match
        const targetMsg = parsed?.messages.find((m) => m.name === target)
        const targetField = targetMsg?.pkFields[0] ?? targetMsg?.fields[0]?.name ?? ''
        setHoveredPair({ source, sourceField, target, targetField })
      }
    },
    [parsed]
  )

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredPair(null)
  }, [])

  // 검색 쿼리에 따라 노드 opacity 조정
  const q = searchQuery.trim().toLowerCase()
  const displayNodes: Node[] = nodes.map((node) => {
    const nodeMsg = (node.data as { message?: ProtoMessage }).message
    const fileColor = nodeMsg ? settings?.fileColors?.[nodeMsg.sourceFile] : undefined
    const matched = !q || node.id.toLowerCase().includes(q)
    const isHighlighted = hoveredPair
      ? node.id === hoveredPair.source || node.id === hoveredPair.target
      : false
    return {
      ...node,
      data: { ...node.data, isHighlighted, hoveredConnection: hoveredPair, fileColor },
      style: {
        ...node.style,
        opacity: matched ? 1 : 0.15,
        transition: 'opacity 0.2s'
      }
    }
  })
  const matchCount = q
    ? displayNodes.filter((n) => (n.style?.opacity ?? 1) === 1).length
    : nodes.length

  // 엣지 강조: hover 중인 연결은 주황/굵게, 나머지는 흐리게
  const displayEdges: Edge[] = edges.map((edge) => {
    const isActive = hoveredPair
      ? edge.source === hoveredPair.source &&
        edge.target === hoveredPair.target &&
        edge.sourceHandle === `src-${hoveredPair.sourceField}`
      : false
    return {
      ...edge,
      animated: isActive,
      zIndex: isActive ? 1000 : 0,
      style: isActive
        ? { stroke: '#ffaa44', strokeWidth: 3 }
        : { stroke: '#a0c4ff', strokeWidth: 1.5, opacity: hoveredPair ? 0.2 : 1 },
      label: isActive ? `${hoveredPair!.sourceField}  →  ${hoveredPair!.targetField}` : undefined,
      labelStyle: isActive ? { fontSize: 11, fill: '#ffaa44', fontWeight: 700 } : undefined,
      labelBgStyle: isActive ? { fill: '#1a1a2e', fillOpacity: 0.9 } : undefined,
      labelBgPadding: isActive ? ([6, 3] as [number, number]) : undefined,
      labelBgBorderRadius: isActive ? 4 : undefined
    }
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <span className="page-title">테이블 관계도</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 검색 입력창 */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="테이블 검색..."
              style={{
                background: '#16213e',
                border: '1px solid #0f3460',
                borderRadius: 6,
                color: '#e0e0e0',
                padding: '5px 28px 5px 10px',
                fontSize: 13,
                width: 180,
                outline: 'none'
              }}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            ) : (
              <span
                style={{
                  position: 'absolute',
                  right: 8,
                  color: '#4b5563',
                  fontSize: 13,
                  pointerEvents: 'none'
                }}
              >
                🔍
              </span>
            )}
          </div>
          {q && (
            <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {matchCount}개 일치
            </span>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={loadProto}
          disabled={isLoadingProto}
          style={{ marginLeft: 'auto' }}
        >
          {isLoadingProto ? '로딩 중...' : '🔄 다시 불러오기'}
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {!parsed || parsed.messages.length === 0 ? (
          <div className="empty-state">
            <p>설정에서 proto 디렉토리를 지정하고 불러오기를 클릭하세요.</p>
          </div>
        ) : (
          <ReactFlow
            key={settings?.diagramMaxPerCol ?? 8}
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            fitView
            elevateEdgesOnSelect={false}
            style={{ background: '#1a1a2e' }}
          >
            <Background color="#0f3460" gap={24} />
            <Controls style={{ background: '#16213e', border: '1px solid #0f3460' }} />
            <MiniMap
              style={{ background: '#16213e', border: '1px solid #0f3460' }}
              nodeColor="#0f3460"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
