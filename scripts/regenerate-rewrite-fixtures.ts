import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import ExcelJS from 'exceljs'
import { format as formatWithPrettier, resolveConfig as resolvePrettierConfig } from 'prettier'
import {
  buildExcelWorkbookPlans,
  exportResolvedJson,
  generateUnrealFiles,
  parseProtoWorkspace,
  type UnrealGenerationDiagnostic
} from '@datamanager/core'
import { generateExcelWorkbook } from '../apps/desktop/src/adapters/excel/excelWorkbook'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceFixtureRoot = resolve(repositoryRoot, 'tests', 'fixtures', 'm0-legacy', 'proto')
const examplesRoot = resolve(repositoryRoot, 'examples')
const outputRoot = resolve(examplesRoot, 'TAURI_REWRITE')
const fixtureRoot = resolve(repositoryRoot, 'tests', 'fixtures', 'm8-rewrite')
const manifestPath = resolve(fixtureRoot, 'manifest.json')
const protocPath = resolve(repositoryRoot, 'examples', 'PROTOC', 'protoc.exe')
const goPluginPath = resolve(repositoryRoot, 'examples', 'PROTOC', 'protoc-gen-go.exe')
const protocLanguages = ['cpp', 'csharp', 'java', 'python', 'go', 'rust', 'ruby', 'php'] as const

type ExcelValidationModel = {
  model: Record<string, { type?: string; formulae?: unknown[] }>
}

type ExcelSheetValidation = {
  dataValidations: ExcelValidationModel
}

type ExcelBinaryLoader = {
  load(binary: ArrayBuffer): Promise<ExcelJS.Workbook>
}

interface GenerationEvidence {
  unrealDiagnostics: UnrealGenerationDiagnostic[]
}

async function main(): Promise<void> {
  const mode = process.argv[2]
  if (mode !== '--write' && mode !== '--check') {
    throw new Error('Usage: tsx scripts/regenerate-rewrite-fixtures.ts --write|--check')
  }

  if (mode === '--write') {
    resetExamplesOutput()
    const evidence = await generateExamples(outputRoot)
    const manifest = await buildManifest(outputRoot, evidence.unrealDiagnostics)
    mkdirSync(fixtureRoot, { recursive: true })
    await writeJson(manifestPath, manifest)
    const textFiles = manifest.textFiles as Record<string, unknown>
    console.log(`Regenerated ${Object.keys(textFiles).length} text files and 2 workbooks.`)
    return
  }

  if (!existsSync(manifestPath) || !existsSync(outputRoot)) {
    throw new Error('Rewrite fixtures are missing. Run pnpm fixtures:rewrite first.')
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'datamanager-m8-fixture-'))
  try {
    const generatedEvidence = await generateExamples(temporaryRoot)
    const generated = await buildManifest(temporaryRoot, generatedEvidence.unrealDiagnostics)
    const expected = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
    const committed = await buildManifest(outputRoot, generatedEvidence.unrealDiagnostics)
    if (!isDeepStrictEqual(generated, expected)) {
      throw new Error('Regenerated M8 fixture manifest differs. Run pnpm fixtures:rewrite.')
    }
    if (!isDeepStrictEqual(committed, expected)) {
      throw new Error('Committed M8 examples differ from manifest. Run pnpm fixtures:rewrite.')
    }
    console.log('M8 rewrite fixture regeneration is reproducible.')
  } finally {
    removeTemporaryRoot(temporaryRoot)
  }
}

async function generateExamples(root: string): Promise<GenerationEvidence> {
  const protoOutput = resolve(root, 'PROTO')
  const excelOutput = resolve(root, 'EXCEL')
  const jsonOutput = resolve(root, 'JSON')
  const codeOutput = resolve(root, 'CODE')
  for (const directory of [protoOutput, excelOutput, jsonOutput, codeOutput]) {
    mkdirSync(directory, { recursive: true })
  }

  const sourceFiles = readdirSync(sourceFixtureRoot)
    .filter((fileName) => fileName.endsWith('.proto'))
    .sort((left, right) => left.localeCompare(right, 'en'))
  for (const fileName of sourceFiles) {
    copyFileSync(resolve(sourceFixtureRoot, fileName), resolve(protoOutput, fileName))
  }
  const workspace = parseProtoWorkspace(
    sourceFiles.map((sourceFile) => ({
      sourceFile,
      source: readFileSync(resolve(sourceFixtureRoot, sourceFile), 'utf8')
    }))
  )
  if (workspace.diagnostics.length > 0) {
    throw new Error(`Source fixture has ${workspace.diagnostics.length} Proto diagnostics.`)
  }

  const plans = buildExcelWorkbookPlans(workspace)
  for (const plan of plans) {
    writeFileSync(resolve(excelOutput, plan.fileName), await generateExcelWorkbook(plan))
  }

  const emptyResults = workspace.messages.map((message) => ({
    sourceFile: message.sourceFile,
    messageName: message.name,
    rows: []
  }))
  const json = exportResolvedJson(workspace, emptyResults, ['RootTarget'])
  if (json.diagnostics.length > 0) {
    throw new Error(`JSON fixture generation failed: ${json.diagnostics[0]!.message}`)
  }
  for (const file of json.files) {
    writeFileSync(resolve(jsonOutput, file.fileName), file.contents, 'utf8')
  }

  generateProtocOutputs(sourceFiles, codeOutput)
  const unreal = generateUnrealFiles(workspace)
  const unrealOutput = resolve(codeOutput, 'unreal')
  mkdirSync(unrealOutput, { recursive: true })
  for (const file of unreal.files) {
    writeFileSync(resolve(unrealOutput, file.fileName), file.contents, 'utf8')
  }

  writeFileSync(resolve(root, 'README.md'), generatedReadme(), 'utf8')
  return { unrealDiagnostics: unreal.diagnostics }
}

function generateProtocOutputs(sourceFiles: readonly string[], codeOutput: string): void {
  for (const language of protocLanguages) {
    const languageOutput = resolve(codeOutput, language)
    mkdirSync(languageOutput, { recursive: true })
    const arguments_ = [`--proto_path=${sourceFixtureRoot}`]
    if (language === 'go') {
      arguments_.push(`--plugin=protoc-gen-go=${goPluginPath}`)
    }
    if (language === 'rust') {
      arguments_.push('--rust_opt=experimental-codegen=enabled,kernel=upb')
    }
    arguments_.push(`--${language}_out=${languageOutput}`, ...sourceFiles)
    const result = spawnSync(protocPath, arguments_, {
      cwd: sourceFixtureRoot,
      encoding: 'utf8',
      shell: false
    })
    if (result.error || result.status !== 0) {
      throw new Error(
        `${language} protoc generation failed: ${result.error?.message ?? result.stderr.trim()}`
      )
    }
  }
}

async function buildManifest(
  root: string,
  unrealDiagnostics: readonly UnrealGenerationDiagnostic[]
): Promise<Record<string, unknown>> {
  const textFiles: Record<string, { bytes: number; sha256: string }> = {}
  const excelFiles: Record<string, unknown> = {}
  for (const path of walkFiles(root)) {
    const relativePath = portablePath(relative(root, path))
    if (extname(path).toLocaleLowerCase() === '.xlsx') {
      excelFiles[relativePath] = await describeWorkbook(path)
      continue
    }
    const bytes = readFileSync(path)
    textFiles[relativePath] = {
      bytes: bytes.length,
      sha256: sha256(bytes)
    }
  }
  return {
    formatVersion: 1,
    sourceFixture: 'tests/fixtures/m0-legacy/proto',
    generatedExamples: 'examples/TAURI_REWRITE',
    tools: {
      protoc: runVersion(protocPath),
      protocSha256: sha256(readFileSync(protocPath)),
      goPluginSha256: sha256(readFileSync(goPluginPath)),
      rust: 'bundled experimental upb codegen'
    },
    protocLanguages,
    unrealDiagnostics: unrealDiagnostics.map(({ code, sourceFile, declarationName }) => ({
      code,
      sourceFile,
      declarationName
    })),
    textFiles,
    excelFiles
  }
}

async function describeWorkbook(path: string): Promise<Record<string, unknown>> {
  const workbook = new ExcelJS.Workbook()
  const bytes = readFileSync(path)
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  await (workbook.xlsx as unknown as ExcelBinaryLoader).load(arrayBuffer)
  return {
    creator: workbook.creator,
    created: workbook.created?.toISOString() ?? null,
    sheets: workbook.worksheets.map((sheet) => {
      const header = sheet.getRow(1)
      const validations = (sheet as unknown as ExcelSheetValidation).dataValidations.model
      const validationEntries = Object.entries(validations)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([range, rule]) => [range, { type: rule.type, formulae: rule.formulae }] as const)
      const sampleIndexes = [
        0,
        Math.floor(validationEntries.length / 2),
        validationEntries.length - 1
      ]
      return {
        name: sheet.name,
        state: sheet.state,
        headers: Array.from({ length: header.cellCount }, (_, index) =>
          String(header.getCell(index + 1).value ?? '')
        ),
        validations: {
          count: validationEntries.length,
          sha256: sha256(Buffer.from(JSON.stringify(validationEntries), 'utf8')),
          samples: sampleIndexes
            .filter(
              (index, position) =>
                index >= 0 &&
                index < validationEntries.length &&
                sampleIndexes.indexOf(index) === position
            )
            .map((index) => validationEntries[index])
        }
      }
    })
  }
}

function resetExamplesOutput(): void {
  if (dirname(outputRoot) !== examplesRoot || basename(outputRoot) !== 'TAURI_REWRITE') {
    throw new Error(`Refusing to reset unexpected examples path: ${outputRoot}`)
  }
  rmSync(outputRoot, { force: true, recursive: true })
  mkdirSync(outputRoot, { recursive: true })
}

function removeTemporaryRoot(path: string): void {
  const temporaryPrefix = resolve(tmpdir()) + sep
  const resolvedPath = resolve(path)
  if (!resolvedPath.startsWith(temporaryPrefix)) {
    throw new Error(`Refusing to remove fixture directory outside temp: ${resolvedPath}`)
  }
  rmSync(resolvedPath, { force: true, recursive: true })
}

function walkFiles(root: string): string[] {
  return readdirSync(root)
    .sort((left, right) => left.localeCompare(right, 'en'))
    .flatMap((name) => {
      const path = resolve(root, name)
      return statSync(path).isDirectory() ? walkFiles(path) : [path]
    })
}

function runVersion(executable: string): string {
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8', shell: false })
  if (result.error || result.status !== 0) {
    throw new Error(`Could not read protoc version: ${result.error?.message ?? result.stderr}`)
  }
  return result.stdout.trim()
}

function generatedReadme(): string {
  return `# Tauri Rewrite Generated Examples

These files are regenerated from \`tests/fixtures/m0-legacy/proto\` by the new
Tauri rewrite domain and adapters. They are intentionally separate from the
legacy \`examples/CODE\`, \`examples/EXCEL\`, and \`examples/JSON\` directories,
which contain outputs from different schema revisions.

Run \`pnpm fixtures:rewrite\` to replace this directory and
\`pnpm fixtures:rewrite:check\` to verify its manifest. All eight protoc
languages use bundled \`libprotoc 34.1\`; Go additionally uses the committed
\`protoc-gen-go\`, while Rust opts into protoc's experimental upb codegen.
`
}

function portablePath(path: string): string {
  return path.split(sep).join('/')
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const prettierConfig = await resolvePrettierConfig(path, { editorconfig: true })
  const json = await formatWithPrettier(JSON.stringify(value), {
    ...prettierConfig,
    filepath: path,
    parser: 'json'
  })
  writeFileSync(path, json, 'utf8')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
