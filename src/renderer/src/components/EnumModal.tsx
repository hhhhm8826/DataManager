import type { ProtoEnum } from '../../../shared/types'

interface Props {
  protoEnum: ProtoEnum
  fieldName: string
  onClose: () => void
}

export function EnumModal({ protoEnum, fieldName, onClose }: Props): React.JSX.Element {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            <span className="badge badge-enum" style={{ marginRight: 8 }}>
              ENUM
            </span>
            {fieldName} — {protoEnum.name}
          </span>
          <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th style={{ width: 80 }}>값</th>
            </tr>
          </thead>
          <tbody>
            {protoEnum.values.map((v) => (
              <tr key={v.name}>
                <td>{v.name}</td>
                <td style={{ color: '#7ab3f0', fontFamily: 'monospace' }}>{v.number}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 11, color: '#4b5563', marginTop: 10 }}>
          출처: {protoEnum.sourceFile}
        </p>
      </div>
    </div>
  )
}
