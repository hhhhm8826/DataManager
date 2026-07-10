import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC } from '../../shared/ipc-channels'
import { excelService } from '../services/ExcelService'
import { jsonService } from '../services/JsonService'
import { settingsService } from '../services/SettingsService'
import { protoParserService } from '../services/ProtoParserService'
import type {
  IpcResult,
  ExcelReadResult,
  ExcelFileInfo,
  ExcelRowData,
  ProtoMessage
} from '../../shared/types'

// ── 인라인 임베드 헬퍼 ────────────────────────────────────────────────────────

/**
 * ExcelReadResult 배열을 proto Message 정의를 바탕으로 재처리합니다.
 * Message 타입 필드는 참조 테이블의 행 객체(또는 배열)로 교체됩니다 (인라인 임베드).
 *
 * - 합성 PK 테이블 참조: 첫 번째 PK가 일치하는 모든 행을 배열로 임베드 (32-1 fix)
 * - 다단계 참조: 위상 정렬 후 순서대로 처리하여 이미 임베드된 행을 재사용 (32-2 fix)
 */
export function resolveInlineReferences(
  results: ExcelReadResult[],
  allMessageDefs: ReturnType<typeof protoParserService.parseMessages>
): ExcelReadResult[] {
  const msgNameSet = new Set(allMessageDefs.map((m) => m.name))
  const presentNames = new Set(results.map((r) => r.messageName))

  // ── 원본 PK/Key 인덱스 (임베드 전 원시값 기준) ──
  // key: msgName → { firstPk: string | null, firstKey: string | null, isKeyMode: boolean, entries: Array<{ rawKey: unknown, rowIdx: number }> }
  const rawPkIndex = new Map<
    string,
    {
      firstPk: string | null
      firstKey: string | null
      isKeyMode: boolean
      entries: { rawKey: unknown; rowIdx: number }[]
    }
  >()
  for (const result of results) {
    const msgDef = allMessageDefs.find((m) => m.name === result.messageName)
    if (!msgDef) continue
    const isKeyMode = msgDef.keyFields && msgDef.keyFields.length > 0
    const firstPk = msgDef.pkFields[0] ?? null
    const firstKey = (msgDef.keyFields && msgDef.keyFields[0]) ?? null
    const indexField = isKeyMode ? firstKey : firstPk
    if (!indexField) continue
    const entries = result.rows.map((row, idx) => ({ rawKey: row[indexField], rowIdx: idx }))
    rawPkIndex.set(result.messageName, { firstPk, firstKey, isKeyMode, entries })
  }

  // ── 임베드 진행 중인 행 배열 (처리 후 갱신) ──
  const resolvedRows = new Map<string, ExcelRowData[]>()
  for (const result of results) {
    resolvedRows.set(
      result.messageName,
      result.rows.map((r) => ({ ...r }))
    )
  }

  const pkMatch = (rawKey: unknown, val: unknown): boolean => {
    if (rawKey === val) return true
    const n = Number(val)
    if (!isNaN(n) && rawKey === n) return true
    if (rawKey === String(val)) return true
    return false
  }

  // ── 위상 정렬 (참조 대상을 먼저 처리) ──────────────────────
  const deps = new Map<string, Set<string>>()
  for (const name of presentNames) {
    const msgDef = allMessageDefs.find((m) => m.name === name)
    const refTypes = msgDef
      ? msgDef.fields
          .filter((f) => msgNameSet.has(f.type) && f.type !== name && presentNames.has(f.type))
          .map((f) => f.type)
      : []
    deps.set(name, new Set(refTypes))
  }

  const processed = new Set<string>()
  const order: string[] = []
  let changed = true
  while (changed) {
    changed = false
    for (const name of presentNames) {
      if (processed.has(name)) continue
      const d = deps.get(name) ?? new Set<string>()
      if ([...d].every((dep) => processed.has(dep) || !presentNames.has(dep))) {
        order.push(name)
        processed.add(name)
        changed = true
      }
    }
  }
  for (const name of presentNames) {
    if (!processed.has(name)) order.push(name)
  }

  // ── 위상 순서대로 임베드 처리 ──────────────────────────────
  for (const msgName of order) {
    const msgDef = allMessageDefs.find((m) => m.name === msgName)
    if (!msgDef) continue

    const refFields = msgDef.fields.filter(
      (f) => msgNameSet.has(f.type) && f.type !== msgName && presentNames.has(f.type)
    )
    if (refFields.length === 0) continue

    const currentRows = resolvedRows.get(msgName) ?? []
    const newRows = currentRows.map((row) => {
      const newRow: ExcelRowData = { ...row }
      for (const field of refFields) {
        const rawVal = row[field.name]
        if (rawVal === null || rawVal === undefined) continue

        const refMsgDef = allMessageDefs.find((m) => m.name === field.type)
        if (!refMsgDef) continue

        // 원본 PK/Key 인덱스로 행 인덱스를 찾아 → 임베드 완료된 행을 가져옴
        const pkIdx = rawPkIndex.get(field.type)
        if (!pkIdx) continue
        const refResolved = resolvedRows.get(field.type) ?? []

        if (pkIdx.isKeyMode) {
          // Key 모드: Key 값이 일치하는 모든 행을 배열로
          const matchIndices = pkIdx.entries
            .filter((e) => pkMatch(e.rawKey, rawVal))
            .map((e) => e.rowIdx)
          const matches = matchIndices.map((i) => refResolved[i]).filter(Boolean)
          if (matches.length > 0) newRow[field.name] = matches as unknown as ExcelRowData[string]
        } else if (refMsgDef.pkFields.length > 1) {
          // 합성 PK: 첫 번째 PK가 일치하는 모든 행을 배열로
          const matchIndices = pkIdx.entries
            .filter((e) => pkMatch(e.rawKey, rawVal))
            .map((e) => e.rowIdx)
          const matches = matchIndices.map((i) => refResolved[i]).filter(Boolean)
          if (matches.length > 0) newRow[field.name] = matches as unknown as ExcelRowData[string]
        } else {
          // 단일 PK: 일치하는 첫 번째 행 하나
          const entry = pkIdx.entries.find((e) => pkMatch(e.rawKey, rawVal))
          if (entry !== undefined) {
            const match = refResolved[entry.rowIdx]
            if (match) newRow[field.name] = match as unknown as ExcelRowData[string]
          }
        }
      }
      return newRow
    })

    resolvedRows.set(msgName, newRows)
  }

  return results.map((result) => ({
    ...result,
    rows: resolvedRows.get(result.messageName) ?? result.rows
  }))
}

// ── PK 유효성 검사 ────────────────────────────────────────────────────────────

export function validatePrimaryKeys(
  results: ExcelReadResult[],
  allMessageDefs: ProtoMessage[]
): string | null {
  for (const result of results) {
    const msgDef = allMessageDefs.find((m) => m.name === result.messageName)
    if (!msgDef || msgDef.pkFields.length === 0) continue

    const pkFields = msgDef.pkFields
    const seen = new Set<string>()

    for (let rowIndex = 0; rowIndex < result.rows.length; rowIndex++) {
      const row = result.rows[rowIndex]

      // 빈 값 체크
      for (const pk of pkFields) {
        const val = row[pk]
        if (val === null || val === undefined || val === '') {
          return `[${result.messageName}] ${rowIndex + 2}행: PK 필드 '${pk}'의 값이 비어있습니다.`
        }
      }

      // 중복 체크 (단일 PK 또는 Composite Key)
      const compositeKey = pkFields.map((pk) => String(row[pk])).join('\0')
      if (seen.has(compositeKey)) {
        const keyDisplay =
          pkFields.length === 1
            ? `'${pkFields[0]}' = ${row[pkFields[0]]}`
            : pkFields.map((pk) => `${pk}=${row[pk]}`).join(', ')
        return `[${result.messageName}] PK 중복 오류 (${rowIndex + 2}행): ${keyDisplay}`
      }
      seen.add(compositeKey)
    }
  }
  return null
}

export function registerExcelIpc(): void {
  // proto 기반 Excel 파일 생성 (selectedProtoFiles 가 있으면 해당 파일만, 없으면 전체)
  // backup=true 이면 기존 파일을 {Name}_bak.xlsx 로 백업한 뒤 생성
  ipcMain.handle(
    IPC.EXCEL_GENERATE,
    async (
      _event,
      selectedProtoFiles?: string[],
      backup?: boolean
    ): Promise<IpcResult<{ created: string[]; backedUp: string[] }>> => {
      try {
        const settings = settingsService.getResolved()
        if (!settings.protoDir)
          return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
        if (!settings.excelDir)
          return { success: false, error: 'Excel 디렉토리가 설정되지 않았습니다.' }

        const parsed = protoParserService.parseDirectory(settings.protoDir)
        if (parsed.messages.length === 0)
          return { success: false, error: '파싱된 테이블이 없습니다.' }

        const messages =
          selectedProtoFiles && selectedProtoFiles.length > 0
            ? parsed.messages.filter((m) => selectedProtoFiles.includes(m.sourceFile))
            : parsed.messages

        if (messages.length === 0)
          return { success: false, error: '선택된 proto 파일에 테이블이 없습니다.' }

        // 백업: 생성될 각 xlsx 파일이 이미 존재하면 backup/{Name}_{Date}.xlsx 로 이동
        const backedUp: string[] = []
        if (backup) {
          const backupDir = path.join(settings.excelDir, 'backup')
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

          const now = new Date()
          const dateStr = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0'),
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
          ].join('')

          const sourceFiles = [...new Set(messages.map((m) => m.sourceFile))]
          for (const sourceFile of sourceFiles) {
            const baseName = sourceFile.replace(/\.proto$/, '')
            const excelPath = path.join(settings.excelDir, baseName + '.xlsx')
            if (fs.existsSync(excelPath)) {
              const bakFileName = `${baseName}_${dateStr}.xlsx`
              const bakPath = path.join(backupDir, bakFileName)
              fs.copyFileSync(excelPath, bakPath)
              backedUp.push(`backup/${bakFileName}`)
            }
          }
        }

        const created = await excelService.generateExcel(settings.excelDir, messages, parsed.enums)
        return { success: true, data: { created, backedUp } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // proto 파일별 Excel 파일 목록 + 존재 여부 반환
  ipcMain.handle(IPC.EXCEL_LIST_EXISTING, async (): Promise<IpcResult<ExcelFileInfo[]>> => {
    try {
      const settings = settingsService.getResolved()
      if (!settings.protoDir) return { success: true, data: [] }

      const parsed = protoParserService.parseDirectory(settings.protoDir)

      const groups = new Map<string, string[]>()
      for (const msg of parsed.messages) {
        if (!groups.has(msg.sourceFile)) groups.set(msg.sourceFile, [])
        groups.get(msg.sourceFile)!.push(msg.name)
      }

      const result: ExcelFileInfo[] = []
      for (const [protoFile, msgNames] of groups) {
        const excelFile = protoFile.replace(/\.proto$/, '') + '.xlsx'
        const excelPath = settings.excelDir ? path.join(settings.excelDir, excelFile) : ''
        const exists = excelPath ? fs.existsSync(excelPath) : false
        result.push({ protoFile, excelFile, excelPath, msgNames, exists })
      }

      return { success: true, data: result }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // Excel 파일 읽기 → JSON 저장
  // specificSheets 가 있으면 해당 시트만, 없으면 proto 파일명 기반으로 허용 시트를 도출합니다.
  ipcMain.handle(
    IPC.EXCEL_READ,
    async (
      _event,
      excelFilePath: string,
      specificSheets?: string[]
    ): Promise<IpcResult<ExcelReadResult[]>> => {
      try {
        const settings = settingsService.getResolved()
        if (!settings.jsonDir)
          return { success: false, error: 'JSON 디렉토리가 설정되지 않았습니다.' }

        let allowedMessages: string[]

        if (specificSheets && specificSheets.length > 0) {
          allowedMessages = specificSheets
        } else {
          if (!settings.protoDir)
            return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }
          const parsed = protoParserService.parseDirectory(settings.protoDir)
          const baseName = path.basename(excelFilePath, '.xlsx')
          const protoFileName = baseName + '.proto'
          allowedMessages = parsed.messages
            .filter((m) => m.sourceFile === protoFileName)
            .map((m) => m.name)
          if (allowedMessages.length === 0) {
            return {
              success: false,
              error: `${protoFileName} 에 정의된 테이블을 찾을 수 없습니다.`
            }
          }
        }

        const allMessageDefs = settings.protoDir
          ? protoParserService.parseDirectory(settings.protoDir).messages
          : []

        const results = await excelService.readExcel(excelFilePath, allowedMessages)

        const pkError = validatePrimaryKeys(results, allMessageDefs)
        if (pkError) return { success: false, error: pkError }

        jsonService.exportExcelToJson(settings.jsonDir, results)

        return { success: true, data: results }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )

  // 여러 Excel 파일을 한 번에 읽고 Message 참조를 인라인 임베드하여 JSON 저장
  // requests: Array<{ excelPath: string; sheets: string[] }>
  ipcMain.handle(
    IPC.EXCEL_EXPORT_JSON,
    async (
      _event,
      requests: { excelPath: string; sheets: string[] }[]
    ): Promise<IpcResult<{ exported: number; embedded: string[] }>> => {
      try {
        const settings = settingsService.getResolved()
        if (!settings.jsonDir)
          return { success: false, error: 'JSON 디렉토리가 설정되지 않았습니다.' }
        if (!settings.protoDir)
          return { success: false, error: 'proto 디렉토리가 설정되지 않았습니다.' }

        const parsed = protoParserService.parseDirectory(settings.protoDir)
        const allMessageDefs = parsed.messages

        // 1. 모든 Excel 파일 읽기
        const allResults: ExcelReadResult[] = []
        for (const req of requests) {
          const rows = await excelService.readExcel(req.excelPath, req.sheets)
          allResults.push(...rows)
        }

        // 1-1. PK 유효성 검사
        const pkError = validatePrimaryKeys(allResults, allMessageDefs)
        if (pkError) return { success: false, error: pkError }

        // 2. 인라인 임베드 처리
        const embedded: string[] = []
        const msgNameSet = new Set(allMessageDefs.map((m) => m.name))
        for (const result of allResults) {
          const msgDef = allMessageDefs.find((m) => m.name === result.messageName)
          if (!msgDef) continue
          const refFields = msgDef.fields.filter(
            (f) => msgNameSet.has(f.type) && f.type !== result.messageName
          )
          if (refFields.length > 0) embedded.push(result.messageName)
        }

        const resolved = resolveInlineReferences(allResults, allMessageDefs)

        // 3. JSON 파일 저장
        jsonService.exportExcelToJson(settings.jsonDir, resolved)

        return { success: true, data: { exported: resolved.length, embedded } }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
  )
}
