import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { env } from 'node:process'
import ExcelJS from 'exceljs'

const workspace = env.DATAMANAGER_E2E_WORKSPACE

describe('M8 native core flow', () => {
  it('runs settings, schema, diagram, Excel, JSON, and code generation in order', async () => {
    if (!workspace) throw new Error('DATAMANAGER_E2E_WORKSPACE is not configured.')
    const repository = resolve(workspace, '..')
    const settingsPath = resolve(workspace, 'settings.v2.json')
    const legacyConfigPath = resolve(repository, 'config.json')
    const originalLegacyConfig = readFileSync(legacyConfigPath, 'utf8')

    await openArea('설정', '설정')
    if (await (await $('[aria-label="열당 최대 테이블 수"]')).isExisting()) {
      throw new Error('Deprecated maxNodesPerColumn control is still visible.')
    }
    await clickButton('저장')
    await waitForToast('설정을 저장했습니다.')
    await waitForFileText(settingsPath, '"maxNodesPerColumn": 8')

    await openArea('테이블', '테이블')
    const declaration = await $('[aria-label="SingleTarget (KeyTable.proto)"]')
    await declaration.waitForClickable()
    await declaration.click()
    const labelField = await $('[aria-label="필드 2 이름"]')
    await labelField.waitForDisplayed()
    await labelField.setValue('labelE2e')
    await clickButton('저장')
    await waitForText('.notice-success', 'KeyTable.proto 저장 완료')
    const savedProto = readFileSync(resolve(workspace, 'proto', 'KeyTable.proto'), 'utf8')
    if (!savedProto.includes('string labelE2e = 2;')) {
      throw new Error('The schema edit was not persisted through the native boundary.')
    }
    await exerciseSchemaCrud(workspace)

    await openArea('관계도', '관계도')
    await browser.waitUntil(async () => (await $$('.react-flow__node')).length === 9, {
      timeout: 15_000,
      timeoutMsg: 'Expected nine projected Message nodes including Category.'
    })
    await browser.waitUntil(async () => (await $$('.react-flow__edge')).length === 10, {
      timeout: 15_000,
      timeoutMsg: 'Expected ten projected Message edges including two Category self references.'
    })
    await exerciseDiagramInteractions()

    await openArea('Excel', 'Excel')
    await clickAriaButton('Excel 생성 전체')
    await clickButton('선택 생성')
    await waitForText('.notice-success', 'workbook 생성 완료', 60_000)
    for (const fileName of ['CategoryTable.xlsx', 'KeyTable.xlsx', 'ReferenceTable.xlsx']) {
      if (!existsSync(resolve(workspace, 'excel', fileName))) {
        throw new Error(`${fileName} was not generated.`)
      }
    }
    await clickButton('선택 생성')
    await waitForText('[role="dialog"]', '기존 Excel 파일')
    await clickButton('생성 취소')
    if (existsSync(resolve(workspace, 'excel', 'backup'))) {
      throw new Error('Cancelling an Excel collision unexpectedly created a backup.')
    }

    await clickButton('선택 생성')
    await clickButton('백업 없이 덮어쓰기')
    await waitForText('.notice-success', '3개 workbook 생성 완료', 60_000)

    await clickButton('선택 생성')
    await clickButton('백업 후 생성')
    await waitForText('.notice-success', '3개 workbook 생성 완료, 3개 백업', 60_000)
    const backupFiles = readdirSync(resolve(workspace, 'excel', 'backup')).sort()
    if (
      backupFiles.length !== 3 ||
      !backupFiles.some((name) => /^CategoryTable_\d{14}\.xlsx$/.test(name)) ||
      !backupFiles.some((name) => /^KeyTable_\d{14}\.xlsx$/.test(name)) ||
      !backupFiles.some((name) => /^ReferenceTable_\d{14}\.xlsx$/.test(name))
    ) {
      throw new Error(`Unexpected Excel backup set: ${backupFiles.join(', ')}`)
    }

    await populateWorkbooks(workspace)
    await clickTab('JSON 생성')
    await clickAriaButton('KeyTable.xlsx 읽기 검사')
    await waitForText('.notice-success', 'KeyTable.xlsx: 4개 sheet, 8개 행 확인', 60_000)
    await clickAriaButton('ReferenceTable.xlsx 읽기 검사')
    await waitForText('.notice-success', 'ReferenceTable.xlsx: 4개 sheet, 2개 행 확인', 60_000)
    await clickAriaButton('CategoryTable.xlsx 읽기 검사')
    await waitForText('.notice-success', 'CategoryTable.xlsx: 1개 sheet, 3개 행 확인', 60_000)

    await clickAriaButton('ReferenceTable.xlsx RootTarget JSON 테이블')
    await clickJsonGenerate()
    await waitForText('.notice-success', 'JSON 파일 내보내기 완료', 60_000)
    const rootJson = resolve(workspace, 'json', 'RootTarget.json')
    assertResolvedRootJson(rootJson)
    await exerciseSelfReferenceJson(workspace)
    await exerciseExcelCancellationAndDiagnostics(workspace)

    await openArea('코드 생성', '코드 생성')
    await waitForText('.codegen-environment', 'libprotoc 34.1', 30_000)
    await clickButton('전체 생성')
    await waitForText('.notice-success', '9개 성공', 60_000)
    for (const relativePath of [
      ['code', 'cpp', 'KeyTable.pb.h'],
      ['code', 'csharp', 'KeyTable.cs'],
      ['code', 'java', 'DATA_MANAGER_FIXTURE', 'KeyTable.java'],
      ['code', 'python', 'KeyTable_pb2.py'],
      ['code', 'go', 'DATA_MANAGER_FIXTURE', 'KeyTable.pb.go'],
      ['code', 'rust', 'KeyTable.u.pb.rs'],
      ['code', 'ruby', 'KeyTable_pb.rb'],
      ['code', 'php', 'GPBMetadata', 'KeyTable.php'],
      ['code', 'cpp', 'CategoryTable.pb.h'],
      ['code', 'csharp', 'CategoryTable.cs'],
      ['code', 'java', 'd1000', 'CategoryTable.java'],
      ['code', 'python', 'CategoryTable_pb2.py'],
      ['code', 'go', 'd1000', 'CategoryTable.pb.go'],
      ['code', 'rust', 'CategoryTable.u.pb.rs'],
      ['code', 'ruby', 'CategoryTable_pb.rb'],
      ['code', 'php', 'D1000', 'Category.php'],
      ['code', 'unreal', 'DataTables.h'],
      ['code', 'unreal', 'DataTableLoader.cpp']
    ]) {
      if (!existsSync(resolve(workspace, ...relativePath))) {
        throw new Error(`${relativePath.join('/')} was not generated.`)
      }
    }
    const cancellationFixtures = createCancellationFixtures(workspace)
    try {
      await clickButton('전체 생성')
      await clickButton('현재 작업 후 중단')
      await waitForText('.notice-success', '중단', 60_000)
    } finally {
      for (const path of cancellationFixtures) rmSync(path, { force: true })
    }

    const invalidProtoPath = resolve(workspace, 'proto', 'ReferenceTable.proto')
    const validProtoSource = readFileSync(invalidProtoPath, 'utf8')
    try {
      writeFileSync(invalidProtoPath, `${validProtoSource}\nmessage InvalidE2e {\n`, 'utf8')
      await clickAriaButton('C++ 생성')
      await waitForText('.notice-success', '1개 실패', 60_000)
      await waitForText('.codegen-results', 'PROTOC_EXECUTION_FAILED')
    } finally {
      writeFileSync(invalidProtoPath, validProtoSource, 'utf8')
    }

    await openArea('설정', '설정')
    if (await (await $('[aria-label="열당 최대 테이블 수"]')).isExisting()) {
      throw new Error('Deprecated maxNodesPerColumn control returned after settings reload.')
    }
    if (JSON.parse(readFileSync(settingsPath, 'utf8')).diagram?.maxNodesPerColumn !== 8) {
      throw new Error('Deprecated maxNodesPerColumn was not preserved in settings v2.')
    }

    await clickButton('가져오기 검토')
    await waitForText(
      '[aria-label="기존 설정 경로 검사"]',
      resolve(repository, 'examples', 'PROTO')
    )
    await clickButton('이 설정 가져오기')
    await waitForToast('기존 설정을 가져왔습니다.')
    const importedSettings = JSON.parse(readFileSync(settingsPath, 'utf8'))
    if (importedSettings.protoRoot !== resolve(repository, 'examples', 'PROTO')) {
      throw new Error('The real legacy Proto path was not imported relative to config.json.')
    }
    const goOutput = importedSettings.codegenOutputs.find(({ language }) => language === 'golang')
    if (goOutput?.directory !== resolve(repository, 'examples', 'CODE', 'Go')) {
      throw new Error('The legacy golang output was not imported without field loss.')
    }
    if (importedSettings.legacyImport?.sourcePath !== legacyConfigPath) {
      throw new Error('The legacy import record does not point to the discovered config.json.')
    }
    if (readFileSync(legacyConfigPath, 'utf8') !== originalLegacyConfig) {
      throw new Error('The legacy config.json was modified during import.')
    }
  })
})

async function exerciseDiagramInteractions() {
  const minimap = await $('.react-flow__minimap')
  await minimap.waitForDisplayed()

  const search = await $('[aria-label="관계도 검색"]')
  await search.setValue('RootTarget')
  await browser.waitUntil(async () => (await $$('.diagram-node-dimmed')).length === 8, {
    timeoutMsg: 'Relationship search did not dim the eight non-matching Message nodes.'
  })
  await search.clearValue()
  await browser.waitUntil(async () => (await $$('.diagram-node-dimmed')).length === 0, {
    timeoutMsg: 'Clearing relationship search did not restore all nodes.'
  })

  const rootNode = await $('[aria-label="테이블 RootTarget"]')
  await hoverElement(rootNode)
  await browser.waitUntil(
    async () =>
      (await rootNode.$('.diagram-node'))
        .getAttribute('class')
        .then((value) => value.includes('diagram-node-emphasized')),
    { timeoutMsg: 'Hover did not emphasize RootTarget.' }
  )
  await browser.waitUntil(async () => (await $$('.diagram-node-dimmed')).length === 3, {
    timeoutMsg: 'Hover did not preserve only RootTarget and its five Message neighbors.'
  })

  const edge = (await $$('.react-flow__edge'))[0]
  await hoverElement(edge)
  await browser.waitUntil(async () => (await $$('.react-flow__edge-text')).length > 0, {
    timeoutMsg: 'Hover did not reveal a relationship edge label.'
  })

  const viewport = await $('.react-flow__viewport')
  const beforeZoom = await viewport.getAttribute('style')
  await (await $('.react-flow__controls-zoomin')).click()
  await browser.waitUntil(async () => (await viewport.getAttribute('style')) !== beforeZoom, {
    timeoutMsg: 'The relationship zoom control did not change the viewport transform.'
  })

  await exerciseResponsiveDiagramLayout()
}

async function exerciseResponsiveDiagramLayout() {
  await setNativeWindowSize(600, 800)
  try {
    await browser.waitUntil(async () => browser.execute(() => globalThis.innerWidth <= 600), {
      timeoutMsg: 'The native window did not resize to the compact breakpoint.'
    })
    const layout = await browser.execute(() => {
      const header = globalThis.document
        .querySelector('.application-header')
        ?.getBoundingClientRect()
      const navigation = globalThis.document
        .querySelector('.workspace-navigation')
        ?.getBoundingClientRect()
      const toolbar = globalThis.document.querySelector('.diagram-toolbar')?.getBoundingClientRect()
      const search = globalThis.document.querySelector('.diagram-search')?.getBoundingClientRect()
      const actions = globalThis.document
        .querySelector('.diagram-toolbar-actions')
        ?.getBoundingClientRect()
      const surface = globalThis.document.querySelector('.diagram-surface')?.getBoundingClientRect()
      return {
        rects: {
          toolbar: toolbar && {
            left: toolbar.left,
            right: toolbar.right,
            top: toolbar.top,
            bottom: toolbar.bottom
          },
          search: search && {
            left: search.left,
            right: search.right,
            top: search.top,
            bottom: search.bottom
          },
          actions: actions && {
            left: actions.left,
            right: actions.right,
            top: actions.top,
            bottom: actions.bottom
          }
        },
        bodyOverflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        headerContainsNavigation: Boolean(
          header && navigation && navigation.top >= header.top && navigation.bottom <= header.bottom
        ),
        surfaceContained: Boolean(
          surface &&
          surface.left >= 0 &&
          surface.right <= globalThis.innerWidth &&
          surface.width >= 400
        ),
        toolbarDoesNotOverlap: Boolean(
          toolbar &&
          search &&
          actions &&
          search.left >= toolbar.left - 1 &&
          actions.left >= toolbar.left - 1 &&
          (search.bottom <= actions.top ||
            actions.bottom <= search.top ||
            search.right <= actions.left ||
            actions.right <= search.left) &&
          search.bottom <= toolbar.bottom + 1 &&
          actions.bottom <= toolbar.bottom + 1
        )
      }
    })
    if (
      layout.bodyOverflow ||
      !layout.headerContainsNavigation ||
      !layout.surfaceContained ||
      !layout.toolbarDoesNotOverlap
    ) {
      throw new Error(`Compact relationship layout is invalid: ${JSON.stringify(layout)}`)
    }
  } finally {
    await setNativeWindowSize(1280, 900)
  }
}

async function setNativeWindowSize(width, height) {
  await browser.execute(
    async (nextSize) =>
      globalThis.__TAURI_INTERNALS__.invoke('plugin:window|set_size', {
        label: 'main',
        value: { Logical: nextSize }
      }),
    { width, height }
  )
}

async function exerciseSchemaCrud(root) {
  const keyTablePath = resolve(root, 'proto', 'KeyTable.proto')
  const keyTableSource = readFileSync(keyTablePath, 'utf8')
  const messageName = await $('[aria-label="Message 이름"]')
  await messageName.setValue('SingleTargetE2e')
  await clickButton('저장')
  await waitForText('[role="dialog"]', 'MiddleTarget.single')
  await waitForText('[role="dialog"]', 'RootTarget.single')
  await clickButton('취소')
  if (readFileSync(keyTablePath, 'utf8') !== keyTableSource) {
    throw new Error('Cancelling a referenced Message rename modified KeyTable.proto.')
  }

  await clickButton('삭제')
  await waitForText('[role="dialog"]', '참조 중인 필드 2개')
  await clickButton('취소')
  if (readFileSync(keyTablePath, 'utf8') !== keyTableSource) {
    throw new Error('Cancelling a referenced Message deletion modified KeyTable.proto.')
  }

  await clickButton('테이블 추가')
  await (await $('[aria-label="Message 이름"]')).setValue('E2eTemp')
  await clickButton('저장')
  await waitForText('.notice-success', 'E2eTempTable.proto 저장 완료')
  const temporaryTablePath = resolve(root, 'proto', 'E2eTempTable.proto')
  const temporaryTable = readFileSync(temporaryTablePath, 'utf8')
  if (!temporaryTable.includes('message E2eTemp') || !temporaryTable.includes('// @PK')) {
    throw new Error('The temporary table was not created with its primary key.')
  }

  await clickButton('삭제')
  await waitForText('[role="dialog"]', 'E2eTemp 삭제')
  await clickButton('계속')
  await waitForText('.notice-success', 'E2eTempTable.proto 저장 완료')
  if (readFileSync(temporaryTablePath, 'utf8').includes('message E2eTemp')) {
    throw new Error('The temporary table declaration was not deleted.')
  }
  const metadataDirectory = resolve(root, 'proto', '.datamanager')
  const workspaceMetadata = JSON.parse(
    readFileSync(resolve(metadataDirectory, 'workspace.json'), 'utf8')
  )
  const tableKeys = Object.keys(workspaceMetadata.tables)
  if (workspaceMetadata.revision !== 2 || tableKeys.length !== 0) {
    throw new Error(
      `Proto deletion and workspace metadata did not commit as one generation: revision=${workspaceMetadata.revision}, tables=${tableKeys.join(',')}`
    )
  }
  const transactionLeftovers = readdirSync(metadataDirectory).filter(
    (name) => name === 'transaction.json' || name.endsWith('.tmp') || name.endsWith('.bak')
  )
  if (transactionLeftovers.length > 0) {
    throw new Error(`Workspace transaction left owned files: ${transactionLeftovers.join(', ')}`)
  }
  rmSync(temporaryTablePath, { force: true })

  await openArea('Enum', 'Enum')
  await clickButton('Enum 추가')
  await (await $('[aria-label="Enum 이름"]')).setValue('E2eStatus')
  await clickButton('값 추가')
  await (await $('[aria-label="Enum 값 1 이름"]')).setValue('E2eStatus_ACTIVE')
  await clickButton('저장')
  await waitForText('.notice-success', 'E2eStatusEnumType.proto 저장 완료')
  const temporaryEnumPath = resolve(root, 'proto', 'E2eStatusEnumType.proto')
  let temporaryEnum = readFileSync(temporaryEnumPath, 'utf8')
  if (
    !temporaryEnum.includes('E2eStatus_NONE = 0;') ||
    !temporaryEnum.includes('E2eStatus_ACTIVE = 1;') ||
    !temporaryEnum.includes('E2eStatus_MAX = 2;')
  ) {
    throw new Error('The temporary Enum sentinels or value were not normalized.')
  }

  await (await $('[aria-label="Enum 값 1 이름"]')).setValue('E2eStatus_READY')
  await clickButton('저장')
  await waitForText('.notice-success', 'E2eStatusEnumType.proto 저장 완료')
  temporaryEnum = readFileSync(temporaryEnumPath, 'utf8')
  if (!temporaryEnum.includes('E2eStatus_READY = 1;') || temporaryEnum.includes('ACTIVE')) {
    throw new Error('The temporary Enum value update was not persisted.')
  }

  await clickButton('삭제')
  await waitForText('[role="dialog"]', 'E2eStatus 삭제')
  await clickButton('계속')
  await waitForText('.notice-success', 'E2eStatusEnumType.proto 저장 완료')
  if (readFileSync(temporaryEnumPath, 'utf8').includes('enum E2eStatus')) {
    throw new Error('The temporary Enum declaration was not deleted.')
  }
  rmSync(temporaryEnumPath, { force: true })

  const fixtureEnumPath = resolve(root, 'proto', 'FixtureEnumType.proto')
  const fixtureEnumSource = readFileSync(fixtureEnumPath, 'utf8')
  await clickAriaButton('FixtureState (FixtureEnumType.proto)')
  await clickButton('삭제')
  await waitForText('[role="dialog"]', 'RootTarget.state')
  await waitForText('[role="dialog"]', 'SingleTarget.state')
  await clickButton('취소')
  if (readFileSync(fixtureEnumPath, 'utf8') !== fixtureEnumSource) {
    throw new Error('Cancelling a referenced Enum deletion modified FixtureEnumType.proto.')
  }
}

async function hoverElement(element) {
  await element.moveTo()
  await browser.execute((target) => {
    target.dispatchEvent(
      new target.ownerDocument.defaultView.MouseEvent('mouseover', { bubbles: true })
    )
  }, element)
}

async function populateWorkbooks(root) {
  await populateWorkbook(resolve(root, 'excel', 'CategoryTable.xlsx'), {
    Category: [
      [1, null, null],
      [2, 1, null],
      [3, 2, null]
    ]
  })
  await populateWorkbook(resolve(root, 'excel', 'KeyTable.xlsx'), {
    SingleTarget: [
      [1, 'Alpha', 'FixtureState_ACTIVE'],
      [2, 'Beta', 'FixtureState_NONE']
    ],
    CompositeTarget: [
      [1, 1, 'North A'],
      [1, 2, 'North B'],
      [2, 1, 'South A']
    ],
    GroupTarget: [
      [10, 'Reward A'],
      [10, 'Reward B'],
      [20, 'Reward C']
    ]
  })
  await populateWorkbook(resolve(root, 'excel', 'ReferenceTable.xlsx'), {
    MiddleTarget: [[100, 1]],
    RootTarget: [[500, 1, 1, 10, 100, null, 'FixtureState_ACTIVE']]
  })
}

async function populateWorkbook(path, rowsBySheet) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  for (const [sheetName, rows] of Object.entries(rowsBySheet)) {
    const sheet = workbook.getWorksheet(sheetName)
    if (!sheet) throw new Error(`Workbook is missing ${sheetName}.`)
    for (const row of rows) sheet.addRow(row)
  }
  await workbook.xlsx.writeFile(path)
}

async function exerciseSelfReferenceJson(root) {
  await clickAriaButton('ReferenceTable.xlsx RootTarget JSON 테이블')
  await clickAriaButton('CategoryTable.xlsx Category JSON 테이블')
  await clickJsonGenerate()
  await waitForText('.notice-success', 'JSON 파일 내보내기 완료', 60_000)
  const jsonPath = resolve(root, 'json', 'Category.json')
  const rows = JSON.parse(readFileSync(jsonPath, 'utf8'))
  if (
    rows.length !== 3 ||
    rows[2]?.parent?.id !== 2 ||
    rows[2]?.parent?.parent?.id !== 1 ||
    rows[2]?.parent?.parent?.parent !== null
  ) {
    throw new Error(
      `Category.json did not inline the terminating parent chain: ${JSON.stringify(rows)}`
    )
  }

  rmSync(jsonPath, { force: true })
  const workbookPath = resolve(root, 'excel', 'CategoryTable.xlsx')
  const validBytes = readFileSync(workbookPath)
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(workbookPath)
    const category = workbook.getWorksheet('Category')
    if (!category) throw new Error('CategoryTable.xlsx is missing Category.')
    category.getCell('B2').value = 1
    await workbook.xlsx.writeFile(workbookPath)

    await clickJsonGenerate()
    await waitForText('.excel-diagnostics', 'JSON_REFERENCE_ROW_CYCLE', 60_000)
    await waitForText('.excel-diagnostics', 'Category R2 (id=1)', 60_000)
    if (existsSync(jsonPath)) {
      throw new Error('A row cycle wrote a partial Category.json file.')
    }
  } finally {
    writeFileSync(workbookPath, validBytes)
  }
}

async function exerciseExcelCancellationAndDiagnostics(root) {
  const path = resolve(root, 'excel', 'KeyTable.xlsx')
  const validBytes = readFileSync(path)
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path)
    const singleTarget = workbook.getWorksheet('SingleTarget')
    if (!singleTarget) throw new Error('KeyTable.xlsx is missing SingleTarget.')
    singleTarget.addRows(
      Array.from({ length: 9_998 }, (_, index) => [
        index + 3,
        `Bulk ${index + 3}`,
        'FixtureState_NONE'
      ])
    )
    await workbook.xlsx.writeFile(path)

    await clickAriaButton('KeyTable.xlsx 읽기 검사')
    await (await $('.excel-progress')).waitForDisplayed({ timeout: 30_000 })
    const cancellationStarted = Date.now()
    await (await $('.excel-progress button')).click()
    await waitForText('.notice-error', '작업이 취소되었습니다', 30_000)
    if (Date.now() - cancellationStarted > 10_000) {
      throw new Error('Cancelling the 10,000-row Excel worker took longer than 10 seconds.')
    }
  } finally {
    writeFileSync(path, validBytes)
  }

  const diagnosticBytes = readFileSync(path)
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path)
    const singleTarget = workbook.getWorksheet('SingleTarget')
    if (!singleTarget) throw new Error('KeyTable.xlsx is missing SingleTarget.')
    singleTarget.getCell('A2').value = 'not-an-int32'
    await workbook.xlsx.writeFile(path)

    await clickAriaButton('KeyTable.xlsx 읽기 검사')
    await waitForText('.notice-error', 'KeyTable.xlsx 입력 오류 1개', 30_000)
    await waitForText('.excel-diagnostics', 'EXCEL_CELL_TYPE_MISMATCH')
    await waitForText('.excel-diagnostics', 'SingleTarget R2C1')
  } finally {
    writeFileSync(path, diagnosticBytes)
  }
}

function assertResolvedRootJson(path) {
  if (!existsSync(path)) throw new Error('RootTarget.json was not generated.')
  const contents = readFileSync(path, 'utf8')
  if (!contents.endsWith('\n')) throw new Error('RootTarget.json has no final newline.')
  const rows = JSON.parse(contents)
  const root = rows[0]
  if (
    rows.length !== 1 ||
    root.single?.labelE2e !== 'Alpha' ||
    root.composite?.length !== 2 ||
    root.group?.length !== 2 ||
    root.middle?.single?.labelE2e !== 'Alpha' ||
    root.noKey !== null ||
    root.state !== 'FixtureState_ACTIVE'
  ) {
    throw new Error(`RootTarget.json did not preserve resolved reference shapes: ${contents}`)
  }
}

function createCancellationFixtures(root) {
  return Array.from({ length: 80 }, (_, index) => {
    const suffix = String(index).padStart(3, '0')
    const path = resolve(root, 'proto', `Cancel${suffix}Table.proto`)
    writeFileSync(
      path,
      `syntax = "proto3";\npackage DATA_MANAGER_FIXTURE;\noption go_package = "./DATA_MANAGER_FIXTURE";\nmessage Cancel${suffix} { int32 id = 1; }\n`,
      'utf8'
    )
    return path
  })
}

async function openArea(buttonName, headingText) {
  await clickButton(buttonName)
  await waitForText('h2', headingText)
}

async function clickButton(name) {
  const button = await $(`button=${name}`)
  await button.waitForClickable()
  await button.click()
}

async function clickAriaButton(name) {
  const button = await $(`[aria-label="${name}"]`)
  await button.waitForClickable()
  await button.click()
}

async function clickTab(name) {
  const tab = await $(`//button[@role="tab" and normalize-space()="${name}"]`)
  await tab.waitForClickable()
  await tab.click()
}

async function clickJsonGenerate() {
  const panel = await $('#json-generation-panel')
  const button = await panel.$('button=JSON 생성')
  await button.waitForClickable()
  await button.click()
}

async function waitForText(selector, expected, timeout = 10_000) {
  await browser.waitUntil(
    async () => {
      const element = await $(selector)
      return (await element.isExisting()) && (await element.getText()).includes(expected)
    },
    {
      timeout,
      timeoutMsg: `Expected '${expected}' in ${selector}.`
    }
  )
}

async function waitForToast(expected, timeout = 10_000) {
  const toast = await $('[data-sonner-toast]')
  await toast.waitForDisplayed({ timeout })
  const text = await toast.getText()
  if (!text.includes(expected)) throw new Error(`Expected toast '${expected}', received '${text}'.`)
}

async function waitForFileText(path, expected, timeout = 10_000) {
  await browser.waitUntil(
    async () => existsSync(path) && readFileSync(path, 'utf8').includes(expected),
    { timeout, timeoutMsg: `Expected '${expected}' in ${path}.` }
  )
}
