import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'playwright/.auth/**', 'eslint.config.mjs'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
