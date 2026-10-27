/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPlexCallbackRetention, plexCallbackLegacyRetentionMs, plexCallbackRetentionNamePattern } from '../../src/server/integrations/plex/plex-callback-retention-policy.js';
import { createPlexCallbackRetentionService } from '../../src/server/integrations/plex/plex-callback-retention-service.js';
import { createPlexCallbackMaintenanceService } from '../../src/server/integrations/plex/plex-callback-maintenance-service.js';
import { drainApplicationWorkerOwners } from '../../src/server/application-worker-drain.js';

const observedAt = '2026-10-27T12:00:00.000Z', old = '2026-10-25T12:00:00.000Z';
const expired = JSON.stringify({ version: 1, expiresAt: observedAt });
const future = JSON.stringify({ version: 1, expiresAt: '2026-10-28T12:00:00.000Z' });
const classify = (plaintext, overrides) => classifyPlexCallbackRetention({ plaintext, createdAt: old, updatedAt: old, observedAt, ...overrides });

test('retention uses payload expiry, retains active and unknown envelopes, and conservatively ages legacy/malformed plaintext', () => {
  assert.deepEqual(classify(expired), { reason: 'expired', deleteAfter: observedAt });
  assert.deepEqual(classify(future), { reason: 'active' });
  assert.deepEqual(classify(JSON.stringify({ version: 2, expiresAt: old })), { reason: 'unknown' });
  for (const plaintext of ['invalid', '{}', JSON.stringify({ version: 1, expiresAt: 'invalid' })]) {
    assert.deepEqual(classify(plaintext), { reason: 'legacy', deleteAfter: '2026-10-26T12:00:00.000Z' });
    assert.deepEqual(classify(plaintext, { updatedAt: observedAt }), { reason: 'recent' });
    assert.deepEqual(classify(plaintext, { createdAt: observedAt }), { reason: 'recent' });
  }
  assert.equal(plexCallbackLegacyRetentionMs, 86_400_000);
  assert.deepEqual(classify(null), { reason: 'unreadable' });
  assert.deepEqual(classify('{}', { updatedAt: null }), { reason: 'unreadable' });
  assert.throws(() => classify('{}', { observedAt: null }), /observation/u);
});

function fixture({ batchSize = 2, auditError = false, deleteCount = null, claim = true, guardError = false } = {}) {
  const calls = [], audits = [], committed = [], batches = [];
  let commitError = false;
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith('SELECT pg_try_')) return { rows: [{ acquired: claim, observed_at: observedAt }] };
    if (sql.startsWith('SELECT id,name')) return { rows: batches.shift() ?? [] };
    if (sql.startsWith('DELETE')) return { rowCount: deleteCount ?? values[0].length };
    throw new Error('Unexpected SQL');
  } };
  const service = createPlexCallbackRetentionService({ batchSize,
    maintenanceGuard: { assertNoActiveWriteLocks: async options => { assert.equal(options.queryable, client); calls.push({ guard: true }); if (guardError) throw new Error('maintenance'); } },
    encryptedSecretService: { decryptSecretRecord: row => { if (row.encrypted_value.toString() === 'bad-cipher') throw new Error('decrypt'); return row.encrypted_value.toString(); } },
    recordAuditEventFn: async (event, queryable) => { assert.equal(queryable, client); audits.push(event); if (auditError) throw new Error('audit'); },
    startTransactionFn: work => { const result = Promise.resolve().then(() => work(client, () => {})).then(value => { if (commitError) throw new Error('commit'); committed.push(true); return value; }); return { result, drained: result.then(() => true, () => true) }; },
  });
  return { service, calls, audits, batches, committed, failCommit: () => { commitError = true; } };
}
const row = (index, plaintext = expired) => ({ id: '00000000-0000-4000-8000-' + String(index).padStart(12, '0'),
  name: 'auth.plex.sign_in.pending.00000000-0000-4000-8000-' + String(index).padStart(12, '0'),
  encrypted_value: Buffer.from(plaintext), created_at: old, updated_at: old });

test('one bounded pass owns maintenance guard, cross-process claim, row locks, exact deletion count and privacy-safe required audit', async () => {
  const f = fixture(); f.batches.push([row(1), row(2, '{}')]);
  const summary = await f.service.startPrune().result;
  assert.equal(summary.inspectedCount, 2); assert.equal(summary.deletedCount, 2); assert.equal(summary.nextCursor, undefined);
  assert.equal(f.calls[0].guard, true);
  assert.match(f.calls[2].sql, /LIMIT \$6 FOR UPDATE SKIP LOCKED/u);
  assert.match(f.calls[2].sql, /CASE WHEN octet_length/u);
  assert.deepEqual(f.calls[3].values[0], [row(1).id, row(2).id]);
  assert.match(f.calls[3].sql, /selected.delete_after<=clock_timestamp\(\)/u);
  assert.deepEqual(f.audits, [{ actorType: 'system', eventType: 'plex_callback_state_pruned', required: true,
    summary: 'Expired Plex callback state removed', details: { inspectedCount: 2, deletedCount: 2, expiredCount: 1, legacyCount: 1 } }]);
  assert.equal(f.committed.length, 1);
});

test('keyset progress passes retained records, wraps after a short batch and never returns secret identities', async () => {
  const f = fixture(); f.batches.push([row(1, future), row(2, '{"version":2}')], [row(3)], []);
  const first = await f.service.startPrune().result; assert.equal(first.deletedCount, 0); assert.equal(f.audits.length, 0);
  await f.service.startPrune().result; await f.service.startPrune().result;
  const reads = f.calls.filter(call => call.sql?.startsWith('SELECT id,name'));
  assert.deepEqual(reads.map(call => call.values.slice(3, 5)), [[null, null], [row(2).name, row(2).id], [null, null]]);
  assert.doesNotMatch(JSON.stringify(first), /auth\.plex|00000000/u);
});

test('unreadable/oversized records are retained; maintenance conflict or another claimant performs no state deletion', async () => {
  const f = fixture(); f.batches.push([row(1, 'bad-cipher'), { ...row(2), encrypted_value: null }]);
  assert.equal((await f.service.startPrune().result).counts.unreadable, 2); assert.equal(f.audits.length, 0);
  const busy = fixture({ claim: false }); assert.deepEqual(await busy.service.startPrune().result, { skipped: true, reason: 'busy' });
  assert.equal(busy.calls.length, 2);
  const paused = fixture({ guardError: true }); await assert.rejects(paused.service.startPrune().result, /maintenance/u); assert.equal(paused.calls.length, 1);
});

test('suppressed deletion, failed required audit and lost commit acknowledgement cannot advance the scan cursor', async () => {
  for (const options of [{ deleteCount: 0 }, { auditError: true }, {}]) {
    const f = fixture(options); f.batches.push([row(1), row(2)], []); if (!Object.keys(options).length) f.failCommit();
    await assert.rejects(f.service.startPrune().result);
    await f.service.startPrune().result.catch(() => {});
    const reads = f.calls.filter(call => call.sql?.startsWith('SELECT id,name'));
    assert.equal(reads[1].values[3], null); assert.equal(f.committed.length, options.deleteCount === 0 || options.auditError ? 1 : 0);
  }
  for (const batchSize of [0, 101, NaN]) assert.throws(() => fixture({ batchSize }), /bounded/u);
});

test('maintenance waits for actual drainage, coalesces ticks and closes admission before shutdown', async () => {
  const result = Promise.withResolvers(), drain = Promise.withResolvers(); let starts = 0, finished = false;
  const service = createPlexCallbackMaintenanceService({ retentionService: { startPrune() { starts++; return { result: result.promise, drained: drain.promise }; } } });
  const running = service.tick(); result.reject(new Error('deadline'));
  await new Promise(resolve => { setImmediate(resolve); });
  assert.equal((await service.tick()).reason, 'tick_in_progress');
  const closing = service.stopAndDrain(); closing.then(() => { finished = true; });
  assert.equal(service.stopAndDrain(), closing); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(finished, false);
  drain.resolve(true); await running; await closing; await service.tick(); assert.equal(starts, 1);
});

test('uncertain transaction retirement seals maintenance and refuses a successful shutdown', async () => {
  let starts = 0;
  const service = createPlexCallbackMaintenanceService({ retentionService: { startPrune() { starts++; return { result: Promise.resolve({ deletedCount: 0 }), drained: Promise.resolve(false) }; } } });
  await service.tick(); await service.tick(); assert.equal(starts, 1); await assert.rejects(service.stopAndDrain(), /retirement is uncertain/u);
});

test('application drainage owns callback maintenance before pool consumers retire', async () => {
  const gate = Promise.withResolvers(), entered = Promise.withResolvers(); let downstream = false;
  const draining = drainApplicationWorkerOwners({ systemModule: {
    plexCallbackMaintenanceService: { close: async () => { entered.resolve(); await gate.promise; } },
    healthReadinessService: { close: async () => { downstream = true; } },
  } });
  await entered.promise; assert.equal(downstream, false); gate.resolve(); await draining; assert.equal(downstream, true);
});


test('retention includes canonical owner and sign-in state but excludes permanent link secrets', () => {
  const pattern = new RegExp(plexCallbackRetentionNamePattern, 'u');
  const id = '12345678-1234-1234-1234-123456789abc';
  assert.equal(pattern.test('providers.plex.link.pending.' + id), true);
  assert.equal(pattern.test('auth.plex.sign_in.pending.' + id), true);
  for (const name of ['providers.plex.link.token', 'providers.plex.link.revision', 'providers.plex.link.client_identifier', 'providers.plex.link.pending.invalid']) assert.equal(pattern.test(name), false);
});
