import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const toEslintGlobals = (globalsMap) =>
  Object.fromEntries(
    Object.entries(globalsMap).map(([name, writable]) => [name, writable ? 'writable' : 'readonly']),
  )

export default defineConfig([
  globalIgnores(['dist', 'node_modules', '.vite', 'coverage', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // This rule is too aggressive for our usage (e.g., opening chat when preset changes).
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Node-only files (Playwright config + tests) need Node globals (e.g. `process`).
  {
    files: [
      'playwright.config.js',
      'tests/**/*.{js,jsx}',
      '**/*.spec.{js,jsx}',
      '**/*.test.{js,jsx}',
    ],
    languageOptions: {
      globals: toEslintGlobals(globals.node),
    },
  },
])
