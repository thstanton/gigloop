import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatResolution, resolveProdRef } from './set-flag-ref.mjs';

test('uses the newest successful prod deployment, skipping a newer failed deployment', async () => {
  const statusRequests = [];
  const resolution = await resolveProdRef({
    deployments: [
      { id: 29, environment: 'prod', ref: 'v0.9.0', created_at: '2026-09-09T10:00:00Z' },
      { id: 30, environment: 'prod', ref: 'v0.9.1', created_at: '2026-09-10T10:00:00Z' },
    ],
    getStatuses: async (id) => {
      statusRequests.push(id);
      return id === 30
        ? [{ state: 'failure' }]
        : [{ state: 'success', log_url: 'https://github.com/org/repo/actions/runs/123/job/456' }];
    },
    getWorkflowPath: async () => '.github/workflows/release.yml',
    getFallbackRef: () => 'v0.8.9',
  });

  assert.deepEqual(resolution, {
    ref: 'v0.9.0',
    source: 'deployment',
    deploymentId: 29,
  });
  assert.deepEqual(statusRequests, [30, 29]);
  assert.match(formatResolution(resolution), /successful release\.yml deployment #29/);
});

test('skips a successful set-flag deployment and continues to the successful release', async () => {
  const resolution = await resolveProdRef({
    deployments: [
      { id: 30, environment: 'prod', ref: 'main', created_at: '2026-09-10T10:00:00Z' },
      { id: 29, environment: 'prod', ref: 'v0.9.0', created_at: '2026-09-09T10:00:00Z' },
    ],
    getStatuses: async (id) =>
      [{
        state: 'success',
        log_url: `https://github.com/org/repo/actions/runs/${id}/job/456`,
      }],
    getWorkflowPath: async (runId) =>
      runId === '30' ? '.github/workflows/set-flag.yml' : '.github/workflows/release.yml',
    getFallbackRef: () => 'v0.8.9',
  });

  assert.deepEqual(resolution, {
    ref: 'v0.9.0',
    source: 'deployment',
    deploymentId: 29,
  });
});

test('falls back to the latest tag with a warning when no deployment succeeded', async () => {
  const resolution = await resolveProdRef({
    deployments: [
      { id: 30, environment: 'prod', ref: 'v0.9.1' },
      { id: 29, environment: 'prod', ref: 'v0.9.0' },
    ],
    getStatuses: async (id) => [{ state: id === 30 ? 'failure' : 'in_progress' }],
    getWorkflowPath: async () => '.github/workflows/release.yml',
    getFallbackRef: () => 'v0.8.9',
  });

  assert.deepEqual(resolution, { ref: 'v0.8.9', source: 'fallback' });
  assert.match(formatResolution(resolution), /Warning: no successful prod deployment from release\.yml/);
  assert.match(formatResolution(resolution), /falling back to tag v0\.8\.9/);
});

test('ignores non-prod deployments even if their status succeeded', async () => {
  const resolution = await resolveProdRef({
    deployments: [
      { id: 30, environment: 'preprod', ref: 'main' },
    ],
    getStatuses: async () => [{ state: 'success' }],
    getWorkflowPath: async () => '.github/workflows/release.yml',
    getFallbackRef: () => 'v0.8.9',
  });

  assert.deepEqual(resolution, { ref: 'v0.8.9', source: 'fallback' });
});

test('uses only the latest status for each deployment', async () => {
  const resolution = await resolveProdRef({
    deployments: [{ id: 30, environment: 'prod', ref: 'v0.9.1' }],
    getStatuses: async () => [
      { state: 'failure', created_at: '2026-09-10T10:01:00Z' },
      { state: 'success', created_at: '2026-09-10T10:00:00Z' },
    ],
    getWorkflowPath: async () => '.github/workflows/release.yml',
    getFallbackRef: () => 'v0.8.9',
  });

  assert.deepEqual(resolution, { ref: 'v0.8.9', source: 'fallback' });
});
