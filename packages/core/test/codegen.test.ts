import { describe, expect, it } from 'vitest'
import {
  CODEGEN_DEFINITIONS,
  CODEGEN_LANGUAGES,
  configuredCodegenSelections,
  normalizeCodegenLanguage
} from '../src/codegen'
import { defaultAppSettings } from '../src/settings'

describe('code generation contract', () => {
  it('defines exactly the eight protoc languages and required plugins', () => {
    expect(CODEGEN_LANGUAGES).toEqual([
      'cpp',
      'csharp',
      'java',
      'python',
      'go',
      'rust',
      'ruby',
      'php'
    ])
    expect(CODEGEN_DEFINITIONS.map(({ id, outFlag }) => [id, outFlag])).toEqual([
      ['cpp', '--cpp_out'],
      ['csharp', '--csharp_out'],
      ['java', '--java_out'],
      ['python', '--python_out'],
      ['go', '--go_out'],
      ['rust', '--rust_out'],
      ['ruby', '--ruby_out'],
      ['php', '--php_out']
    ])
    expect(CODEGEN_DEFINITIONS.find(({ id }) => id === 'go')?.pluginExecutable).toBe(
      'protoc-gen-go'
    )
    const rust = CODEGEN_DEFINITIONS.find(({ id }) => id === 'rust')
    expect(rust?.pluginExecutable).toBeNull()
    expect(rust?.protocOptions).toEqual(['--rust_opt=experimental-codegen=enabled,kernel=upb'])
  })

  it('normalizes the legacy golang key and ignores unsupported outputs', () => {
    expect(normalizeCodegenLanguage('GOLANG')).toBe('go')
    expect(normalizeCodegenLanguage('typescript')).toBeNull()
    expect(
      configuredCodegenSelections({
        ...defaultAppSettings,
        codegenOutputs: [
          { language: 'golang', directory: 'D:\\go' },
          { language: 'cpp', directory: 'D:\\cpp' },
          { language: 'unknown', directory: 'D:\\unknown' }
        ]
      })
    ).toEqual([
      { language: 'cpp', outputDirectory: 'D:\\cpp' },
      { language: 'go', outputDirectory: 'D:\\go' }
    ])
  })
})
