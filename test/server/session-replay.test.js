/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { startSessionReplayTransaction } from '../../src/server/session-replay-transaction-service.js';
import { createSessionReplayService } from '../../src/server/session-replay-service.js';

function fixture(options = {}) {
  let status = options.status ?? 'I';
  const queries = [], releases = [], closes = [];
  const client = Object.assign(new EventEmitter(), {
    getTransactionStatus: () => status,
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith('BEGIN')) { status = 'T'; return { command: 'BEGIN' }; }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        if (Object.hasOwn(options, sql)) throw options[sql];
        status = 'I'; return { command: options.command ?? sql };
      }
      return { rowCount: options.count ?? 1, rows: [{ revoked_reason: 'rotated' }] };
    },
    release(value) { releases.push(value); },
  });
  const owner = { getPoolFn: () => ({ connect: async () => client }), createRetirementFn: () => ({ async close(value) {
    closes.push(value);
    if (Object.hasOwn(options, 'closeError')) throw options.closeError;
    client.emit('end');
  } }) };
  return { owner, client, queries, releases, closes };
}

const input = () => ({ row: { refresh_token_id: 'token', app_user_id: 'user', token_family_id: 'family', token_hash: 'private' },
  requestMetadata: { ipAddress: '203.0.113.1', userAgent: 'fixture' } });

test('replay revocation and required audit use one transaction and immutable selected inputs', async () => {
  const f = fixture(), gate = Promise.withResolvers(), args = input(); let event, eventClient;
  const service = createSessionReplayService({ startTransactionFn: work => startSessionReplayTransaction(async (...values) => {
    await gate.promise; return work(...values);
  }, f.owner), recordAuditEventFn: async (value, client) => { event = value; eventClient = client; } });
  const result = service(args);
  args.row.refresh_token_id = 'changed'; args.requestMetadata.userAgent = 'changed'; gate.resolve();
  assert.equal(await result, 1); assert.equal(eventClient, f.client);
  assert.deepEqual(f.queries[2].values, ['token', 'user', 'family']);
  assert.equal(event.entityId, 'token'); assert.equal(event.userAgent, 'fixture');
  assert.deepEqual(event.details, { tokenFamilyId: 'family', previousRevokedReason: 'rotated' });
  assert.doesNotMatch(JSON.stringify(event), /private|token_hash/u);
  assert.equal(f.queries.at(-1).sql, 'COMMIT'); assert.deepEqual(f.releases, [undefined]);
  assert.deepEqual(f.closes, []); assert.equal(f.client.listenerCount('error'), 0);
});

test('a replay with no active rows commits a no-op without an audit', async () => {
  const f = fixture({ count: 0 });
  const service = createSessionReplayService({ startTransactionFn: work => startSessionReplayTransaction(work, f.owner),
    recordAuditEventFn: async () => { assert.fail('duplicate audit'); } });
  assert.equal(await service(input()), 0); assert.equal(f.queries.at(-1).sql, 'COMMIT');
});

test('untrusted malformed audit metadata cannot supply invalid INET or structured user-agent input', async () => {
  for (const address of ['invalid-address', '203.0.113.1:42', 'fe80::1%eth0', {}, null, '::1', '203.0.113.1']) {
    const f = fixture(); let event;
    const service = createSessionReplayService({ startTransactionFn: work => startSessionReplayTransaction(work, f.owner),
      recordAuditEventFn: async value => { event = value; } });
    assert.equal(await service({ ...input(), requestMetadata: { ipAddress: address, userAgent: {} } }), 1);
    assert.equal(event.ipAddress, ['::1', '203.0.113.1'].includes(address) ? address : null);
    assert.equal(event.userAgent, null);
  }
});

test('required audit failures roll back before releasing and preserve original Error/null privately', async () => {
  for (const cause of [new Error('private SQL secret'), null]) {
    const f = fixture();
    const service = createSessionReplayService({ startTransactionFn: work => startSessionReplayTransaction(work, f.owner),
      recordAuditEventFn: async () => { throw cause; } });
    await assert.rejects(service(input()), error => error.status === 503 && error.cause === cause && !error.message.includes('private'));
    assert.equal(f.queries.at(-1).sql, 'ROLLBACK'); assert.deepEqual(f.releases, [undefined]);
  }
});

test('a failed COMMIT has no rollback or automatic replay and retires the uncertain transport', async () => {
  for (const cause of [new Error('lost acknowledgement'), null]) {
    const f = fixture({ COMMIT: cause }); let calls = 0;
    const task = startSessionReplayTransaction(async () => { calls++; }, f.owner);
    await assert.rejects(task.result, error => error.status === 503 && error.cause === cause);
    assert.equal(await task.drained, true); assert.equal(calls, 1);
    assert.deepEqual(f.queries.map(row => row.sql).filter(sql => sql === 'COMMIT' || sql === 'ROLLBACK'), ['COMMIT']);
    assert.deepEqual(f.closes, [{ force: true }]); assert.deepEqual(f.releases, [true]);
  }
  const f = fixture({ command: 'ROLLBACK' });
  await assert.rejects(startSessionReplayTransaction(async () => 1, f.owner).result, { status: 503 });
  assert.deepEqual(f.releases, [true]);
});

test('late checkout after deadline performs no SQL and retains capacity until actual close', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), checkout = Promise.withResolvers(), close = Promise.withResolvers(); let entered = false;
  const task = startSessionReplayTransaction(async () => { entered = true; }, { getPoolFn: () => ({ connect: () => checkout.promise }),
    timeoutMs: 100, createRetirementFn: () => ({ close: () => close.promise }) });
  const refused = assert.rejects(task.result, { status: 503 }); await Promise.resolve(); t.mock.timers.tick(100); await refused;
  checkout.resolve(f.client); await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(entered, false); assert.equal(f.queries.length, 0); assert.deepEqual(f.releases, []);
  close.resolve(); assert.equal(await task.drained, true); assert.deepEqual(f.releases, [true]);
});

test('deadline after writes prevents COMMIT and failed cleanup preserves the first failure and held checkout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), work = Promise.withResolvers();
  const task = startSessionReplayTransaction(() => work.promise, { ...f.owner, timeoutMs: 100 });
  const refused = assert.rejects(task.result, { status: 503 });
  await new Promise(resolve => { setImmediate(resolve); }); t.mock.timers.tick(100); await refused;
  work.resolve(1); assert.equal(await task.drained, true);
  assert.ok(!f.queries.some(row => row.sql === 'COMMIT')); assert.deepEqual(f.releases, [true]);
  for (const cause of [new Error('original'), null]) {
    const broken = fixture({ ROLLBACK: new Error('rollback'), closeError: new Error('close') });
    const failed = startSessionReplayTransaction(async () => { throw cause; }, broken.owner);
    await assert.rejects(failed.result, error => error.cause === cause);
    assert.equal(await failed.drained, false); assert.deepEqual(broken.releases, []);
    broken.client.emit('error', new Error('late')); broken.client.emit('end');
    assert.equal(broken.client.listenerCount('error'), 0);
  }
});
