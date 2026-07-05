import path from 'path';
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { STORAGE_STATE } from './support/paths';

// Load e2e-local config (DB branch, Clerk test-user creds) when present. CI
// supplies these as job env instead, so a missing file is fine.
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Deliberately off the dev ports (API 3000 / web 5173) so a running `bun run
// dev` can't be silently reused by reuseExistingServer and serve the wrong DB.
const API_PORT = 3100;
const WEB_PORT = 4173;
const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

// Configurable base URL (ADR-0048 §2/§8): defaults to the locally-served web
// build, but pointing E2E_BASE_URL at the #436 deployed smoke-test env later
// runs the same specs with no changes (and skips booting local servers).
const baseURL = process.env.E2E_BASE_URL ?? WEB_URL;
const bootLocalStack = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './specs',
  // Serial against one shared user + one ephemeral branch (ADR-0048 §5).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // No browser here — just the token mint + baseline seed (advisor: keep the
  // navigation-based sign-in in the setup project, which runs after webServer).
  globalSetup: require.resolve('./support/global-init'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'mobile-chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        // Bundled chromium (no system-Chrome channel) at the 375px primary
        // target (ADR-0048 §10) — the bottom-tab-bar / mobile-tabs DOM.
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        storageState: STORAGE_STATE,
      },
    },
  ],
  webServer: bootLocalStack
    ? [
        {
          command: 'node dist/main',
          cwd: path.resolve(__dirname, '../apps/api'),
          url: `${API_URL}/api/health`,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          env: {
            E2E_TEST_MODE: 'true',
            PORT: String(API_PORT),
            CORS_ORIGIN: WEB_URL,
            APP_BASE_URL: WEB_URL,
            DATABASE_URL: process.env.DATABASE_URL ?? '',
            DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
            CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? '',
          },
        },
        {
          command: `npm --prefix ${path.resolve(__dirname, '../apps/web')} run preview -- --port ${WEB_PORT} --strictPort`,
          url: WEB_URL,
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
      ]
    : undefined,
});
