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

export {
  FIRST_PARTY_DIAGNOSTIC_PREFIXES,
  formatDiagnostic,
  formatDiagnosticMessage,
  isFirstPartyDiagnosticCode
} from './diagnostics'
export type { DiagnosticLike, DiagnosticParam, FormattedDiagnostic } from './diagnostics'

export { lexProto, significantTokens } from './proto/lexer'
export { parseProtoDocument } from './proto/parser'
export {
  addEnum,
  addMessage,
  buildProtoFileName,
  createProtoDocument,
  defaultProtoFileStem,
  deleteDeclaration,
  findReferenceImpacts,
  isEnumFileName,
  isMessageFileName,
  normalizeProtoFileStem,
  updateEnum,
  updateMessage
} from './proto/patcher'
export type { ProtoFileKind } from './proto/patcher'
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
  ProtoMemoDeclaration,
  ProtoMemoDraft,
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

export { projectSchemaDiagram } from './diagramProjection'
export type { DiagramProjection } from './diagramProjection'

export {
  deterministicDiagramGrid,
  diagramNodeSize,
  countOrthogonalRouteCrossings,
  DIAGRAM_FIELD_ROW_HEIGHT,
  DIAGRAM_NODE_FOOTER_HEIGHT,
  DIAGRAM_NODE_HEADER_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  normalizeDiagramPosition,
  normalizeDiagramViewport,
  overlappingNodePairs,
  routeNodeIntersections,
  sharedRouteSegments
} from './diagramGeometry'
export type {
  DiagramNodeBox,
  DiagramPoint,
  DiagramRoute,
  SharedRouteSegment
} from './diagramGeometry'

export {
  buildExcelWorkbookPlans,
  createExcelEmbeddedMetadata,
  EXCEL_DROPDOWN_SHEET,
  EXCEL_MAX_DATA_ROWS,
  EXCEL_METADATA_MAGIC,
  EXCEL_METADATA_SHEET,
  EXCEL_METADATA_VERSION,
  hasExcelErrors,
  parseExcelEmbeddedMetadata,
  validateExcelSheets
} from './excel'

export {
  applyWorkspaceMetadataSectionUpdate,
  createMemoColumnId,
  DEFAULT_HUB_THRESHOLD,
  defaultWorkspaceMetadata,
  DiagramPositionSchema,
  DiagramViewportSchema,
  MAX_WORKSPACE_METADATA_ENTRIES,
  MAX_MEMO_NAME_LENGTH,
  MemoColumnSchema,
  normalizeTableMetadataKey,
  parseWorkspaceMetadata,
  PrimaryKeyTypePolicySchema,
  SavedDiagramLayoutSchema,
  TableMetadataSchema,
  validateMemoColumnName,
  WORKSPACE_METADATA_VERSION,
  WorkspaceDiagramMetadataSchema,
  WorkspaceMetadataRevisionConflictError,
  WorkspaceMetadataSchema
} from './projectMetadata'
export type {
  MemoColumn,
  MemoColumnNameValidation,
  PrimaryKeyTypePolicy,
  SavedDiagramLayout,
  TableMetadata,
  WorkspaceDiagramMetadata,
  WorkspaceMetadata,
  WorkspaceMetadataSection,
  WorkspaceMetadataSectionUpdate,
  WorkspaceMetadataSectionValue
} from './projectMetadata'

export {
  collectJsonExportDependencies,
  exportResolvedJson,
  JSON_REFERENCE_EXPANSION_LIMIT
} from './jsonExport'
export type {
  JsonExportDiagnostic,
  JsonExportFile,
  JsonExportResult,
  JsonObject,
  JsonScalar,
  JsonValue
} from './jsonExport'

export { validatePrimaryKeyDraftPolicy, validatePrimaryKeyTypePolicy } from './primaryKeyPolicy'
export type { PrimaryKeyPolicyViolation } from './primaryKeyPolicy'

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
  ExcelEmbeddedMetadata,
  ExcelEmbeddedMetadataParseResult,
  ExcelEmbeddedTableMetadata,
  ExcelKeyMode,
  ExcelMemoColumnPlan,
  ExcelReadResult,
  ExcelReferencePlan,
  ExcelSheetPlan,
  ExcelValidationResult,
  ExcelWorkbookPlan,
  RawExcelSheet
} from './excel'
