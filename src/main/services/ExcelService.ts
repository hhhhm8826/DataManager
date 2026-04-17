import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import type { ProtoMessage, ProtoEnum, ExcelRowData, ExcelReadResult } from '../../shared/types'

const DROPDOWN_SHEET = '_DropDown'

/** 1-based 열 인덱스 → Excel 열 문자 (1→A, 27→AA …) */
function colLetter(colIndex: number): string {
  let result = ''
  let n = colIndex
  while (n > 0) {
    n--
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26)
  }
  return result
}

export class ExcelService {
  /**
   * proto Message 목록을 sourceFile 기준으로 그룹화하여
   * {Name}Table.xlsx 파일을 생성합니다. (proto 파일당 1개)
   * 시트 1개 = Message 1개, 필드명이 헤더 행입니다.
   * allEnums 가 있으면 Enum 타입 필드에 드롭다운 데이터 검증을 추가합니다.
   * 생성된 파일명 목록을 반환합니다.
   */
  async generateExcel(
    outputDir: string,
    messages: ProtoMessage[],
    allEnums: ProtoEnum[] = []
  ): Promise<string[]> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // sourceFile 기준으로 그룹화
    const groups = new Map<string, ProtoMessage[]>()
    for (const msg of messages) {
      const key = msg.sourceFile
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(msg)
    }

    const createdFiles: string[] = []

    for (const [sourceFile, msgs] of groups) {
      const excelFileName = sourceFile.replace(/\.proto$/, '') + '.xlsx'
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'DataManager'

      // ── _DropDown 시트 구성 ────────────────────────────────────
      // 이 워크북의 메시지에서 사용되는 Enum 타입을 수집
      const enumNamesUsed = new Set<string>()
      for (const msg of msgs) {
        for (const field of msg.fields) {
          if (allEnums.some((e) => e.name === field.type)) {
            enumNamesUsed.add(field.type)
          }
        }
      }

      // enum → _DropDown 시트의 열 인덱스(1-based) 매핑 (시트는 메시지 시트 이후에 추가)
      const enumColMap = new Map<string, { col: number; rowCount: number }>()

      if (enumNamesUsed.size > 0) {
        let colIdx = 1
        for (const enumName of enumNamesUsed) {
          const enumDef = allEnums.find((e) => e.name === enumName)
          if (!enumDef) continue
          const validValues = enumDef.values.filter((v) => !v.name.endsWith('_MAX'))
          enumColMap.set(enumName, { col: colIdx, rowCount: validValues.length })
          colIdx++
        }
      }

      // ── 메시지 시트 ────────────────────────────────────────────
      // 같은 워크북 내 메시지 이름 → PK 열 문자 맵 (Message 참조 드롭다운용)
      const msgNamesInWorkbook = new Set(msgs.map((m) => m.name))

      // msg.name → PK 열 문자 맵 (참조 드롭다운용)
      const MAX_DROPDOWN_ROWS = 20
      const msgPkColMap = new Map<string, string>()
      for (const m of msgs) {
        const pkField = m.pkFields[0]
        if (!pkField) continue
        const pkIdx = m.fields.findIndex((f) => f.name === pkField)
        if (pkIdx >= 0) msgPkColMap.set(m.name, colLetter(pkIdx + 1))
      }

      for (const msg of msgs) {
        const sheet = workbook.addWorksheet(msg.name)

        // 헤더 행
        const headers = msg.fields.map((f) => f.name)
        sheet.addRow(headers)

        // 헤더 스타일
        const headerRow = sheet.getRow(1)
        headerRow.eachCell((cell, colNumber) => {
          const field = msg.fields[colNumber - 1]
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: field?.isPk ? 'FFFFCC00' : 'FF4472C4' }
          }
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          cell.alignment = { horizontal: 'center' }
        })

        // 열 너비 자동
        sheet.columns = msg.fields.map((f) => ({
          key: f.name,
          width: Math.max(f.name.length + 4, 12)
        }))

        // ── Enum 필드에 드롭다운 데이터 검증 ──
        msg.fields.forEach((field, idx) => {
          const enumInfo = enumColMap.get(field.type)
          if (!enumInfo) return

          const dataColLetter = colLetter(idx + 1)           // 데이터 시트의 열 문자
          const dropColLetter = colLetter(enumInfo.col)       // _DropDown 시트의 열 문자
          const lastRow = enumInfo.rowCount + 1               // 헤더(1행) + 값 행

          // ExcelJS 타입 정의에 dataValidations 가 없는 버전 대응
          const dv = (sheet as unknown as { dataValidations: { add: (addr: string, rule: object) => void } }).dataValidations
          dv.add(`${dataColLetter}2:${dataColLetter}10000`, {
            type: 'list',
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'warning',
            errorTitle: '잘못된 값',
            error: `정의된 Enum 값을 선택하세요. (${field.type})`,
            formulae: [`'${DROPDOWN_SHEET}'!$${dropColLetter}$2:$${dropColLetter}$${lastRow}`]
          })
        })

        // ── 같은 워크북 내 Message 참조 필드에 드롭다운 데이터 검증 ──
        // OFFSET+COUNTA 수식으로 실제 PK 값만 동적 포함 (빈 행 제외)
        msg.fields.forEach((field, idx) => {
          if (!msgNamesInWorkbook.has(field.type) || field.type === msg.name) return
          const pkColL = msgPkColMap.get(field.type)
          if (!pkColL) return

          const dataColLetter = colLetter(idx + 1)
          const offsetFormula =
            `OFFSET('${field.type}'!$${pkColL}$2,0,0,` +
            `MAX(1,COUNTA('${field.type}'!$${pkColL}$2:$${pkColL}$${MAX_DROPDOWN_ROWS + 1})),1)`

          const dv = (sheet as unknown as { dataValidations: { add: (addr: string, rule: object) => void } }).dataValidations
          dv.add(`${dataColLetter}2:${dataColLetter}10000`, {
            type: 'list',
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'warning',
            errorTitle: '잘못된 참조',
            error: `${field.type} 시트의 값을 선택하세요.`,
            formulae: [offsetFormula]
          })
        })
      }

      // ── _DropDown 시트를 맨 마지막에 추가 ────────────────────
      if (enumColMap.size > 0) {
        const dropSheet = workbook.addWorksheet(DROPDOWN_SHEET)

        let colIdx = 1
        for (const enumName of enumNamesUsed) {
          const enumDef = allEnums.find((e) => e.name === enumName)
          if (!enumDef) continue

          const validValues = enumDef.values.filter((v) => !v.name.endsWith('_MAX'))

          // 헤더 (1행)
          dropSheet.getCell(1, colIdx).value = enumName
          dropSheet.getCell(1, colIdx).font = { bold: true }

          // 값 (2행~)
          validValues.forEach((v, i) => {
            dropSheet.getCell(i + 2, colIdx).value = v.name
          })

          // 열 너비
          dropSheet.getColumn(colIdx).width = Math.max(enumName.length + 2, 20)
          colIdx++
        }
      }

      const filePath = path.join(outputDir, excelFileName)
      await workbook.xlsx.writeFile(filePath)
      createdFiles.push(excelFileName)
    }

    return createdFiles
  }

  /**
   * Excel 파일을 읽어 각 시트를 메시지 이름-행 데이터 배열로 반환합니다.
   * proto에 정의된 메시지 이름과 일치하는 시트만 읽습니다.
   */
  async readExcel(filePath: string, allowedMessages: string[]): Promise<ExcelReadResult[]> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)

    const results: ExcelReadResult[] = []

    workbook.eachSheet((sheet) => {
      if (!allowedMessages.includes(sheet.name)) return

      const rows: ExcelRowData[] = []
      let headers: string[] = []

      sheet.eachRow((row, rowNumber) => {
        const values = (row.values as ExcelJS.CellValue[]).slice(1) // index 0은 undefined

        if (rowNumber === 1) {
          headers = values.map((v) => String(v ?? ''))
          return
        }

        const obj: ExcelRowData = {}
        headers.forEach((h, i) => {
          const cell = values[i]
          if (cell === null || cell === undefined) {
            obj[h] = null
          } else if (typeof cell === 'object' && 'text' in cell) {
            obj[h] = (cell as ExcelJS.RichText).text
          } else {
            obj[h] = cell as string | number | boolean
          }
        })
        rows.push(obj)
      })

      results.push({ messageName: sheet.name, rows })
    })

    return results
  }
}

export const excelService = new ExcelService()
