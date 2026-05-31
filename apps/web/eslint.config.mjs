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
      // Warnings — real quality signals, fix opportunistically
      '@typescript-eslint/no-explicit-any': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 10],
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'sonarjs/deprecation': 'warn',
      'sonarjs/function-return-type': 'warn',
      'sonarjs/no-unenclosed-multiline-block': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'sonarjs/no-unused-vars': 'off',
      // Off — stylistic preferences, not quality issues
      'sonarjs/prefer-read-only-props': 'off',
      'sonarjs/use-type-alias': 'off',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/no-unused-vars': 'off',
    },
  },
);
