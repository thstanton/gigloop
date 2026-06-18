import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

const alias = { '@': path.resolve(__dirname, './src') };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'happy-dom',
          setupFiles: ['./src/test/setup.ts', './src/test/google-maps-stub.ts'],
          include: ['src/**/*.spec.{ts,tsx}'],
        },
      },
      {
        plugins: [storybookTest({ configDir: './.storybook', tags: { include: [], exclude: [], skip: [] } })],
        resolve: {
          alias: {
            ...alias,
            // Bypass the exports map to use setupServer instead of setupWorker in vitest
            'msw-storybook-addon': path.resolve('../../node_modules/msw-storybook-addon/dist/index.node.cjs'),
          },
        },
        test: {
          name: 'storybook',
          environment: 'happy-dom',
          setupFiles: ['@storybook/addon-vitest/internal/setup-file', './src/test/google-maps-stub.ts'],
        },
      },
    ],
  },
});
