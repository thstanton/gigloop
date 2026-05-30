import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/seed.ts', 'src/scripts/**'] },
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Warnings — real quality signals, fix opportunistically
      '@typescript-eslint/no-explicit-any': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      // Unused vars — allow _-prefixed names as intentional discards
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'sonarjs/no-unused-vars': 'off',
      // Off — noise without signal in this context
      'sonarjs/todo-tag': 'off',
      'sonarjs/redundant-type-aliases': 'off',
    },
  },
);
