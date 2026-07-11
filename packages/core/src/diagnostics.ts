export type DiagnosticParam = string | number | boolean | null

export interface DiagnosticLike {
  code: string
  message?: string
  params?: Readonly<Record<string, DiagnosticParam>>
  context?: Readonly<Record<string, unknown>>
}

export interface FormattedDiagnostic {
  code: string
  title: string
  message: string
  technicalDetails: string
}

interface CatalogEntry {
  title: string
  message: string
}

export const FIRST_PARTY_DIAGNOSTIC_PREFIXES = [
  'BACKUP_',
  'CODEGEN_',
  'CURRENT_',
  'E2E_',
  'EXCEL_',
  'FILE_',
  'JSON_',
  'LEGACY_',
  'NATIVE_',
  'PATH_',
  'PROTO_',
  'PROTO3_',
  'PROTOC_',
  'SETTINGS_',
  'UNREAL_',
  'WORKSPACE_'
] as const

const catalog: Readonly<Record<string, CatalogEntry>> = {
  EXCEL_CELL_TYPE_MISMATCH: {
    title: 'Excel 값 형식이 맞지 않습니다',
    message: '해당 셀의 값을 스키마에 지정된 타입에 맞게 수정하세요.'
  },
  EXCEL_HEADER_DUPLICATE: {
    title: 'Excel 칼럼 이름이 중복되었습니다',
    message: '같은 이름의 헤더를 하나만 남긴 뒤 다시 시도하세요.'
  },
  EXCEL_HEADER_MISSING: {
    title: '필수 Excel 칼럼이 없습니다',
    message: '스키마에 정의된 데이터 칼럼을 Excel 헤더에 추가하세요.'
  },
  EXCEL_HEADER_UNKNOWN: {
    title: '등록되지 않은 Excel 칼럼이 있습니다',
    message: '스키마 또는 Excel 메모 칼럼에 등록되지 않은 헤더를 정리하세요.'
  },
  EXCEL_MEMO_HEADER_MISSING: {
    title: 'Excel 메모 칼럼이 아직 반영되지 않았습니다',
    message: '데이터 생성은 계속할 수 있습니다. 필요하면 workbook을 백업한 뒤 다시 생성하세요.'
  },
  EXCEL_MEMO_METADATA_CORRUPT: {
    title: 'Excel 메모 정보가 손상되었습니다',
    message:
      '메모 값을 안전하게 구분할 수 없어 작업을 중단했습니다. workbook 원본을 보존하고 백업 후 다시 생성하세요.'
  },
  EXCEL_MEMO_METADATA_UNSUPPORTED: {
    title: 'Excel 메모 정보 버전을 지원하지 않습니다',
    message:
      '현재 앱에서 해석할 수 없어 작업을 중단했습니다. 앱 버전을 확인하고 workbook 원본을 보존하세요.'
  },
  EXCEL_MEMO_SCHEMA_STALE: {
    title: 'Excel workbook에 메모 변경 적용이 필요합니다',
    message:
      '이전 메모 값은 JSON에서 제외했습니다. workbook을 백업한 뒤 다시 생성해 현재 메모 구성을 반영하세요.'
  },
  EXCEL_REQUIRED_KEY_EMPTY: {
    title: '키 값이 비어 있습니다',
    message: '기본키 또는 합성키로 지정한 칼럼의 값을 입력하세요.'
  },
  EXCEL_SHEET_MISSING: {
    title: '필수 Excel 시트가 없습니다',
    message: '스키마에 대응하는 시트를 추가하거나 Excel 파일을 다시 생성하세요.'
  },
  EXCEL_SHEET_UNKNOWN: {
    title: '등록되지 않은 Excel 시트가 있습니다',
    message: '스키마에 없는 시트 이름을 확인하세요.'
  },
  JSON_DEPENDENCY_DATA_MISSING: {
    title: '참조 대상 Excel 데이터가 없습니다',
    message: '참조하는 테이블의 Excel 데이터를 함께 선택하세요.'
  },
  JSON_MESSAGE_NOT_FOUND: {
    title: 'JSON 대상 테이블을 찾을 수 없습니다',
    message: '선택한 테이블이 현재 Proto 스키마에 있는지 확인하세요.'
  },
  JSON_PRIMARY_KEY_DUPLICATE: {
    title: '기본키가 중복되었습니다',
    message: '한 행을 구분하는 기본키 값 또는 여러 기본키 값의 조합을 고유하게 수정하세요.'
  },
  JSON_REFERENCE_CYCLE: {
    title: '테이블 참조가 순환합니다',
    message: '서로를 반복해서 참조하는 테이블 관계를 정리한 뒤 다시 생성하세요.'
  },
  JSON_REFERENCE_EXPANSION_LIMIT: {
    title: 'JSON 참조 확장 한도를 초과했습니다',
    message:
      'JSON 하나에 포함되는 행 객체는 최대 100,000개입니다. 참조 깊이나 출력 대상을 줄인 뒤 다시 생성하세요.'
  },
  JSON_REFERENCE_ROW_CYCLE: {
    title: 'Excel 행의 자기 참조가 순환합니다',
    message:
      '표시된 테이블의 행과 키 경로가 자기 자신으로 돌아옵니다. 부모 참조 값을 수정한 뒤 다시 생성하세요.'
  },
  JSON_REFERENCE_DEPENDENCY_UNRESOLVED: {
    title: '참조 데이터를 먼저 처리할 수 없습니다',
    message: '참조 대상 테이블의 Excel 데이터와 키 설정을 확인하세요.'
  },
  JSON_REFERENCE_TARGET_DUPLICATE: {
    title: '참조 키에 해당하는 행이 여러 개입니다',
    message: '참조 대상의 기본키를 고유하게 수정하거나 의도한 합성키 규칙을 사용하세요.'
  },
  JSON_REFERENCE_TARGET_HAS_NO_KEY: {
    title: '참조 대상에 키가 없습니다',
    message: '참조 대상 테이블에 기본키 또는 합성키를 지정하세요.'
  },
  JSON_REFERENCE_TARGET_MISSING: {
    title: '참조 값에 해당하는 행이 없습니다',
    message: 'Excel에 입력한 참조 값과 대상 테이블의 키 값을 확인하세요.'
  },
  JSON_REQUIRED_KEY_EMPTY: {
    title: 'JSON 생성에 필요한 키가 비어 있습니다',
    message: '기본키 또는 합성키로 지정한 모든 칼럼에 값을 입력하세요.'
  },
  NATIVE_UNKNOWN: {
    title: '작업을 완료하지 못했습니다',
    message: '예상하지 못한 오류가 발생했습니다. 기술 상세를 확인하세요.'
  },
  NATIVE_OPERATION_ABORTED: {
    title: '작업이 취소되었습니다',
    message: '생성 중인 결과는 저장하지 않았습니다. 필요하면 다시 실행하세요.'
  },
  NATIVE_OPERATION_TIMED_OUT: {
    title: '작업 시간을 초과했습니다',
    message: '지정된 시간 안에 완료되지 않았습니다. 입력과 실행 환경을 확인한 뒤 다시 시도하세요.'
  },
  NATIVE_VALIDATION_FAILED: {
    title: '입력 값을 확인할 수 없습니다',
    message: '필수 값과 형식이 맞지 않습니다. 표시된 항목을 수정한 뒤 다시 시도하세요.'
  },
  PROTO_DOCUMENT_READ_ONLY: {
    title: '읽기 전용 Proto 파일입니다',
    message: '지원하지 않는 Proto 문법을 정리한 뒤 다시 편집하세요.'
  },
  PROTO_FIELD_KEY_MODE_CONFLICT: {
    title: '기본키와 합성키를 함께 사용할 수 없습니다',
    message: '한 테이블에서는 기본키 또는 합성키 중 한 가지 방식만 사용하세요.'
  },
  PROTO_MESSAGE_KEY_MODE_CONFLICT: {
    title: '기본키와 합성키를 함께 사용할 수 없습니다',
    message: '한 테이블에서는 기본키 또는 합성키 중 한 가지 방식만 사용하세요.'
  },
  PROTO_PRIMARY_KEY_TYPE_POLICY_VIOLATION: {
    title: '기본키 타입이 프로젝트 정책에 맞지 않습니다',
    message: '표시된 기본키 필드의 타입을 바꾸거나 프로젝트의 기본키 타입 정책을 완화하세요.'
  },
  PROTO_FILE_NAME_INVALID: {
    title: 'Proto 파일명이 올바르지 않습니다',
    message: '선언 종류에 맞는 파일 이름을 입력하세요.'
  },
  PROTO_FILE_NAME_CASE_CONFLICT: {
    title: '대소문자만 다른 Proto 파일이 이미 있습니다',
    message: '기존 파일을 선택하거나 대소문자 외에도 구분되는 새 파일명을 입력하세요.'
  },
  PROTO_SYMBOL_NAME_DUPLICATE: {
    title: '이미 사용 중인 선언 이름입니다',
    message: '다른 Message 또는 Enum 이름을 입력하세요.'
  },
  UNREAL_ENUM_VALUE_OUT_OF_RANGE: {
    title: 'Unreal Enum 값 범위를 벗어났습니다',
    message: 'Blueprint Enum 값은 0부터 255 사이로 수정하세요.'
  },
  UNREAL_MESSAGE_CYCLE_POINTER: {
    title: '순환 참조 필드를 포인터로 생성합니다',
    message: '순환 관계를 유지하기 위해 해당 필드를 공유 포인터로 생성합니다.'
  },
  UNREAL_OUTPUT_EMPTY: {
    title: '생성된 Unreal 파일이 없습니다',
    message: '선택한 스키마와 출력 설정을 확인하세요.'
  },
  UNREAL_UNRESOLVED_FIELD_TYPE: {
    title: 'Unreal에서 필드 타입을 확인할 수 없습니다',
    message: '필드 타입이 현재 workspace의 기본 타입, Message 또는 Enum인지 확인하세요.'
  },
  WORKSPACE_METADATA_REVISION_CONFLICT: {
    title: '프로젝트 설정이 다른 작업에서 변경되었습니다',
    message: '최신 설정을 다시 불러온 뒤 변경 내용을 적용하세요.'
  },
  WORKSPACE_METADATA_MEMO_INVALID: {
    title: 'Excel 메모 칼럼 이름이 올바르지 않습니다',
    message: '1~128자의 이름을 사용하고 데이터 칼럼 또는 다른 메모와 겹치지 않게 입력하세요.'
  }
}

const familyCatalog: Readonly<Record<string, CatalogEntry>> = {
  BACKUP_: {
    title: '백업을 만들 수 없습니다',
    message: '원본 파일과 백업 경로를 확인한 뒤 다시 시도하세요.'
  },
  CODEGEN_: {
    title: '코드 생성 설정을 처리할 수 없습니다',
    message: '출력 언어와 폴더 설정을 확인한 뒤 다시 시도하세요.'
  },
  CURRENT_: {
    title: '현재 실행 경로를 확인할 수 없습니다',
    message: '앱을 다시 실행한 뒤 같은 작업을 시도하세요.'
  },
  E2E_: {
    title: '테스트 환경 설정이 올바르지 않습니다',
    message: '테스트 경로와 실행 환경을 확인하세요.'
  },
  EXCEL_: {
    title: 'Excel 데이터를 처리할 수 없습니다',
    message: 'Excel 파일, 시트와 칼럼 구성을 확인하세요.'
  },
  FILE_: {
    title: '파일 작업을 완료할 수 없습니다',
    message: '파일 경로와 읽기 또는 쓰기 권한을 확인하세요.'
  },
  JSON_: {
    title: 'JSON을 생성할 수 없습니다',
    message: 'Excel 데이터와 테이블 참조 관계를 확인하세요.'
  },
  LEGACY_: {
    title: '이전 설정을 가져올 수 없습니다',
    message: '이전 설정 파일의 위치와 내용을 확인하세요.'
  },
  NATIVE_: {
    title: '시스템 작업을 완료할 수 없습니다',
    message: '경로와 권한을 확인한 뒤 다시 시도하세요.'
  },
  PATH_: {
    title: '경로를 사용할 수 없습니다',
    message: '절대 경로인지, 대상이 존재하는지, 접근 권한이 있는지 확인하세요.'
  },
  PROTO_: {
    title: 'Proto 스키마를 처리할 수 없습니다',
    message: '표시된 선언과 필드 설정을 확인하세요.'
  },
  PROTO3_: {
    title: 'Proto 문법 버전이 올바르지 않습니다',
    message: '파일의 syntax 선언을 proto3로 설정하세요.'
  },
  PROTOC_: {
    title: 'protoc 실행을 완료할 수 없습니다',
    message: 'protoc 실행 파일, 플러그인과 출력 설정을 확인하세요.'
  },
  SETTINGS_: {
    title: '앱 설정을 처리할 수 없습니다',
    message: '설정 값과 저장 경로를 확인한 뒤 다시 시도하세요.'
  },
  UNREAL_: {
    title: 'Unreal 코드를 생성할 수 없습니다',
    message: '스키마 타입과 Unreal 출력 설정을 확인하세요.'
  },
  WORKSPACE_: {
    title: '프로젝트 데이터를 처리할 수 없습니다',
    message: 'Proto 루트와 프로젝트 메타데이터를 확인하세요.'
  }
}

export function isFirstPartyDiagnosticCode(code: string): boolean {
  return FIRST_PARTY_DIAGNOSTIC_PREFIXES.some((prefix) => code.startsWith(prefix))
}

export function formatDiagnostic(input: DiagnosticLike): FormattedDiagnostic {
  const entry = catalog[input.code] ??
    Object.entries(familyCatalog).find(([prefix]) => input.code.startsWith(prefix))?.[1] ?? {
      title: '오류를 처리하지 못했습니다',
      message: '예상하지 못한 오류가 발생했습니다. 기술 상세를 확인하세요.'
    }
  return {
    code: input.code,
    title: entry.title,
    message: `${entry.message}${identifierContext(input)}`,
    technicalDetails: technicalDetails(input)
  }
}

function identifierContext(input: DiagnosticLike): string {
  const values = [...Object.entries(input.params ?? {}), ...Object.entries(input.context ?? {})]
    .filter(
      ([key, value]) =>
        /(?:path|file|source|field|table|message|declaration|language|directory|root)/i.test(key) &&
        (typeof value === 'string' || typeof value === 'number')
    )
    .map(([, value]) => String(value))
  const unique = [...new Set(values)]
  return unique.length > 0 ? ` 대상: ${unique.join(', ')}` : ''
}

export function formatDiagnosticMessage(input: DiagnosticLike): string {
  const formatted = formatDiagnostic(input)
  return `${formatted.title}: ${formatted.message}`
}

function technicalDetails(input: DiagnosticLike): string {
  const details = [`code=${input.code}`]
  if (input.message) details.push(input.message)
  if (input.params && Object.keys(input.params).length > 0) {
    details.push(`params=${JSON.stringify(input.params)}`)
  }
  if (input.context && Object.keys(input.context).length > 0) {
    details.push(`context=${JSON.stringify(input.context)}`)
  }
  return details.join('\n')
}
