import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import type { ProtoMessage, ProtoEnum } from '../../../../shared/types'
import { EnumModal } from '../EnumModal'

interface TableNodeData {
  message: ProtoMessage
  allEnums: ProtoEnum[]
  allMessages: ProtoMessage[]
  isHighlighted?: boolean
  onMessageHover?: (pair: { source: string; target: string } | null) => void
  referencedFields?: Set<string>
  [key: string]: unknown
}

const PRIMITIVE_TYPES = new Set([
  'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
  'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
  'bool', 'string', 'bytes'
])

// 헤더 높이 + 필드 영역 시작 오프셋 (px) — 레이아웃 상수와 동기화
const HANDLE_HEADER_H = 36
const HANDLE_FIELD_TOP = 4
const HANDLE_FIELD_H = 30

export function TableNode({ data }: NodeProps): React.JSX.Element {
  const { message, allEnums, allMessages, isHighlighted, onMessageHover, referencedFields } = data as TableNodeData
  const messageNames = new Set(allMessages?.map((m) => m.name) ?? [])
  const [enumModal, setEnumModal] = useState<{ field: string; protoEnum: ProtoEnum } | null>(null)
  const [hoveredFieldType, setHoveredFieldType] = useState<string | null>(null)

  const handleFieldDoubleClick = (fieldName: string, fieldType: string): void => {
    const found = allEnums.find((e) => e.name === fieldType)
    if (found) {
      setEnumModal({ field: fieldName, protoEnum: found })
    }
  }

  const fieldTop = (idx: number): number =>
    HANDLE_HEADER_H + HANDLE_FIELD_TOP + idx * HANDLE_FIELD_H + HANDLE_FIELD_H / 2

  return (
    <>
      {/* 필드별 target handle (왼쪽, 참조되는 필드만) */}
      {message.fields.map((field, idx) => {
        if (!referencedFields?.has(field.name)) return null
        return (
          <Handle
            key={`tgt-${field.name}`}
            type="target"
            position={Position.Left}
            id={`tgt-${field.name}`}
            style={{ top: fieldTop(idx), background: '#6fcf97', width: 8, height: 8, border: 'none' }}
          />
        )
      })}

      {/* 필드별 source handle (오른쪽, Message 참조 필드만) */}
      {message.fields.map((field, idx) => {
        const isMsg = messageNames.has(field.type) && field.type !== message.name
        if (!isMsg) return null
        return (
          <Handle
            key={`src-${field.name}`}
            type="source"
            position={Position.Right}
            id={`src-${field.name}`}
            style={{ top: fieldTop(idx), background: '#a0c4ff', width: 8, height: 8, border: 'none' }}
          />
        )
      })}

      <div
        style={{
          background: '#16213e',
          border: isHighlighted ? '2px solid #ffaa44' : '1px solid #0f3460',
          borderRadius: 8,
          minWidth: 220,
          fontSize: 12,
          boxShadow: isHighlighted
            ? '0 0 14px rgba(255,170,68,0.45), 0 4px 16px rgba(0,0,0,0.4)'
            : '0 4px 16px rgba(0,0,0,0.4)',
          transition: 'border 0.15s, box-shadow 0.15s'
        }}
      >
        {/* 테이블 헤더 */}
        <div
          style={{
            background: '#0f3460',
            borderRadius: '8px 8px 0 0',
            padding: '8px 12px',
            fontWeight: 700,
            color: '#a0c4ff',
            fontSize: 13,
            borderBottom: '1px solid #1a4a80'
          }}
        >
          {message.name}
        </div>

        {/* 필드 목록 */}
        <div style={{ padding: '4px 0' }}>
          {message.fields.map((field) => {
            const isEnum = allEnums.some((e) => e.name === field.type)
            const isMessage = messageNames.has(field.type) && field.type !== message.name
            const isKnown = isEnum || isMessage || messageNames.has(field.type) || PRIMITIVE_TYPES.has(field.type)
            const isFieldHovered = hoveredFieldType === field.type && isMessage
            return (
              <div
                key={field.name}
                style={{
                  padding: '5px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  cursor: isEnum ? 'pointer' : 'default',
                  borderBottom: '1px solid #0f3460',
                  background: isFieldHovered ? 'rgba(255,170,68,0.1)' : 'transparent',
                  transition: 'background 0.15s'
                }}
                onDoubleClick={() => handleFieldDoubleClick(field.name, field.type)}
                title={isEnum ? '더블클릭으로 Enum 보기' : undefined}
                onMouseEnter={() => {
                  if (isMessage) {
                    setHoveredFieldType(field.type)
                    onMessageHover?.({ source: message.name, target: field.type })
                  }
                }}
                onMouseLeave={() => {
                  if (isMessage) {
                    setHoveredFieldType(null)
                    onMessageHover?.(null)
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {field.isPk && <span className="badge badge-pk">PK</span>}
                  <span style={{ color: '#e0e0e0' }}>{field.name}</span>
                </span>
                <span
                  className={`badge ${
                    isEnum ? 'badge-enum'
                    : isMessage ? 'badge-ref'
                    : !isKnown ? 'badge-invalid'
                    : 'badge-type'
                  }`}
                  title={!isKnown ? '존재하지 않는 타입입니다' : isMessage ? `→ ${field.type}` : undefined}
                >
                  {field.isRepeated ? `[]${field.type}` : field.type}
                </span>
              </div>
            )
          })}
        </div>
      </div>



      {enumModal && (
        <EnumModal
          protoEnum={enumModal.protoEnum}
          fieldName={enumModal.field}
          onClose={() => setEnumModal(null)}
        />
      )}
    </>
  )
}
