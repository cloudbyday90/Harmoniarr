/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { hashPlexBrowserBinding, parsePlexPendingState, capturePlexCallbackProof, normalizePlexRedirect, plexCallbackSecretName } from '../../src/server/integrations/plex/plex-callback-policy.js';
import { createPlexCallbackStateService } from '../../src/server/integrations/plex/plex-callback-state-service.js';
import { consumePlexCallbackState, assertPlexCallbackNotExpired } from '../../src/server/integrations/plex/plex-callback-state-store.js';
import { createPlexBrowserBinding, readPlexBrowserBinding, setPlexBrowserBindingCookie } from '../../src/server/plex-browser-binding.js';

const binding = Buffer.alloc(32, 1).toString('base64url'), state = randomUUID();
const expiresAt = '2050-01-01T00:10:00.000Z', now = new Date('2050-01-01T00:00:00Z');
const payload = delta => ({ version: 1, clientIdentifier: 'client', pinId: '123', redirectTo: '/app/activity', expiresAt, browserBindingHash: hashPlexBrowserBinding(binding), ...delta });
const record = () => ({ id: randomUUID(), encrypted_value: Buffer.from('ciphertext'), state_revision: '2050-01-01 00:00:00.000100+00', observed_at: now });
function fixture(options = {}) {
  const row = options.record ?? record(), queries = [], writes = [], audits = [];
  const client = { async query(sql, values) { queries.push({ sql, values }); return { rows: sql.includes('expires_at') ? [{ expires_at: new Date(expiresAt) }] : options.missing ? [] : [row] }; } };
  const owner = work => ({ result: Promise.resolve().then(() => work(client, () => {})) });
  const service = createPlexCallbackStateService({ startReadFn: owner, startTransactionFn: owner,
    encryptedSecretService: { decryptSecretRecord: () => options.clientIdentifier ? 'client' : JSON.stringify(payload(options.payload)),
      setSecretValue: async value => { assert.equal(value.queryable, client); writes.push(value); } },
    recordAuditEventFn: async (event, queryable) => { assert.equal(queryable, client); audits.push(event); if (options.auditError) throw options.auditError; } });
  return { service, row, queries, writes, audits };
}

test('pending state requires a version, canonical finite expiry and exact browser proof', () => {
  assert.equal(parsePlexPendingState(JSON.stringify(payload()), binding, now).pinId, '123');
  for (const delta of [{ version: undefined }, { version: 2 }, { expiresAt: 'bad' }, { expiresAt: '2000-01-01T00:00:00.000Z' },
    { expiresAt: '2050-01-01' }, { pinId: '' }, { clientIdentifier: 'x'.repeat(257) }, { browserBindingHash: '0'.repeat(64) }]) {
    assert.throws(() => parsePlexPendingState(JSON.stringify(payload(delta)), binding, now), { code: 'plex_sign_in_state_invalid' });
  }
  for (const text of ['not-json', null, 'x'.repeat(4097)]) assert.throws(() => parsePlexPendingState(text, binding, now), { code: 'plex_sign_in_state_invalid' });
  assert.throws(() => parsePlexPendingState(JSON.stringify(payload()), binding, null), { code: 'plex_sign_in_state_invalid' });
});

test('bounded read decrypts one exact record and captures its own cipher bytes and revision', async () => {
  const f = fixture(), result = await f.service.read({ state, browserBinding: binding });
  assert.equal(result.proof.name, plexCallbackSecretName(state)); assert.equal(result.proof.revision, f.row.state_revision);
  f.row.encrypted_value.fill(0); assert.equal(result.proof.encryptedValue.toString(), 'ciphertext');
  assert.match(f.queries[0].sql, /octet_length\(encrypted_value\)<=\$3/u); assert.equal(f.writes.length, 0);
});

test('missing or mismatched state is refused without mutation and malformed binding precedes SQL', async () => {
  for (const options of [{ missing: true }, { payload: { browserBindingHash: '0'.repeat(64) } }]) {
    const f = fixture(options); await assert.rejects(f.service.read({ state, browserBinding: binding }), { code: 'plex_sign_in_state_invalid' }); assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  for (const value of ['', 'bad', null, 'x'.repeat(10000)]) await assert.rejects(f.service.read({ state, browserBinding: value }), { code: 'plex_sign_in_state_invalid' });
  assert.equal(f.queries.length, 0);
});

test('state creation uses database expiry and shares its write client with the required privacy-safe start audit', async () => {
  const f = fixture(), result = await f.service.create({ state, browserBinding: binding, clientIdentifier: 'client', pinId: '123', redirectTo: '/app' });
  assert.equal(result, expiresAt); assert.equal(f.audits[0].required, true);
  const saved = JSON.parse(f.writes[0].plaintextValue); assert.equal(saved.version, 1); assert.equal(saved.expiresAt, expiresAt);
  assert.equal(saved.browserBindingHash, hashPlexBrowserBinding(binding));
  assert.ok(!JSON.stringify(f.audits).includes(state)); assert.ok(!JSON.stringify(f.audits).includes(binding));
  const failed = fixture({ auditError: new Error('required audit') });
  await assert.rejects(failed.service.create({ state, browserBinding: binding, clientIdentifier: 'client', pinId: '123', redirectTo: '/app' }));
});

test('client identifier initialization serializes before reading and reuses an existing bounded secret', async () => {
  const f = fixture({ clientIdentifier: true }); assert.equal(await f.service.resolveClientIdentifier(), 'client');
  assert.match(f.queries[0].sql, /pg_advisory_xact_lock/u); assert.equal(f.writes.length, 0);
  const fresh = fixture({ missing: true }); assert.match(await fresh.service.resolveClientIdentifier(), /^[a-f0-9-]{36}$/u); assert.equal(fresh.writes.length, 1);
});

test('state consumption fences record identity, cipher, full revision and expiry and rejects uncertain cardinality', async () => {
  const row = record(), proof = capturePlexCallbackProof({ id: row.id, name: plexCallbackSecretName(state), encryptedValue: row.encrypted_value, revision: row.state_revision, expiresAt });
  const calls = [];
  for (const rowCount of [0, 1]) assert.equal(await consumePlexCallbackState({ query: async (sql, values) => { calls.push({ sql, values }); return { rowCount }; } }, proof), rowCount === 1);
  assert.deepEqual(calls[0].values, [proof.id, 'integration_oauth', proof.name, proof.encryptedValue, proof.revision, expiresAt]);
  assert.match(calls[0].sql, /updated_at IS NOT DISTINCT FROM \$5::timestamptz/u); assert.match(calls[0].sql, /clock_timestamp\(\)/u);
  await assert.rejects(consumePlexCallbackState({ query: async () => ({ rowCount: 2 }) }, proof));
  await assert.rejects(assertPlexCallbackNotExpired({ query: async () => ({ rows: [{ unexpired: false }] }) }, proof));
});

test('cookie binding is host-only, HttpOnly and Lax, with a secure host prefix under the deployed policy', () => {
  const value = createPlexBrowserBinding(); assert.equal(value.length, 43);
  for (const secure of [false, true]) {
    const headers = new Map(), response = { locals: { deploymentSecurityPolicy: { secureCookies: secure } }, getHeader: key => headers.get(key), setHeader: (key, item) => headers.set(key, item) };
    setPlexBrowserBindingCookie(response, value); const cookie = headers.get('Set-Cookie')[0];
    assert.match(cookie, /Max-Age=600; Path=\/; HttpOnly; SameSite=Lax/u); assert.equal(cookie.includes('; Secure'), secure); assert.doesNotMatch(cookie, /Domain=/u);
    assert.equal(cookie.startsWith('__Host-'), secure);
    const request = { headers: { cookie: cookie.split(';')[0] }, deploymentSecurityPolicy: { secureCookies: secure } };
    assert.equal(readPlexBrowserBinding(request), value);
    request.headers.cookie += '; ' + request.headers.cookie; assert.equal(readPlexBrowserBinding(request), null);
  }
  assert.equal(readPlexBrowserBinding({ headers: { cookie: 'harmoniarr_plex_binding=%xx' }, deploymentSecurityPolicy: { secureCookies: false } }), null);
});

test('continuation parsing permits canonical app paths and refuses external, encoded slash and control destinations', () => {
  for (const value of [null, '//evil.test', '/\\evil.test', '/app/%5cevil', '/app/%2fevil', '/app/../login', '/app\n/else', '/api/v1']) assert.equal(normalizePlexRedirect(value), '/app');
  assert.equal(normalizePlexRedirect('/app/activity?q=value#current'), '/app/activity?q=value#current');
});
