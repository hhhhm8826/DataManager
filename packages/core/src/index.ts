export {
  AppSettingsSchema,
  CodegenOutputSchema,
  DiagramSettingsSchema,
  LegacyImportPreviewSchema,
  LegacyImportRecordSchema,
  LegacyPathCheckSchema,
  NativeErrorSchema,
  SETTINGS_VERSION,
  defaultAppSettings,
  parseAppSettings,
  parseLegacyImportPreview,
  toNativeError
} from './settings'

export type {
  AppSettings,
  CodegenOutput,
  LegacyImportPreview,
  LegacyPathCheck,
  NativeError
} from './settings'

export { lexProto, significantTokens } from './proto/lexer'
export { parseProtoDocument } from './proto/parser'
export {
  addEnum,
  addMessage,
  createProtoDocument,
  deleteDeclaration,
  findReferenceImpacts,
  isEnumFileName,
  isMessageFileName,
  updateEnum,
  updateMessage
} from './proto/patcher'
export { isValidProtoIdentifier, prepareEnumDraft, prepareMessageDraft } from './proto/validation'
export {
  findWorkspaceDocument,
  parseProtoWorkspace,
  replaceWorkspaceDocument
} from './proto/workspace'

export type {
  ProtoDiagnostic,
  ProtoDocument,
  ProtoEnumDeclaration,
  ProtoEnumDraft,
  ProtoEnumValueDeclaration,
  ProtoEnumValueDraft,
  ProtoEditResult,
  ProtoFieldDeclaration,
  ProtoFieldDraft,
  ProtoImport,
  ProtoMessageDeclaration,
  ProtoMessageDraft,
  ProtoReferenceImpact,
  ProtoSourceFile,
  ProtoWorkspace,
  ProtoWorkspaceDiagnostic,
  SourceSpan
} from './proto/model'

export { buildSchemaGraph, layoutSchemaGraph, schemaGraphNeighbors } from './schemaGraph'
export type {
  SchemaGraph,
  SchemaGraphEdge,
  SchemaGraphNode,
  SchemaGraphNodeKind,
  SchemaNodePosition,
  UnresolvedSchemaReference
} from './schemaGraph'

export {
  buildExcelWorkbookPlans,
  EXCEL_DROPDOWN_SHEET,
  EXCEL_MAX_DATA_ROWS,
  hasExcelErrors,
  validateExcelSheets
} from './excel'

export { collectJsonExportDependencies, exportResolvedJson } from './jsonExport'
export type {
  JsonExportDiagnostic,
  JsonExportFile,
  JsonExportResult,
  JsonObject,
  JsonScalar,
  JsonValue
} from './jsonExport'

export {
  CODEGEN_DEFINITIONS,
  CODEGEN_LANGUAGES,
  codegenDefinition,
  configuredCodegenSelections,
  normalizeCodegenLanguage
} from './codegen'

export { generateUnrealFiles } from './unreal'
export type {
  UnrealGeneratedFile,
  UnrealGenerationDiagnostic,
  UnrealGenerationResult
} from './unreal'
export type { CodegenLanguage, CodegenLanguageDefinition, CodegenSelection } from './codegen'
export type {
  ExcelColumnPlan,
  ExcelDiagnostic,
  ExcelDiagnosticSeverity,
  ExcelDomainRow,
  ExcelDomainValue,
  ExcelKeyMode,
  ExcelReadResult,
  ExcelReferencePlan,
  ExcelSheetPlan,
  ExcelValidationResult,
  ExcelWorkbookPlan,
  RawExcelSheet
} from './excel'
