#!/usr/bin/env node
// Guard in front of `bun run db:reset` (#906).
//
// `prisma migrate reset --force` drops every table in whatever DATABASE_URL
// resolves to, and `--force` deliberately removes Prisma's own confirmation so
// the documented one-liner stays a one-liner. That is only ever safe against the
// Docker container. Local development used to run on a copy-on-write branch of
// the *production* Neon project, so a developer whose `apps/api/.env` still
// holds that string — the branch outlives this commit, its deletion is the
// issue's final human-only step — would drop it with one command.
//
// So: resolve DATABASE_URL exactly the way the command being guarded resolves
// it, and refuse anything that is not loopback. Refusing is the default; an
// absent or unparseable value fails closed.
//
// Why DATABASE_URL alone is enough, when `schema.prisma` also declares
// `directUrl = env("DIRECT_URL")` and Prisma's migrate commands normally
// prefer it: `prisma.config.ts` sets `datasource.url` explicitly, which
// replaces the schema's datasource block for the CLI, `directUrl` included.
// Verified rather than assumed — a reset run with DATABASE_URL on the
// container and DIRECT_URL pointing at an unreachable host still dropped a
// marker table in the container and reseeded it, never touching DIRECT_URL.
// If `prisma.config.ts` ever stops setting `datasource.url`, this guard must
// check both variables.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(REPO_ROOT, 'apps', 'api', '.env');

// Hostnames that can only mean this machine. Matched exactly — `localhost.example.com`
// is somebody else's server.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function parse(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

export function isLocalDatabaseUrl(value) {
  const url = parse(value);
  if (url === null) return false;
  // WHATWG URL keeps the brackets on an IPv6 hostname — `[::1]`, not `::1`.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  return LOOPBACK_HOSTS.has(host);
}

/**
 * Resolve DATABASE_URL the way `prisma.config.ts` does: dotenv's `config()`
 * never overwrites a variable already present in the environment, and keeps the
 * first assignment it sees in the file.
 */
export function resolveDatabaseUrl(env, envFileContents) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  for (const line of (envFileContents ?? '').split('\n')) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const raw = match[1].trim();
    const unquoted = /^(["'])(.*)\1$/.exec(raw);
    const value = unquoted ? unquoted[2] : raw;
    return value === '' ? undefined : value;
  }
  return undefined;
}

/** Names the target for an error message — host only, never the password. */
export function targetDescription(value) {
  if (typeof value !== 'string' || value.trim() === '') return 'no DATABASE_URL at all';
  const url = parse(value);
  return url === null ? 'an unparseable DATABASE_URL' : url.host;
}

function readEnvFile() {
  try {
    return readFileSync(ENV_FILE, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  const target = resolveDatabaseUrl(process.env, readEnvFile());
  if (isLocalDatabaseUrl(target)) return;

  console.error(
    [
      '',
      '  Refusing to reset the database.',
      '',
      `  DATABASE_URL points at ${targetDescription(target)}, which is not this machine.`,
      '  `prisma migrate reset` drops every table in it, and this script exists',
      '  because that address was once a branch of the production Neon project.',
      '',
      '  Local development runs Docker (#906):',
      '',
      '    bun run db:up',
      '',
      '  and apps/api/.env should carry the container URL from apps/api/.env.example.',
      '  To reset a deployed database — you almost certainly do not want to — run',
      '  Prisma directly and answer its prompt.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

// Only guard when run as a command; importing for tests must have no effect.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
