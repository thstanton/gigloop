import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Cognitive complexity — warn at 10; blocked from error until cleanup of 5 files (see ADR-0026)
      'sonarjs/cognitive-complexity': ['warn', 10],
      'react-hooks/exhaustive-deps': 'warn',
      // Errors — enforced; all existing violations resolved
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/no-nested-template-literals': 'error',
      // Off — noise without signal in React context
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/deprecation': 'off',
      'sonarjs/function-return-type': 'off',
      'sonarjs/no-unenclosed-multiline-block': 'off',
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/prefer-read-only-props': 'off',
      'sonarjs/use-type-alias': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/todo-tag': 'off',
    },
  },
);
