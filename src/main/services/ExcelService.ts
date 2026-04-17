import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import type { ProtoMessage, ExcelRowData, ExcelReadResult } from '../../shared/types'

export class ExcelService {
  /**
   * proto Message 목록을 sourceFile 기준으로 그룹화하여
   * {Name}Table.xlsx 파일을 생성합니다. (proto 파일당 1개)
   * 시트 1개 = Message 1개, 필드명이 헤더 행입니다.
   * 생성된 파일명 목록을 반환합니다.
   */
  async generateExcel(outputDir: string, messages: ProtoMessage[]): Promise<string[]> {
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
