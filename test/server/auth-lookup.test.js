/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { readBootstrapRequired, readPasswordLoginUser, startAuthLookup } from '../../src/server/auth-lookup-service.js';
import { withRequestReadSignal } from '../../src/server/request-read-signal-service.js';
import { createBootstrapStatusService } from '../../src/server/bootstrap-status-service.js';

function fixture(options = {}) {
  let status = 'I'; const queries = [], releases = [], closes = [];
  const client = Object.assign(new EventEmitter(), { getTransactionStatus: () => status,
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith('BEGIN')) { status = 'T'; return { command: 'BEGIN' }; }
      if (sql === 'ROLLBACK') { if (Object.hasOwn(options, 'rollbackError')) throw options.rollbackError; status = 'I'; return { command: 'ROLLBACK' }; }
      return { rows: options.rows ?? [{ has_users: false }] };
    }, release(value) { releases.push(value); } });
  const owner = { getPoolFn: () => ({ connect: async () => client }), createRetirementFn: () => ({ async close(value) {
    closes.push(value); if (options.closeError) throw options.closeError; client.emit('end');
  } }) };
  return { client, owner, queries, releases, closes };
}

test('bootstrap and selected credential facts use bounded read-only ownership and return after clean rollback', async () => {
  for (const hasUsers of [false, true]) {
    const f = fixture({ rows: [{ has_users: hasUsers }] });
    assert.equal(await readBootstrapRequired(f.owner), !hasUsers);
    assert.match(f.queries[0].sql, /READ COMMITTED READ ONLY/u);
    assert.match(f.queries[1].sql, /statement_timeout='3s'/u);
    assert.equal(f.queries.at(-1).sql, 'ROLLBACK'); assert.deepEqual(f.releases, [undefined]); assert.equal(f.closes.length, 0);
  }
  for (const identifier of ['listener', 'listener@example.test']) {
    const facts = { id: 'user', password_hash: 'selected-hash', credential_epoch: '2026-01-01 00:00:00.000100+00' }, f = fixture({ rows: [facts] });
    assert.deepEqual(await readPasswordLoginUser(identifier, f.owner), facts);
    const lookup = f.queries[2]; assert.deepEqual(lookup.values, [identifier]);
    assert.doesNotMatch(lookup.sql, /SELECT \*/u); assert.match(lookup.sql, /password_changed_at::text/u);
    assert.ok(lookup.sql.includes(identifier.includes('@') ? 'lower(email)=$1' : 'username=$1'));
  }
  assert.equal(await readPasswordLoginUser('unknown', fixture({ rows: [] }).owner), null);
});

test('bad bootstrap facts, SQL errors and failed rollback cannot publish bootstrap or credential authority', async () => {
  await assert.rejects(readBootstrapRequired(fixture({ rows: [] }).owner), { status: 503, code: 'auth_lookup_unavailable' });
  for (const original of [new Error('private credential SQL'), null]) {
    const f = fixture({ rollbackError: new Error('rollback'), closeError: new Error('close') });
    const task = startAuthLookup(async () => { throw original; }, f.owner);
    await assert.rejects(task.result, error => error.status === 503 && error.code === 'auth_lookup_unavailable' && error.cause === original && !error.message.includes('private'));
    assert.equal(await task.drained, false); assert.equal(f.releases.length, 0); f.client.emit('end');
  }
  const rollback = fixture({ rollbackError: null });
  await assert.rejects(readPasswordLoginUser('listener', rollback.owner), { code: 'auth_lookup_unavailable', cause: null });
  assert.deepEqual(rollback.releases, [true]); assert.equal(rollback.closes.length, 1);
});

test('aborted and late credential checkouts never start SQL and remain owned through retirement', async t => {
  const controller = new AbortController(); controller.abort(); let checkouts = 0;
  const pre = startAuthLookup(async () => {}, { signal: controller.signal, getPoolFn: () => ({ connect() { checkouts++; } }) });
  await assert.rejects(pre.result, { code: 'auth_lookup_unavailable' }); assert.equal(await pre.drained, true); assert.equal(checkouts, 0);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const checkout = Promise.withResolvers(), close = Promise.withResolvers(), f = fixture(); let entered = false;
  const task = startAuthLookup(async () => { entered = true; }, { timeoutMs: 100, getPoolFn: () => ({ connect: () => checkout.promise }), createRetirementFn: () => ({ close: () => close.promise }) });
  const refused = assert.rejects(task.result, { code: 'auth_lookup_unavailable' }); await Promise.resolve(); t.mock.timers.tick(100); await refused;
  checkout.resolve(f.client); await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(entered, false); assert.equal(f.queries.length, 0); assert.equal(f.releases.length, 0);
  close.resolve(); assert.equal(await task.drained, true); assert.deepEqual(f.releases, [true]);
});

test('request read signals ignore normal body completion and remove response listeners on success or failure', async () => {
  for (const finished of [false, true]) {
    const request = Object.assign(new EventEmitter(), { res: Object.assign(new EventEmitter(), { writableFinished: finished }) });
    await withRequestReadSignal(request, async signal => {
      request.emit('close'); assert.equal(signal.aborted, false);
      request.res.emit('close'); assert.equal(signal.aborted, !finished);
    });
    assert.equal(request.res.listenerCount('close'), 0);
    const original = new Error('original');
    await assert.rejects(withRequestReadSignal(request, async () => { throw original; }), error => error === original);
    assert.equal(request.res.listenerCount('close'), 0);
  }
  await withRequestReadSignal({ aborted: true }, async signal => assert.equal(signal.aborted, true));
});

test('bootstrap status forwards cancellation to the existence read and cannot turn a read failure into setup', async () => {
  const signal = new AbortController().signal, unavailable = Object.assign(new Error('temporary'), { status: 503 });
  const service = createBootstrapStatusService({ getBootstrapRequired: async options => { assert.equal(options.signal, signal); throw unavailable; },
    settingsService: { buildSettingsPayload() { throw new Error('must not read setup settings'); } } });
  await assert.rejects(service.buildBootstrapStatusPayload({ signal }), error => error === unavailable);
});
