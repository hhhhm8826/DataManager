import js from '@eslint/js'

export default [
  {
    ignores: ['node_modules', 'dist']
  },
  js.configs.recommended,
  {
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: {
      globals: {
        $: 'readonly',
        $$: 'readonly',
        browser: 'readonly',
        describe: 'readonly',
        it: 'readonly'
      }
    }
  }
]
