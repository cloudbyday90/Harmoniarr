/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { buildJobLeaseKey, createJobLeaseStore, normalizeJobLease } from '../../src/server/job-lease-store.js';

const leaseKey = 'library_scan:run-2';
const observedAt = new Date('2026-10-09T21:00:00.000Z');
function row(overrides = {}) {
  return { id: 'stable-row', job_type: 'library_scan', lease_key: leaseKey, owner_instance_id: 'pid:44',
    acquisition_id: randomUUID(), acquired_at: new Date('2026-10-09T20:59:00.000Z'),
    heartbeat_at: new Date('2026-10-09T21:00:00.000Z'), expires_at: new Date('2026-10-09T21:01:00.000Z'),
    released_at: null, status: 'active', created_at: new Date('2026-10-09T20:00:00.000Z'), ...overrides };
}
function harness(t, responses, { onLock, ...options } = {}) {
  const query = t.mock.fn(async (sql, parameters) => {
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
    const response = responses.shift();
    assert.notEqual(response, undefined, 'Unexpected database call');
    if (sql.includes('FOR UPDATE') && onLock) await onLock();
    if (response.error) throw response.error;
    return { rows: response.rows ?? [] };
  });
  const client = { query };
  const withTransaction = t.mock.fn((work) => work(client));
  const pool = { query };
  const store = createJobLeaseStore({ getPoolFn: () => pool, withTransaction, leaseDurationMs: 60_000,
    ownerInstanceId: 'pid:44', nowFn: () => observedAt, ...options });
  return { store, query, client, withTransaction };
}
function assertLockedWrite(h, operation) {
  const calls = h.query.mock.calls;
  assert.equal(calls.length, 3);
  assert.match(calls[0].arguments[0], /pg_advisory_xact_lock/u);
  assert.deepEqual(calls[0].arguments[1], ['harmoniarr.job-lease:' + leaseKey]);
  assert.match(calls[1].arguments[0], /SELECT \*.*FOR UPDATE/u);
  assert.deepEqual(calls[1].arguments[1], [leaseKey]);
  assert.match(calls[2].arguments[0], operation === 'acquire' ? /INSERT INTO job_leases/u : /UPDATE job_leases/u);
  assert.match(calls[2].arguments[0], /clock_timestamp\(\)/u);
  return calls[2].arguments;
}

test('buildJobLeaseKey identifies the resource, separately from acquisition ownership', () => {
  assert.equal(buildJobLeaseKey({ jobType: 'library_scan', runId: 'run-2' }), leaseKey);
});

test('normalization retains the private token and stable identity while classifying expired/released rows', () => {
  const raw = row({ expires_at: new Date(observedAt.getTime() - 1) });
  const lease = normalizeJobLease(raw, { now: observedAt });
  assert.equal(lease.acquisitionId, raw.acquisition_id);
  assert.equal(lease.id, raw.id);
  assert.equal(lease.state, 'expired');
  assert.equal(lease.status, 'active');
  assert.equal(normalizeJobLease({ ...raw, released_at: observedAt }, { now: observedAt }).state, 'released');
  assert.equal(normalizeJobLease(null), null);
});

test('legacy normalization never fabricates an acquisition token', () => {
  const raw = row();
  delete raw.acquisition_id;
  assert.equal(Object.hasOwn(normalizeJobLease(raw), 'acquisitionId'), false);
});

test('renewal locks first and carries the captured owner/token to the final fresh expiry predicate', async (t) => {
  const raw = row();
  const expectedLease = normalizeJobLease(raw, { now: observedAt });
  const h = harness(t, [{ rows: [{ lease_key: leaseKey }] }, { rows: [raw] }]);
  const lease = await h.store.renewLease({ leaseKey, expectedLease, status: 'active' });
  const [sql, parameters] = assertLockedWrite(h, 'renew');
  assert.match(sql, /expires_at > clock_timestamp\(\)/u);
  assert.deepEqual(parameters, [leaseKey, 60_000, 'active', expectedLease.ownerInstanceId, expectedLease.acquisitionId]);
  assert.equal(h.withTransaction.mock.callCount(), 1);
  assert.equal(lease.acquisitionId, expectedLease.acquisitionId);
  assert.equal(lease.state, 'active');
});

test('mutation captures authority before the lock await instead of adopting later caller changes', async (t) => {
  const raw = row();
  const expectedLease = normalizeJobLease(raw, { now: observedAt });
  const capturedId = expectedLease.acquisitionId;
  const h = harness(t, [{}, { rows: [raw] }], { onLock: async () => {
    expectedLease.acquisitionId = randomUUID();
    expectedLease.ownerInstanceId = 'replacement';
  } });
  await h.store.renewLease({ leaseKey, expectedLease });
  assert.deepEqual(h.query.mock.calls[2].arguments[1], [leaseKey, 60_000, 'active', 'pid:44', capturedId]);
});

test('missing/malformed/wrong-key expected receipts refuse renew and release without SQL or a transaction', async (t) => {
  const valid = normalizeJobLease(row(), { now: observedAt });
  for (const expectedLease of [undefined, null, {}, [], { ...valid, acquisitionId: null },
    { ...valid, acquisitionId: 'row-id' }, { ...valid, leaseKey: 'wrong:key' }, { ...valid, ownerInstanceId: '' }]) {
    const h = harness(t, []);
    assert.equal(await h.store.renewLease({ leaseKey, expectedLease }), null);
    assert.equal(await h.store.releaseLease({ leaseKey, expectedLease, status: 'completed' }), null);
    assert.equal(h.query.mock.callCount(), 0);
    assert.equal(h.withTransaction.mock.callCount(), 0);
  }
});

test('an owned expired lease can be released only by its exact captured token', async (t) => {
  const raw = row({ expires_at: new Date(observedAt.getTime() - 1), released_at: observedAt, status: 'failed' });
  const expectedLease = normalizeJobLease({ ...raw, released_at: null }, { now: observedAt });
  const h = harness(t, [{}, { rows: [raw] }]);
  const lease = await h.store.releaseLease({ leaseKey, expectedLease, status: 'failed' });
  const [sql, parameters] = assertLockedWrite(h, 'release');
  assert.match(sql, /owner_instance_id = \$3 AND acquisition_id = \$4::uuid/u);
  assert.match(sql, /released_at IS NULL/u);
  assert.deepEqual(parameters, [leaseKey, 'failed', expectedLease.ownerInstanceId, expectedLease.acquisitionId]);
  assert.equal(lease.state, 'released');
  assert.equal(lease.status, 'failed');
});

test('zero-row stale/expired renewal and replaced release propagate refusal rather than a current receipt', async (t) => {
  const expectedLease = normalizeJobLease(row(), { now: observedAt });
  for (const method of ['renewLease', 'releaseLease']) {
    const h = harness(t, [{}, { rows: [] }]);
    assert.equal(await h.store[method]({ leaseKey, expectedLease, status: 'failed' }), null);
    const parameters = h.query.mock.calls[2].arguments[1];
    assert.equal(parameters.at(-1), expectedLease.acquisitionId);
    assert.equal(parameters.at(-2), expectedLease.ownerInstanceId);
  }
});

test('reacquisition uses a new returned token while stable row/key/owner/timestamp stay unchanged', async (t) => {
  const original = row();
  const replacement = { ...original, acquisition_id: randomUUID() };
  const h = harness(t, [{}, { rows: [original] }, {}, { rows: [replacement] }], { leaseDurationMs: 120_000 });
  const first = await h.store.acquireLease({ jobType: 'library_scan', leaseKey });
  const second = await h.store.acquireLease({ jobType: 'library_scan', leaseKey });
  assert.equal(first.id, second.id);
  assert.equal(first.ownerInstanceId, second.ownerInstanceId);
  assert.equal(first.acquiredAt, second.acquiredAt);
  assert.notEqual(first.acquisitionId, second.acquisitionId);
  const sql = h.query.mock.calls[2].arguments[0];
  assert.match(sql, /acquisition_id = EXCLUDED.acquisition_id/u);
  assert.match(sql, /gen_random_uuid\(\)/u);
  const takeoverCondition = sql.slice(sql.indexOf('WHERE job_leases'), sql.indexOf('RETURNING'));
  assert.match(takeoverCondition, /released_at IS NOT NULL/u);
  assert.match(takeoverCondition, /expires_at <= clock_timestamp\(\)/u);
  assert.doesNotMatch(takeoverCondition, /owner_instance_id/u);
  assert.deepEqual(h.query.mock.calls[2].arguments[1], ['library_scan', leaseKey, 'pid:44', 120_000]);
});

test('a live same-owner denied acquisition returns null without an ownership receipt', async (t) => {
  const h = harness(t, [{}, { rows: [] }]);
  assert.equal(await h.store.acquireLease({ jobType: 'library_scan', leaseKey }), null);
  assertLockedWrite(h, 'acquire');
});

test('a caller-owned transaction client receives both lock and mutation without opening a nested transaction', async (t) => {
  const raw = row();
  const h = harness(t, []);
  const suppliedQuery = t.mock.fn(async () => ({ rows: [raw] }));
  const suppliedClient = { query: suppliedQuery };
  const expectedLease = normalizeJobLease(raw, { now: observedAt });
  const lease = await h.store.renewLease({ leaseKey, expectedLease, queryable: suppliedClient });
  assert.equal(lease.acquisitionId, expectedLease.acquisitionId);
  assert.equal(suppliedQuery.mock.callCount(), 3);
  assert.equal(h.query.mock.callCount(), 0);
  assert.equal(h.withTransaction.mock.callCount(), 0);
});

test('database failure after the lock remains an error and cannot masquerade as a lease loss', async (t) => {
  const failure = new Error('Controlled database failure');
  const h = harness(t, [{}, { error: failure }]);
  const expectedLease = normalizeJobLease(row(), { now: observedAt });
  await assert.rejects(h.store.releaseLease({ leaseKey, expectedLease, status: 'failed' }), (error) => error === failure);
  assert.equal(h.withTransaction.mock.callCount(), 1);
});

test('read/list receipt normalization exposes the actual saved token without taking mutation locks', async (t) => {
  const raw = row();
  const h = harness(t, [{ rows: [raw] }, { rows: [raw] }]);
  assert.equal((await h.store.getLease({ leaseKey })).acquisitionId, raw.acquisition_id);
  assert.equal((await h.store.listLeases({ leaseKeys: [leaseKey] }))[0].acquisitionId, raw.acquisition_id);
  assert.deepEqual(h.query.mock.calls[0].arguments[1], [leaseKey]);
  assert.deepEqual(h.query.mock.calls[1].arguments[1], [[leaseKey]]);
  assert.equal(h.withTransaction.mock.callCount(), 0);
});
