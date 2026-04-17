// Proto 파일 파싱 결과 타입

export interface ProtoField {
  name: string
  type: string // 'string' | 'int32' | 'int64' | 'bool' | 'float' | 'double' | 'bytes' | MessageName
  fieldNumber: number
  isPk: boolean
  isRepeated: boolean
  comment?: string
}

export interface ProtoMessage {
  name: string
  fields: ProtoField[]
  pkFields: string[] // PK 필드 이름 목록 (합성키 지원)
  sourceFile: string
}

export interface ProtoEnumValue {
  name: string
  number: number
}

export interface ProtoEnum {
  name: string
  values: ProtoEnumValue[]
  sourceFile: string
}

export interface ParsedProto {
  messages: ProtoMessage[]
  enums: ProtoEnum[]
  errors: string[]
}

// 설정 타입

export interface AppSettings {
  protoDir: string
  excelDir: string
  jsonDir: string
  outputDirs: OutputDirConfig[]
}

export interface OutputDirConfig {
  language: string
  dir: string
}

// Excel 관련

export type ExcelRowData = Record<string, string | number | boolean | null>

export interface ExcelReadResult {
  messageName: string
  rows: ExcelRowData[]
}

// Excel 파일 목록 (proto 매핑 + 존재 여부)

export interface ExcelFileInfo {
  protoFile: string
  excelFile: string
  excelPath: string
  msgNames: string[]
  exists: boolean
}

// IPC 응답 래퍼

export interface IpcResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// 코드 생성 언어

export type CodeGenLanguage = 'cpp' | 'csharp'
