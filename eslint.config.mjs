import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,

      '@typescript-eslint/explicit-function-return-type': 'off',

      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn'
    }
  },
  {
    files: [
      'src/renderer/src/components/ui/**/*.{ts,tsx}',
      'src/renderer/src/components/layout/page-header.tsx',
      'src/renderer/src/components/theme/theme-provider.tsx',
      'src/renderer/src/features/chat/ui/tool/renderers/**/*.{ts,tsx}',
      'src/renderer/src/features/settings/ui/shared/settings-primitives.tsx'
    ],
    rules: {
      'react-refresh/only-export-components': 'off'
    }
  },
  eslintConfigPrettier
)
