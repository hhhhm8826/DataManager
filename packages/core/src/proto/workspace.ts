import type {
  ProtoDiagnostic,
  ProtoDocument,
  ProtoSourceFile,
  ProtoWorkspace,
  ProtoWorkspaceDiagnostic,
  SourceSpan
} from './model'
import { parseProtoDocument } from './parser'

interface SymbolLocation {
  name: string
  sourceFile: string
  span: SourceSpan
}

export function parseProtoWorkspace(files: readonly ProtoSourceFile[]): ProtoWorkspace {
  const documents = [...files]
    .sort((left, right) => left.sourceFile.localeCompare(right.sourceFile, 'en'))
    .map((file) => parseProtoDocument(file.source, file.sourceFile))
  const messages = documents.flatMap((document) => document.messages)
  const enums = documents.flatMap((document) => document.enums)
  const diagnostics: ProtoWorkspaceDiagnostic[] = documents.flatMap((document) =>
    document.diagnostics.map((diagnostic) => ({ sourceFile: document.sourceFile, diagnostic }))
  )
  const symbols: SymbolLocation[] = [
    ...messages.map(({ name, sourceFile, span }) => ({ name, sourceFile, span })),
    ...enums.map(({ name, sourceFile, span }) => ({ name, sourceFile, span }))
  ]
  const symbolsByName = groupSymbols(symbols)
  const typeSources = new Map<string, string>()

  for (const [name, locations] of symbolsByName) {
    if (locations.length === 1) {
      typeSources.set(name, locations[0]!.sourceFile)
      continue
    }
    for (const location of locations) {
      diagnostics.push({
        sourceFile: location.sourceFile,
        diagnostic: error(
          'PROTO_SYMBOL_NAME_DUPLICATE',
          `Symbol '${name}' is declared more than once in the Proto workspace.`,
          location.span
        )
      })
    }
  }

  return { documents, messages, enums, diagnostics, typeSources }
}

export function replaceWorkspaceDocument(
  workspace: ProtoWorkspace,
  sourceFile: string,
  source: string
): ProtoWorkspace {
  const files = workspace.documents
    .filter((document) => document.sourceFile !== sourceFile)
    .map((document) => ({ sourceFile: document.sourceFile, source: document.source }))
  files.push({ sourceFile, source })
  return parseProtoWorkspace(files)
}

export function findWorkspaceDocument(
  workspace: ProtoWorkspace,
  sourceFile: string
): ProtoDocument | undefined {
  return workspace.documents.find((document) => document.sourceFile === sourceFile)
}

function groupSymbols(symbols: readonly SymbolLocation[]): Map<string, SymbolLocation[]> {
  const grouped = new Map<string, SymbolLocation[]>()
  for (const symbol of symbols) {
    const locations = grouped.get(symbol.name) ?? []
    locations.push(symbol)
    grouped.set(symbol.name, locations)
  }
  return grouped
}

function error(code: string, message: string, span: SourceSpan): ProtoDiagnostic {
  return { code, message, severity: 'error', span }
}
