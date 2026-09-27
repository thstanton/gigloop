import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const RELEASE_WORKFLOW_PATH = '.github/workflows/release.yml';

function latestByCreatedAt(records) {
  const timestamped = records.map((record, index) => ({
    record,
    index,
    createdAt: Date.parse(record.created_at ?? ''),
  }));

  if (!timestamped.every(({ createdAt }) => Number.isFinite(createdAt))) return records;

  return timestamped
    .sort((left, right) => {
      return right.createdAt - left.createdAt || left.index - right.index;
    })
    .map(({ record }) => record);
}

function latestStatus(statuses) {
  return latestByCreatedAt(statuses)[0];
}

function runIdFromStatus(status) {
  const url = status?.log_url || status?.target_url || '';
  return /\/actions\/runs\/(\d+)(?:\/|$)/.exec(url)?.[1] ?? null;
}

export async function resolveProdRef({
  deployments,
  getStatuses,
  getWorkflowPath,
  getFallbackRef,
}) {
  for (const deployment of latestByCreatedAt(
    deployments.filter((candidate) => candidate.environment === 'prod'),
  )) {
    const status = latestStatus(await getStatuses(deployment.id));
    if (status?.state !== 'success') continue;

    const runId = runIdFromStatus(status);
    if (runId === null) continue;

    const workflowPath = await getWorkflowPath(runId);
    if (workflowPath !== RELEASE_WORKFLOW_PATH) continue;

    return {
      ref: deployment.ref,
      source: 'deployment',
      deploymentId: deployment.id,
    };
  }

  return { ref: getFallbackRef(), source: 'fallback' };
}

export function formatResolution(resolution) {
  if (resolution.source === 'deployment') {
    return `Resolved prod rebuild ref ${resolution.ref} from successful release.yml deployment #${resolution.deploymentId}.`;
  }

  return `⚠️ Warning: no successful prod deployment from release.yml was found; falling back to tag ${resolution.ref}.`;
}

function ghList(endpoint) {
  const output = execFileSync('gh', ['api', '--paginate', '--slurp', endpoint], {
    encoding: 'utf8',
  });
  return JSON.parse(output).flat();
}

function ghJson(endpoint) {
  const output = execFileSync('gh', ['api', endpoint], { encoding: 'utf8' });
  return JSON.parse(output);
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error('GITHUB_REPOSITORY is required to resolve the prod deployment.');

  const resolution = await resolveProdRef({
    deployments: ghList(`repos/${repository}/deployments?environment=prod&per_page=100`),
    getStatuses: (id) => ghList(`repos/${repository}/deployments/${id}/statuses?per_page=100`),
    getWorkflowPath: (runId) => ghJson(`repos/${repository}/actions/runs/${runId}`).path,
    getFallbackRef: () =>
      execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], {
        encoding: 'utf8',
      }).trim(),
  });

  const message = formatResolution(resolution);
  console.error(message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Prod rebuild ref\n\n${message}\n\n`);
  }
  process.stdout.write(resolution.ref);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
