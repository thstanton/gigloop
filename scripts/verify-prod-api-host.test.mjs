import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkApiHost, PROD_API_HOST } from './verify-prod-api-host.mjs';

const bundleWith = (host) => `some code fetch("https://${host}/api/bookings") more code`;

test('good bundle — production host present — passes', () => {
  assert.deepEqual(checkApiHost(bundleWith(PROD_API_HOST)), { ok: true });
});

test('good bundle — host match is case-insensitive', () => {
  assert.deepEqual(checkApiHost(bundleWith(PROD_API_HOST.toUpperCase())), { ok: true });
});

test('empty-host bundle — no railway host at all — fails', () => {
  const result = checkApiHost('fetch("/api/bookings")');
  assert.equal(result.ok, false);
  assert.match(result.reason, /no API host at all/);
  assert.match(result.reason, new RegExp(PROD_API_HOST.replace(/\./g, '\\.')));
});

test('wrong-host bundle — preprod host shipped to prod by mistake — fails and names it', () => {
  const wrongHost = 'valiant-respect-staging.up.railway.app';
  const result = checkApiHost(bundleWith(wrongHost));
  assert.equal(result.ok, false);
  assert.match(result.reason, new RegExp(wrongHost.replace(/\./g, '\\.')));
});

test('wrong-host bundle — unrelated railway host — fails and names it', () => {
  const wrongHost = 'some-other-app.up.railway.app';
  const result = checkApiHost(bundleWith(wrongHost));
  assert.equal(result.ok, false);
  assert.match(result.reason, new RegExp(wrongHost.replace(/\./g, '\\.')));
});
