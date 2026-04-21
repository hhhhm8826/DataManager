// IPC 채널 이름 상수

export const IPC = {
  // 설정
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SELECT_DIR: 'settings:select-dir',
  SETTINGS_SELECT_FILE: 'settings:select-file',
  SETTINGS_OPEN_DIR: 'settings:open-dir',

  // Proto
  PROTO_LOAD: 'proto:load',
  PROTO_ADD_MESSAGE: 'proto:add-message',
  PROTO_UPDATE_MESSAGE: 'proto:update-message',
  PROTO_DELETE_MESSAGE: 'proto:delete-message',
  PROTO_ADD_ENUM: 'proto:add-enum',
  PROTO_UPDATE_ENUM: 'proto:update-enum',
  PROTO_DELETE_ENUM: 'proto:delete-enum',

  // Excel
  EXCEL_GENERATE: 'excel:generate',
  EXCEL_LIST_EXISTING: 'excel:list-existing',
  EXCEL_READ: 'excel:read',
  EXCEL_EXPORT_JSON: 'excel:export-json',

  // JSON
  JSON_READ: 'json:read',
  JSON_WRITE: 'json:write',

  // 코드 생성
  CODEGEN_GENERATE: 'codegen:generate',
  CODEGEN_GENERATE_ALL: 'codegen:generate-all',
  CODEGEN_LIST_LANGUAGES: 'codegen:list-languages',
  CODEGEN_GENERATE_UNREAL: 'codegen:generate-unreal'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
