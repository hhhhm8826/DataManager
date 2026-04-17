import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import type { ProtoMessage, ProtoEnum } from '../../../../shared/types'
import { EnumModal } from '../EnumModal'

interface TableNodeData {
  message: ProtoMessage
  allEnums: ProtoEnum[]
  [key: string]: unknown
}

export function TableNode({ data }: NodeProps): React.JSX.Element {
  const { message, allEnums } = data as TableNodeData
  const [enumModal, setEnumModal] = useState<{ field: string; protoEnum: ProtoEnum } | null>(null)

  const handleFieldDoubleClick = (fieldName: string, fieldType: string): void => {
    const found = allEnums.find((e) => e.name === fieldType)
    if (found) {
      setEnumModal({ field: fieldName, protoEnum: found })
    }
  }

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: '#a0c4ff' }} />

      <div
        style={{
          background: '#16213e',
          border: '1px solid #0f3460',
          borderRadius: 8,
          minWidth: 220,
          fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
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
                  borderBottom: '1px solid #0f3460'
                }}
                onDoubleClick={() => handleFieldDoubleClick(field.name, field.type)}
                title={isEnum ? '더블클릭으로 Enum 보기' : undefined}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {field.isPk && <span className="badge badge-pk">PK</span>}
                  <span style={{ color: '#e0e0e0' }}>{field.name}</span>
                </span>
                <span className={`badge ${isEnum ? 'badge-enum' : 'badge-type'}`}>
                  {field.isRepeated ? `[]${field.type}` : field.type}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#a0c4ff' }} />

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
