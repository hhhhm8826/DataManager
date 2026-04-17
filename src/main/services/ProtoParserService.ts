import * as fs from 'fs'
import * as path from 'path'
import type { ParsedProto, ProtoMessage, ProtoField, ProtoEnum, ProtoEnumValue } from '../../shared/types'

const PRIMITIVE_TYPES = new Set([
  'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
  'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
  'bool', 'string', 'bytes'
])

/**
 * .proto 파일을 직접 텍스트 파싱하여 Message/Enum 정보를 추출합니다.
 * protobufjs 의 reflection API 대신 텍스트 파싱을 사용해
 * @PK 주석 등 메타데이터를 보존합니다.
 */
export class ProtoParserService {
  /**
   * 지정 디렉토리의 모든 .proto 파일을 읽어 파싱 결과를 반환합니다.
   */
  parseDirectory(dirPath: string): ParsedProto {
    const result: ParsedProto = { messages: [], enums: [], errors: [] }

    if (!fs.existsSync(dirPath)) {
      result.errors.push(`디렉토리를 찾을 수 없습니다: ${dirPath}`)
      return result
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.proto'))

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const content = fs.readFileSync(filePath, 'utf-8')

      if (file.endsWith('EnumType.proto')) {
        const { enums, errors } = this.parseEnums(content, file)
        result.enums.push(...enums)
        result.errors.push(...errors)
      } else if (file.endsWith('Table.proto')) {
        // {Name}Table.proto 형식의 파일은 모두 Message(테이블)로 파싱
        const messages = this.parseMessages(content, file)
        result.messages.push(...messages)
      }
    }

    return result
  }

  // ── Message 파싱 ──────────────────────────────────────────────

  parseMessages(content: string, sourceFile: string): ProtoMessage[] {
    const messages: ProtoMessage[] = []
    // message 블록 추출 (중첩 없음 가정)
    const messageRegex = /message\s+(\w+)\s*\{([^}]*)\}/gs

    let match: RegExpExecArray | null
    while ((match = messageRegex.exec(content)) !== null) {
      const name = match[1]
      const body = match[2]
      const fields = this.parseFields(body)
      const pkFields = fields.filter((f) => f.isPk).map((f) => f.name)
      messages.push({ name, fields, pkFields, sourceFile })
    }

    return messages
  }

  private parseFields(body: string): ProtoField[] {
    const fields: ProtoField[] = []
    const lines = body.split('\n')
    let pendingPk = false

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (line.startsWith('//')) {
        if (line.includes('@PK')) {
          pendingPk = true
        }
        continue
      }

      // 필드 파싱: [repeated] type name = number;
      const fieldMatch = line.match(/^(repeated\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)\s*;/)
      if (fieldMatch) {
        const isRepeated = !!fieldMatch[1]
        const type = fieldMatch[2]
        const name = fieldMatch[3]
        const fieldNumber = parseInt(fieldMatch[4], 10)

        fields.push({
          name,
          type,
          fieldNumber,
          isPk: pendingPk,
          isRepeated
        })
        pendingPk = false
      }
    }

    return fields
  }

  // ── Enum 파싱 ──────────────────────────────────────────────

  parseEnums(content: string, sourceFile: string): { enums: ProtoEnum[]; errors: string[] } {
    const enums: ProtoEnum[] = []
    const errors: string[] = []
    const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/gs

    let match: RegExpExecArray | null
    while ((match = enumRegex.exec(content)) !== null) {
      const name = match[1]
      const body = match[2]
      const values = this.parseEnumValues(body)

      // 검증: _NONE = 0 이 있어야 함
      const hasNone = values.some((v) => v.name.endsWith('_NONE') && v.number === 0)
      // 검증: _MAX 가 있어야 함
      const hasMax = values.some((v) => v.name.endsWith('_MAX'))

      if (!hasNone) {
        errors.push(`[${sourceFile}] Enum '${name}': _NONE = 0 값이 없습니다.`)
      }
      if (!hasMax) {
        errors.push(`[${sourceFile}] Enum '${name}': _MAX 값이 없습니다.`)
      }

      enums.push({ name, values, sourceFile })
    }

    return { enums, errors }
  }

  private parseEnumValues(body: string): ProtoEnumValue[] {
    const values: ProtoEnumValue[] = []
    const lines = body.split('\n')

    for (const rawLine of lines) {
      const line = rawLine.trim()
      const match = line.match(/^(\w+)\s*=\s*(-?\d+)\s*;/)
      if (match) {
        values.push({ name: match[1], number: parseInt(match[2], 10) })
      }
    }

    return values
  }

  // ── 내부 헬퍼: 중괄호 카운팅으로 블록 제거 ─────────────────

  private removeBlock(content: string, keyword: string, name: string): string {
    const lines = content.split(/\r?\n/)

    // 시작 라인 탐색: keyword name ... { 형태
    let startIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/)
      if (parts[0] === keyword && parts[1] === name) {
        startIdx = i
        break
      }
    }
    if (startIdx === -1) return content

    // 중괄호 카운팅으로 블록 끝 탐색
    let depth = 0
    let endIdx = -1
    for (let i = startIdx; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) { endIdx = i; break }
        }
      }
      if (endIdx !== -1) break
    }
    if (endIdx === -1) return content

    // 바로 앞 빈 줄도 함께 제거
    let removeStart = startIdx
    if (removeStart > 0 && lines[removeStart - 1].trim() === '') removeStart--

    return [...lines.slice(0, removeStart), ...lines.slice(endIdx + 1)].join('\n')
  }

  // ── Message 삭제 ──────────────────────────────────────────────

  deleteMessage(filePath: string, messageName: string): void {
    if (!fs.existsSync(filePath)) return
    let content = fs.readFileSync(filePath, 'utf-8')
    content = this.removeBlock(content, 'message', messageName)
    fs.writeFileSync(filePath, content.trimEnd() + '\n', 'utf-8')
  }

  // ── Message 수정 (삭제 후 재추가) ─────────────────────────

  updateMessage(filePath: string, oldName: string, message: ProtoMessage, allEnums: ProtoEnum[] = []): void {
    this.deleteMessage(filePath, oldName)
    this.addMessageToFile(filePath, message, allEnums)
  }

  // ── proto 파일에 Message 추가 ──────────────────────────────

  addMessageToFile(filePath: string, message: ProtoMessage, allEnums: ProtoEnum[] = []): void {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : this.createProtoHeader('DataTable.proto')

    // 사용된 Enum 타입의 sourceFile 수집 → 아직 import되지 않은 것만 추가
    const usedEnumFiles = new Set<string>()
    for (const field of message.fields) {
      const enumDef = allEnums.find((e) => e.name === field.type)
      if (enumDef?.sourceFile) usedEnumFiles.add(enumDef.sourceFile)
    }
    for (const enumFile of usedEnumFiles) {
      const importLine = `import "${enumFile}";`
      if (!content.includes(importLine)) {
        // package/option 라인 다음에 삽입
        content = content.replace(
          /(option go_package[^;]+;)/,
          `$1\n${importLine}`
        )
      }
    }

    const fieldLines = message.fields
      .map((f) => {
        const pkComment = f.isPk ? '  // @PK\n' : ''
        const repeated = f.isRepeated ? 'repeated ' : ''
        return `${pkComment}  ${repeated}${f.type} ${f.name} = ${f.fieldNumber};`
      })
      .join('\n')

    const messageBlock = `\nmessage ${message.name} {\n${fieldLines}\n}\n`
    content = content.trimEnd() + '\n' + messageBlock
    fs.writeFileSync(filePath, content, 'utf-8')
  }

  // ── Enum 삭제 ────────────────────────────────────────────

  deleteEnum(filePath: string, enumName: string): void {
    if (!fs.existsSync(filePath)) return
    let content = fs.readFileSync(filePath, 'utf-8')
    content = this.removeBlock(content, 'enum', enumName)
    fs.writeFileSync(filePath, content.trimEnd() + '\n', 'utf-8')
  }

  // ── Enum 수정 (삭제 후 재추가) ───────────────────────────

  updateEnum(filePath: string, oldName: string, protoEnum: ProtoEnum): { errors: string[] } {
    this.deleteEnum(filePath, oldName)
    return this.addEnumToFile(filePath, protoEnum)
  }

  // ── proto 파일에 Enum 추가 ──────────────────────────────────

  addEnumToFile(filePath: string, protoEnum: ProtoEnum): { errors: string[] } {
    const errors: string[] = []

    // 검증
    const hasNone = protoEnum.values.some((v) => v.name.endsWith('_NONE') && v.number === 0)
    const hasMax = protoEnum.values.some((v) => v.name.endsWith('_MAX'))
    if (!hasNone) errors.push(`Enum '${protoEnum.name}': _NONE = 0 값이 없습니다.`)
    if (!hasMax) errors.push(`Enum '${protoEnum.name}': _MAX 값이 없습니다.`)
    if (errors.length > 0) return { errors }

    let content = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf-8')
      : this.createProtoHeader(path.basename(filePath))

    const valueLines = protoEnum.values.map((v) => `  ${v.name} = ${v.number};`).join('\n')
    const enumBlock = `\nenum ${protoEnum.name} {\n${valueLines}\n}\n`
    content = content.trimEnd() + '\n' + enumBlock
    fs.writeFileSync(filePath, content, 'utf-8')

    return { errors: [] }
  }

  isPrimitiveType(type: string): boolean {
    return PRIMITIVE_TYPES.has(type)
  }

  private createProtoHeader(_filename: string): string {
    return `syntax = "proto3";\n\npackage DATA_MANAGER_TABLE;\noption go_package = "./DATA_MANAGER_TABLE";\n`
  }
}

export const protoParserService = new ProtoParserService()
