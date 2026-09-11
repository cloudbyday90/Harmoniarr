/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProviderCollectionAccessEvidence } from '../../scripts/provider-collection-access-evidence.js';
import { collectProviderCollectionAccessEvidence, normalizeProviderAccessBaseUrl } from '../../scripts/provider-collection-access-session.js';
import { parseProviderCollectionAccessOptions, runProviderCollectionAccessValidation } from '../../scripts/validate-provider-collection-access.js';

const observedAt = '2026-09-11T09:00:00.000Z';
function fixtureCheck(overrides = {}) {
  return {
    schemaVersion: 1, provider: 'youtube', resourceType: 'playlist', authMode: 'api_key', quotaMode: 'unknown',
    outcome: 'verified', code: 'access_verified', pagesChecked: 2, entriesSeen: 70,
    hasMore: false, fullTraversal: true, multiPageObserved: true, snapshotCheck: 'not_applicable',
    checkedAt: observedAt, retryAfterSeconds: null, ...overrides,
  };
}

test('explicit live opt-in precedes credentials and argument errors never echo their values', async () => {
  await assert.rejects(runProviderCollectionAccessValidation({ args: ['--password-file', 'never-read-this'] }), /Explicit --live/);
  assert.throws(() => parseProviderCollectionAccessOptions(['--password', 'credential-marker']), (error) => !error.message.includes('credential-marker'));
  assert.deepEqual(parseProviderCollectionAccessOptions(['--help']), { help: true });
});

test('application origin validation permits HTTPS and loopback only, without credential-bearing authority or paths', () => {
  for (const url of ['http://127.0.0.1:3000', 'http://[::1]:3000', 'https://app.example.test']) assert.equal(normalizeProviderAccessBaseUrl(url), url);
  for (const url of ['http://example.test', 'https://user:secret@example.test', 'https://example.test/redirect', 'https://example.test?token=secret', 'file:///tmp/test']) {
    assert.throws(() => normalizeProviderAccessBaseUrl(url), /application origin/);
  }
});

test('evidence reconstructs fixed copy and strips malicious text and identities', () => {
  const artifact = buildProviderCollectionAccessEvidence(fixtureCheck({
    label: 'credential-marker', detail: 'credential-marker', nextAction: 'credential-marker',
    sourceUrl: 'credential-marker', rawResponse: { token: 'credential-marker' },
  }), { observedAt });
  assert.equal(artifact.acceptancePassed, true);
  assert.equal(JSON.stringify(artifact).includes('credential-marker'), false);
});

test('strict evidence separates one-page, partial, failed, and complete multi-page observations', () => {
  const checks = [
    fixtureCheck({ pagesChecked: 1, multiPageObserved: false }),
    fixtureCheck({ hasMore: true, fullTraversal: false }),
    fixtureCheck({ code: 'quota_exceeded', outcome: 'failed', fullTraversal: false }),
  ];
  for (const check of checks) assert.equal(buildProviderCollectionAccessEvidence(check, { observedAt }).acceptancePassed, false);
});

test('evidence rejects inconsistent, stale, over-budget, and unrecognized claims', () => {
  for (const overrides of [
    { pagesChecked: 0 }, { pagesChecked: 3 }, { entriesSeen: 201 }, { quotaMode: 'extended' },
    { authMode: 'client_credentials' }, { code: 'credential-marker' }, { hasMore: true },
    { multiPageObserved: false }, { snapshotCheck: 'verified' }, { retryAfterSeconds: -1 },
    { checkedAt: '2026-01-01T00:00:00.000Z' },
    { provider: 'spotify', authMode: 'oauth_user', snapshotCheck: 'not_checked' },
  ]) assert.throws(() => buildProviderCollectionAccessEvidence(fixtureCheck(overrides), { observedAt }), /invalid provider access evidence/);
});

function fixtureTransport({ check = fixtureCheck(), failCheck = false, logoutFails = false } = {}) {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, 'error');
    if (url.endsWith('/login')) return Response.json({ csrfToken: 'fixture-csrf' }, { headers: { 'set-cookie': 'session=fixture-cookie; HttpOnly' } });
    assert.equal(options.headers.get('cookie'), 'session=fixture-cookie');
    assert.equal(options.headers.get('x-csrf-token'), 'fixture-csrf');
    if (url.endsWith('/logout')) return Response.json({}, { status: logoutFails ? 500 : 200 });
    if (failCheck) throw new Error('credential-marker');
    return Response.json({ ok: true, check });
  };
  return { calls, fetchFn };
}

function collectOptions(fetchFn) {
  return { baseUrl: 'http://127.0.0.1:3000', username: 'fixture-admin', password: 'fixture-password',
    sourceUrl: 'https://www.youtube.com/playlist?list=fixture', fetchFn, getNow: () => new Date(observedAt) };
}

test('fixture session transports credentials only to login, bounds the check, and logs out', async () => {
  const { fetchFn, calls } = fixtureTransport();
  const { evidence: artifact, sessionClosed } = await collectProviderCollectionAccessEvidence(collectOptions(fetchFn));
  assert.equal(sessionClosed, true);
  assert.equal(artifact.acceptancePassed, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].options.body, JSON.stringify({ sourceUrl: collectOptions(fetchFn).sourceUrl }));
  assert.equal(JSON.stringify(artifact).includes('fixture'), false);
});

test('fixture session logs out after failed checks and suppresses raw transport causes', async () => {
  const { fetchFn, calls } = fixtureTransport({ failCheck: true });
  await assert.rejects(collectProviderCollectionAccessEvidence(collectOptions(fetchFn)), (error) => (
    error.message.includes('protected collection check failed') && !error.message.includes('credential-marker')
  ));
  assert.equal(calls.at(-1).url.endsWith('/logout'), true);
});

test('fixture command retains safe failed evidence but exits unsuccessfully after failed logout', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'harmoniarr-provider-check-'));
  try {
    const passwordPath = join(workspace, 'password.txt');
    const evidencePath = join(workspace, 'evidence.json');
    await writeFile(passwordPath, 'fixture-password', { mode: 0o600 });
    const { fetchFn } = fixtureTransport({ logoutFails: true, check: fixtureCheck({ outcome: 'failed', code: 'quota_exceeded', fullTraversal: false }) });
    const args = ['--live', '--base-url', 'http://127.0.0.1:3000', '--username', 'fixture-admin',
      '--password-file', passwordPath, '--source-url', 'https://www.youtube.com/playlist?list=fixture', '--evidence-path', evidencePath];
    await assert.rejects(runProviderCollectionAccessValidation({ args, fetchFn, getNow: () => new Date(observedAt) }), /Safe evidence saved; the diagnostic session could not be closed/);
    const artifact = JSON.parse(await readFile(evidencePath, 'utf8'));
    assert.equal(artifact.check.code, 'quota_exceeded');
    assert.equal(artifact.acceptancePassed, false);
    assert.equal(JSON.stringify(artifact).includes('fixture-password'), false);
    await assert.rejects(runProviderCollectionAccessValidation({ args, fetchFn, getNow: () => new Date(observedAt) }), /select a new writable output file/);
  } finally { await rm(workspace, { recursive: true, force: true }); }
});

test('fixture session rejects oversized login bodies before invoking the provider check', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return Response.json({ secret: 'x'.repeat(66_000) }); };
  await assert.rejects(collectProviderCollectionAccessEvidence(collectOptions(fetchFn)), /Administrator login failed/);
  assert.equal(calls, 1);
});
