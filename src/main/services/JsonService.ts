import * as fs from 'fs'
import * as path from 'path'
import type { ExcelReadResult } from '../../shared/types'

export class JsonService {
  /**
   * JSON 파일을 읽어 파싱된 객체를 반환합니다.
   */
  readJson<T = unknown>(filePath: string): T {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  }

  /**
   * 객체를 JSON 파일로 저장합니다.
   */
  writeJson(filePath: string, data: unknown): void {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  /**
   * Excel 읽기 결과를 JSON 파일들로 내보냅니다.
   * 각 메시지마다 {MessageName}.json 파일을 생성합니다.
   */
  exportExcelToJson(outputDir: string, results: ExcelReadResult[]): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    for (const result of results) {
      const filePath = path.join(outputDir, `${result.messageName}.json`)
      this.writeJson(filePath, result.rows)
    }
  }

  /**
   * 지정 디렉토리의 모든 JSON 파일 경로를 반환합니다.
   */
  listJsonFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return []
    return fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(dirPath, f))
  }
}

export const jsonService = new JsonService()
