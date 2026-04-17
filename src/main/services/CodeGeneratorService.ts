import { execFileSync } from 'child_process'
import * as fs from 'fs'

// protoc 네이티브 출력 플래그 맵 — 새 언어 추가 시 이 맵에 항목 추가
export const PROTOC_OUT_FLAGS: Record<string, string> = {
  cpp: '--cpp_out',
  csharp: '--csharp_out',
  java: '--java_out',
  python: '--python_out',
  golang: '--go_out',
  rust: '--rust_out',
  ruby: '--ruby_out',
  php: '--php_out',
}

export const SUPPORTED_LANGUAGES = Object.keys(PROTOC_OUT_FLAGS)

export class ProtocService {
  /**
   * protoc 를 실행하여 지정 언어의 코드를 생성합니다.
   * @param protocPath  protoc 실행 파일 경로
   * @param protoDir    .proto 파일들이 위치한 디렉토리
   * @param language    생성 언어 키 (PROTOC_OUT_FLAGS 의 키)
   * @param outputDir   출력 디렉토리
   */
  generate(protocPath: string, protoDir: string, language: string, outputDir: string): void {
    if (!protocPath) throw new Error('protoc 경로가 설정되지 않았습니다.')
    if (!fs.existsSync(protocPath)) throw new Error(`protoc 를 찾을 수 없습니다: ${protocPath}`)

    const outFlag = PROTOC_OUT_FLAGS[language]
    if (!outFlag) throw new Error(`지원하지 않는 언어: ${language}`)

    const protoFiles = fs.readdirSync(protoDir).filter((f) => f.endsWith('.proto'))
    if (protoFiles.length === 0) throw new Error('proto 파일이 없습니다.')

    fs.mkdirSync(outputDir, { recursive: true })

    execFileSync(protocPath, [
      `--proto_path=${protoDir}`,
      `${outFlag}=${outputDir}`,
      ...protoFiles
    ], { cwd: protoDir })
  }
}

export const protocService = new ProtocService()
