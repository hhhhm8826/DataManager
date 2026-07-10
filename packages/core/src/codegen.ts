import type { AppSettings } from './settings'

export const CODEGEN_LANGUAGES = [
  'cpp',
  'csharp',
  'java',
  'python',
  'go',
  'rust',
  'ruby',
  'php'
] as const

export type CodegenLanguage = (typeof CODEGEN_LANGUAGES)[number]

export interface CodegenLanguageDefinition {
  id: CodegenLanguage
  label: string
  outFlag: string
  protocOptions: readonly string[]
  pluginExecutable: string | null
}

export interface CodegenSelection {
  language: CodegenLanguage
  outputDirectory: string
}

export const CODEGEN_DEFINITIONS: readonly CodegenLanguageDefinition[] = [
  { id: 'cpp', label: 'C++', outFlag: '--cpp_out', protocOptions: [], pluginExecutable: null },
  { id: 'csharp', label: 'C#', outFlag: '--csharp_out', protocOptions: [], pluginExecutable: null },
  { id: 'java', label: 'Java', outFlag: '--java_out', protocOptions: [], pluginExecutable: null },
  {
    id: 'python',
    label: 'Python',
    outFlag: '--python_out',
    protocOptions: [],
    pluginExecutable: null
  },
  {
    id: 'go',
    label: 'Go',
    outFlag: '--go_out',
    protocOptions: [],
    pluginExecutable: 'protoc-gen-go'
  },
  {
    id: 'rust',
    label: 'Rust',
    outFlag: '--rust_out',
    protocOptions: ['--rust_opt=experimental-codegen=enabled,kernel=upb'],
    pluginExecutable: null
  },
  { id: 'ruby', label: 'Ruby', outFlag: '--ruby_out', protocOptions: [], pluginExecutable: null },
  { id: 'php', label: 'PHP', outFlag: '--php_out', protocOptions: [], pluginExecutable: null }
]

export function normalizeCodegenLanguage(value: string): CodegenLanguage | null {
  const normalized = value.trim().toLocaleLowerCase()
  const alias = normalized === 'golang' ? 'go' : normalized
  return CODEGEN_LANGUAGES.find((language) => language === alias) ?? null
}

export function configuredCodegenSelections(settings: AppSettings): CodegenSelection[] {
  const selections = new Map<CodegenLanguage, string>()
  for (const output of settings.codegenOutputs) {
    const language = normalizeCodegenLanguage(output.language)
    if (language && output.directory.trim()) selections.set(language, output.directory)
  }
  return CODEGEN_LANGUAGES.filter((language) => selections.has(language)).map((language) => ({
    language,
    outputDirectory: selections.get(language)!
  }))
}

export function codegenDefinition(language: CodegenLanguage): CodegenLanguageDefinition {
  return CODEGEN_DEFINITIONS.find((definition) => definition.id === language)!
}
