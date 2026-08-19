import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalDatabaseUrl, resolveDatabaseUrl, targetDescription } from './assert-local-database.mjs';

// #906 — the guard in front of `bun run db:reset`. `prisma migrate reset --force`
// drops every table in whatever DATABASE_URL resolves to, and `--force` removes
// Prisma's own confirmation prompt. Local dev used to point at a copy-on-write
// branch of the *production* Neon project, so a developer whose apps/api/.env
// still holds that string would drop it with one command. Only loopback passes.

const CONTAINER = 'postgresql://user:pass@localhost:5433/db';
const NEON_POOLED =
  'postgresql://u:p@ep-x-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true';
const NEON_DIRECT = 'postgresql://u:p@ep-x.eu-west-2.aws.neon.tech/neondb?sslmode=require';

test('a loopback container URL is local', () => {
  assert.equal(isLocalDatabaseUrl(CONTAINER), true);
});

test('loopback by address is local, on any port', () => {
  assert.equal(isLocalDatabaseUrl('postgresql://a:b@127.0.0.1:5432/db'), true);
  assert.equal(isLocalDatabaseUrl('postgresql://a:b@[::1]:5433/db'), true);
});

test('a Neon host is never local', () => {
  assert.equal(isLocalDatabaseUrl(NEON_POOLED), false);
  assert.equal(isLocalDatabaseUrl(NEON_DIRECT), false);
});

// The whole point of the guard is the prod project's `dev` branch, so name it.
test('the prod project dev branch is never local', () => {
  assert.equal(
    isLocalDatabaseUrl('postgresql://u:p@ep-cool-darkness-ab33iax9.eu-west-2.aws.neon.tech/neondb'),
    false,
  );
});

test('a host that merely contains "localhost" is not local', () => {
  assert.equal(isLocalDatabaseUrl('postgresql://a:b@localhost.example.com:5432/db'), false);
  assert.equal(isLocalDatabaseUrl('postgresql://a:b@notlocalhost/db'), false);
});

test('missing or unparseable values refuse rather than pass', () => {
  assert.equal(isLocalDatabaseUrl(undefined), false);
  assert.equal(isLocalDatabaseUrl(''), false);
  assert.equal(isLocalDatabaseUrl('   '), false);
  assert.equal(isLocalDatabaseUrl('not a url'), false);
});

// Precedence must mirror prisma.config.ts, which calls dotenv's config() — and
// dotenv never overrides a variable already present in the environment. A guard
// that read a different value from the command it guards would guard nothing.
test('an already-set environment variable wins over the .env file', () => {
  const envFile = `DATABASE_URL="${NEON_POOLED}"\n`;
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: CONTAINER }, envFile), CONTAINER);
});

test('the .env file is read when the variable is not already set', () => {
  assert.equal(resolveDatabaseUrl({}, `DATABASE_URL="${CONTAINER}"\n`), CONTAINER);
});

test('.env parsing tolerates single quotes, no quotes and trailing comments', () => {
  assert.equal(resolveDatabaseUrl({}, `DATABASE_URL='${CONTAINER}'`), CONTAINER);
  assert.equal(resolveDatabaseUrl({}, `DATABASE_URL=${CONTAINER}`), CONTAINER);
  assert.equal(resolveDatabaseUrl({}, `DATABASE_URL=${CONTAINER}   `), CONTAINER);
});

test('a commented-out assignment is not a value', () => {
  assert.equal(resolveDatabaseUrl({}, `# DATABASE_URL="${CONTAINER}"\n`), undefined);
});

test('DIRECT_URL is not mistaken for DATABASE_URL', () => {
  assert.equal(resolveDatabaseUrl({}, `DIRECT_URL="${CONTAINER}"\n`), undefined);
});

test('the first assignment wins, mirroring dotenv', () => {
  // dotenv keeps the FIRST occurrence; mirror that rather than inventing a rule.
  assert.equal(
    resolveDatabaseUrl({}, `DATABASE_URL="${CONTAINER}"\nDATABASE_URL="${NEON_POOLED}"\n`),
    CONTAINER,
  );
});

test('an empty assignment resolves to nothing, so the guard refuses', () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: '' }, `DATABASE_URL="${CONTAINER}"\n`), CONTAINER);
  assert.equal(resolveDatabaseUrl({}, 'DATABASE_URL=""\n'), undefined);
});

test('the failure message names the host without leaking the password', () => {
  const described = targetDescription(NEON_POOLED);
  assert.match(described, /ep-x-pooler\.eu-west-2\.aws\.neon\.tech/);
  assert.doesNotMatch(described, /:p@|password/);
});

test('an unparseable value is described without being echoed', () => {
  assert.equal(targetDescription('not a url'), 'an unparseable DATABASE_URL');
  assert.equal(targetDescription(undefined), 'no DATABASE_URL at all');
});
