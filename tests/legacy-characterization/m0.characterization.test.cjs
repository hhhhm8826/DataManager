/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const test = require('node:test')
const TypeScript = require('typescript')
const ExcelJS = require('exceljs')

const repositoryRoot = path.resolve(__dirname, '..', '..')
const fixtureRoot = path.join(repositoryRoot, 'tests', 'fixtures', 'm0-legacy')
const fixtureProtoDir = path.join(fixtureRoot, 'proto')

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = TypeScript.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: TypeScript.ModuleKind.CommonJS,
      target: TypeScript.ScriptTarget.ES2022
    }
  }).outputText
  module._compile(output, filename)
}

const originalModuleLoad = Module._load
Module._load = function loadWithElectronStub(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: false,
        getAppPath: () => repositoryRoot,
        getPath: () => repositoryRoot
      },
      ipcMain: {
        handle: () => undefined
      }
    }
  }
  if (request === 'electron-store') {
    return class MemoryStore {
      constructor(options = {}) {
        this.values = { ...(options.defaults ?? {}) }
      }

      get(key) {
        return this.values[key]
      }

      set(key, value) {
        this.values[key] = value
      }
    }
  }
  return originalModuleLoad.call(this, request, parent, isMain)
}

const { ProtoParserService } = require(
  path.join(repositoryRoot, 'src', 'main', 'services', 'ProtoParserService.ts')
)
const { ExcelService } = require(
  path.join(repositoryRoot, 'src', 'main', 'services', 'ExcelService.ts')
)
const { JsonService } = require(
  path.join(repositoryRoot, 'src', 'main', 'services', 'JsonService.ts')
)
const { ProtocService } = require(
  path.join(repositoryRoot, 'src', 'main', 'services', 'CodeGeneratorService.ts')
)
const { UnrealCodeGeneratorService } = require(
  path.join(repositoryRoot, 'src', 'main', 'services', 'UnrealCodeGeneratorService.ts')
)
const { resolveInlineReferences, validatePrimaryKeys } = require(
  path.join(repositoryRoot, 'src', 'main', 'ipc', 'excel.ipc.ts')
)

function readFixtureJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8'))
}

function projectParsedProto(parsed) {
  return {
    messages: parsed.messages
      .map((message) => ({
        name: message.name,
        sourceFile: message.sourceFile,
        pkFields: message.pkFields,
        keyFields: message.keyFields,
        fields: message.fields.map((field) => ({
          name: field.name,
          type: field.type,
          fieldNumber: field.fieldNumber,
          isPk: field.isPk,
          isKey: field.isKey,
          isRepeated: field.isRepeated
        }))
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    enums: parsed.enums
      .map((protoEnum) => ({
        name: protoEnum.name,
        sourceFile: protoEnum.sourceFile,
        values: protoEnum.values
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    errors: parsed.errors
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createResults(parsed, rowsByMessage) {
  return parsed.messages.map((message) => ({
    messageName: message.name,
    rows: clone(rowsByMessage[message.name] ?? [])
  }))
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

test('M0: legacy parser fixture has a stable schema snapshot', () => {
  const parser = new ProtoParserService()
  const parsed = parser.parseDirectory(fixtureProtoDir)

  assert.deepEqual(
    projectParsedProto(parsed),
    readFixtureJson(path.join('expected', 'parsed-schema.json'))
  )
})

test('M0: legacy Excel, JSON reference, protoc, and Unreal behavior is characterized', async () => {
  const parser = new ProtoParserService()
  const parsed = parser.parseDirectory(fixtureProtoDir)
  const rowsByMessage = readFixtureJson('data.json')
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'datamanager-m0-'))
  const excelDir = path.join(tempDir, 'excel')

  try {
    const excelService = new ExcelService()
    const created = await excelService.generateExcel(excelDir, parsed.messages, parsed.enums)
    assert.deepEqual(created.sort(), ['KeyTable.xlsx', 'ReferenceTable.xlsx'])

    const keyWorkbookPath = path.join(excelDir, 'KeyTable.xlsx')
    const keyWorkbook = new ExcelJS.Workbook()
    await keyWorkbook.xlsx.readFile(keyWorkbookPath)
    assert.deepEqual(
      keyWorkbook.worksheets.map((sheet) => sheet.name),
      ['SingleTarget', 'CompositeTarget', 'GroupTarget', 'NoKeyTarget', '_DropDown']
    )

    const singleTargetSheet = keyWorkbook.getWorksheet('SingleTarget')
    assert.deepEqual(singleTargetSheet.getRow(1).values.slice(1), ['id', 'label', 'state'])
    assert.equal(singleTargetSheet.getCell('A1').fill.fgColor.argb, 'FFFFCC00')
    assert.equal(singleTargetSheet.getCell('B1').fill.fgColor.argb, 'FF4472C4')
    const enumValidation = singleTargetSheet.dataValidations.model
    assert.deepEqual(enumValidation.C2.formulae, ["'_DropDown'!$A$2:$A$3"])
    assert.deepEqual(enumValidation.C10000.formulae, ["'_DropDown'!$A$2:$A$3"])

    const referenceWorkbookPath = path.join(excelDir, 'ReferenceTable.xlsx')
    const referenceWorkbook = new ExcelJS.Workbook()
    await referenceWorkbook.xlsx.readFile(referenceWorkbookPath)
    const cycleSheet = referenceWorkbook.getWorksheet('CycleA')
    const cycleValidation = cycleSheet.dataValidations.model.B2.formulae[0]
    assert.match(cycleValidation, /CycleB/)
    assert.match(cycleValidation, /\$A\$21/)

    const workbooksBySource = new Map()
    for (const sourceFile of new Set(parsed.messages.map((message) => message.sourceFile))) {
      const workbook = new ExcelJS.Workbook()
      const workbookPath = path.join(excelDir, sourceFile.replace(/\.proto$/, '.xlsx'))
      await workbook.xlsx.readFile(workbookPath)
      workbooksBySource.set(sourceFile, { workbook, workbookPath })
    }

    for (const message of parsed.messages) {
      const entry = workbooksBySource.get(message.sourceFile)
      const rows = rowsByMessage[message.name]
      if (rows && rows.length > 0) {
        const sheet = entry.workbook.getWorksheet(message.name)
        for (const row of rows) {
          sheet.addRow(message.fields.map((field) => row[field.name] ?? null))
        }
      }
    }
    for (const entry of workbooksBySource.values()) {
      await entry.workbook.xlsx.writeFile(entry.workbookPath)
    }

    const resultsByName = new Map()
    for (const sourceFile of workbooksBySource.keys()) {
      const messageNames = parsed.messages
        .filter((message) => message.sourceFile === sourceFile)
        .map((message) => message.name)
      const workbookPath = workbooksBySource.get(sourceFile).workbookPath
      const readResults = await excelService.readExcel(workbookPath, messageNames)
      for (const result of readResults) resultsByName.set(result.messageName, result)
    }
    const readResults = parsed.messages.map((message) => resultsByName.get(message.name))

    assert.deepEqual(resultsByName.get('SingleTarget').rows, rowsByMessage.SingleTarget)
    assert.equal(validatePrimaryKeys(readResults, parsed.messages), null)

    const duplicateComposite = createResults(parsed, rowsByMessage)
    const composite = duplicateComposite.find((result) => result.messageName === 'CompositeTarget')
    composite.rows.push(clone(composite.rows[0]))
    assert.match(validatePrimaryKeys(duplicateComposite, parsed.messages), /PK/)

    const emptyPrimaryKey = createResults(parsed, rowsByMessage)
    emptyPrimaryKey.find((result) => result.messageName === 'SingleTarget').rows[0].id = ''
    assert.match(validatePrimaryKeys(emptyPrimaryKey, parsed.messages), /비어있습니다/)

    const resolved = resolveInlineReferences(readResults, parsed.messages)
    const rootResult = resolved.find((result) => result.messageName === 'RootTarget')
    assert.equal(Array.isArray(rootResult.rows[0].group), true)
    assert.equal(Array.isArray(rootResult.rows[0].composite), true)
    assert.equal(rootResult.rows[1].single, 999)
    assert.doesNotThrow(() => resolveInlineReferences(readResults, parsed.messages))

    const jsonDir = path.join(tempDir, 'json')
    new JsonService().exportExcelToJson(jsonDir, [rootResult])
    assert.equal(
      fs.readFileSync(path.join(jsonDir, 'RootTarget.json'), 'utf8'),
      fs.readFileSync(path.join(fixtureRoot, 'expected', 'RootTarget.json'), 'utf8')
    )

    const protocOutputDir = path.join(tempDir, 'protoc')
    new ProtocService().generate(
      path.join(repositoryRoot, 'examples', 'PROTOC', 'protoc.exe'),
      fixtureProtoDir,
      'cpp',
      protocOutputDir
    )
    assert.equal(fs.existsSync(path.join(protocOutputDir, 'KeyTable.pb.h')), true)
    assert.equal(fs.existsSync(path.join(protocOutputDir, 'ReferenceTable.pb.cc')), true)

    const unrealOutputDir = path.join(tempDir, 'unreal')
    const unrealFiles = new UnrealCodeGeneratorService().generate(parsed, unrealOutputDir)
    assert.deepEqual(unrealFiles.sort(), [
      'DataTableLoader.cpp',
      'DataTableLoader.h',
      'DataTables.h',
      'FixtureEnumType.h'
    ])
    const tablesHeader = fs.readFileSync(path.join(unrealOutputDir, 'DataTables.h'), 'utf8')
    const enumHeader = fs.readFileSync(path.join(unrealOutputDir, 'FixtureEnumType.h'), 'utf8')
    const loaderSource = fs.readFileSync(path.join(unrealOutputDir, 'DataTableLoader.cpp'), 'utf8')
    const expectedUnrealHashes = readFixtureJson(path.join('expected', 'unreal-sha256.json'))
    assert.deepEqual(
      {
        'DataTables.h': sha256(tablesHeader),
        'DataTableLoader.h': sha256(
          fs.readFileSync(path.join(unrealOutputDir, 'DataTableLoader.h'), 'utf8')
        ),
        'DataTableLoader.cpp': sha256(loaderSource),
        'FixtureEnumType.h': sha256(enumHeader)
      },
      expectedUnrealHashes
    )
    assert.match(tablesHeader, /struct FRootTarget/)
    assert.match(enumHeader, /FixtureState_FixtureState_NONE/)
    assert.match(loaderSource, /void FRootTarget::ParseFromJson/)
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }
})
