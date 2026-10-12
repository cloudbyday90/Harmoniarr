/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { createPostgresFailureEvidence, observePostgresFixtureFailure } from '../../testing/integration/postgres-failure-evidence.js';
import { buildPostgresFailureRecord } from '../../testing/integration/postgres-failure-record.js';
import { createPostgresHostProbe, postgresProbeSql } from '../../testing/integration/postgres-host-probe.js';
import { createPostgresReadinessProbe } from '../../testing/integration/postgres-readiness-probe.js';

const containerId = 'a'.repeat(64);
const correlationId = '11111111-1111-4111-8111-111111111111';
const owned = { source: 'testcontainer_postgres', fresh: true, containerId };
const flush = () => new Promise(resolve => { setImmediate(resolve); });

test('capture registers one canonical completion and drains all three observations before publishing', async () => {
  const held = Promise.withResolvers(); const records = []; let calls = 0;
  const primary = Object.assign(new Error('private SQL/password'), { code: 'ECONNRESET' });
  const owner = createPostgresFailureEvidence({ ...owned, onRecord: record => records.push(record),
    hostProbeFactory: () => async () => { calls += 1; throw null; },
    readinessProbeFactory: () => async () => { calls += 1; return { outcome: 'accepting', cliExitCode: 0 }; },
    containerStateProbeFactory: () => async () => { calls += 1; await held.promise; return { outcome: 'passed', running: true, restartCount: 0 }; } });
  const capture = owner.createCapture({ correlationId });
  const pending = capture(primary, 'schema_prepare');
  assert.equal(capture(new Error('secondary')), pending);
  await flush(); assert.equal(calls, 3); assert.equal(records.length, 0);
  held.resolve(); await pending;
  assert.equal(records.length, 1); assert.equal(records[0].correlationId, correlationId);
  assert.equal(records[0].errors[0].code, 'ECONNRESET');
  assert.equal(records[0].host.outcome, 'failed'); assert.equal(records[0].readiness.outcome, 'accepting');
  assert.equal(records[0].version, 2); assert.equal(records[0].containerState.running, true);
  assert.equal(JSON.stringify(records).includes('private'), false);
});

test('success and off mode launch no probe, including invalid injected observer work', async () => {
  const forbidden = () => assert.fail('Unrequested diagnostic launched');
  const capture = createPostgresFailureEvidence({ ...owned, mode: 'off', onRecord: forbidden,
    hostProbeFactory: forbidden, readinessProbeFactory: forbidden, containerStateProbeFactory: forbidden }).createCapture();
  assert.equal(await observePostgresFixtureFailure(capture, 'database_scenario', () => 'result'), 'result');
  await assert.rejects(observePostgresFixtureFailure(capture, 'schema_prepare', () => Promise.reject(null)), e => e === null);
  await assert.rejects(observePostgresFixtureFailure(async () => { throw new Error('sink'); },
    'schema_prepare', () => Promise.reject(null)), e => e === null);
});

test('parent file failure uses an approved distinct phase without serializing raw details', () => {
  const record = buildPostgresFailureRecord({ phase: 'test_file', error: new Error('private-parent-token') });
  assert.equal(record.phase, 'test_file'); assert.equal(JSON.stringify(record).includes('private'), false);
});

test('external, reused, unknown and pre-cancelled capabilities cannot launch automatic probes', async () => {
  for (const input of [{ ...owned, source: 'external_postgres' }, { ...owned, fresh: false },
    { ...owned, containerId: 'private-name' }, owned]) {
    const records = []; const controller = new AbortController();
    if (input === owned) controller.abort(null);
    const forbidden = () => assert.fail('Unowned/cancelled diagnostic launched');
    await createPostgresFailureEvidence({ ...input, onRecord: r => records.push(r),
      hostProbeFactory: forbidden, readinessProbeFactory: forbidden, containerStateProbeFactory: forbidden })
      .createCapture({ signal: controller.signal })(null);
    assert.equal(records[0].host.outcome, 'unavailable'); assert.equal(records[0].readiness.outcome, 'unavailable');
    assert.equal(records[0].containerState.outcome, 'unavailable');
  }
});

test('hostile and changing getters cannot smuggle raw values into approved records', () => {
  const privateValue = 'private-password';
  const host = { outcome: 'passed' }; const readiness = { outcome: 'accepting' }; const containerState = { outcome: 'passed' };
  for (const [object, key, first] of [[host, 'version', 180003], [host, 'recovery', false],
    [host, 'closed', true], [readiness, 'cliExitCode', 0], [containerState, 'running', true],
    [containerState, 'restartCount', 0]]) {
    let reads = 0; Object.defineProperty(object, key, { get: () => ++reads === 1 ? first : privateValue });
  }
  const record = buildPostgresFailureRecord({ correlationId: privateValue, source: privateValue, phase: privateValue,
    error: new Proxy({}, { get() { throw new Error(privateValue); } }), host, readiness, containerState, durationMs: Infinity });
  assert.equal(record.host.version, 180003); assert.equal(record.host.recovery, false);
  assert.equal(record.host.closed, true); assert.equal(record.readiness.cliExitCode, 0);
  assert.equal(record.containerState.running, true); assert.equal(record.containerState.restartCount, 0);
  assert.equal(JSON.stringify(record).includes(privateValue), false);
  assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(record.host)); assert.ok(Object.isFrozen(record.readiness));
  assert.ok(Object.isFrozen(record.containerState));
});

test('throwing clocks and synchronous/asynchronous sinks cannot replace an original Error or null', async () => {
  for (const primary of [new Error('primary'), null]) {
    for (const onRecord of [() => { throw new Error('sink'); }, async () => { throw null; }]) {
      const capture = createPostgresFailureEvidence({ source: 'external_postgres', onRecord,
        now: () => { throw new Error('clock'); } }).createCapture();
      await assert.rejects(observePostgresFixtureFailure(capture, 'database_scenario', () => Promise.reject(primary)), e => e === primary);
    }
  }
  await flush();
});

test('host probe uses an independent bounded config and awaits client end after connect or query failure', async () => {
  for (const failingStage of ['connect', 'query']) {
    const ended = Promise.withResolvers(); const startedEnd = Promise.withResolvers();
    const client = new EventEmitter(); let configuration; let queries = 0; let complete = false;
    client.connect = async () => { if (failingStage === 'connect') throw null; };
    client.query = async sql => { assert.equal(sql, postgresProbeSql); queries += 1; throw null; };
    client.end = async () => { startedEnd.resolve(); await ended.promise; };
    const pending = createPostgresHostProbe({ connectionConfig: { password: 'private-password', connectionTimeoutMillis: 0 },
      clientFactory: config => { configuration = config; return client; } })().then(result => { complete = true; return result; });
    await startedEnd.promise; assert.equal(complete, false);
    assert.equal(configuration.connectionTimeoutMillis, 1000); assert.equal(configuration.query_timeout, 1000);
    assert.equal(configuration.statement_timeout, 1000);
    ended.resolve(); const result = await pending;
    assert.equal(result.stage, failingStage); assert.equal(result.error, null); assert.equal(result.closed, true);
    assert.equal(queries, failingStage === 'connect' ? 0 : 1); assert.equal(client.listenerCount('error'), 0);
  }
});

test('host probe preserves primary failure over close failure and observes asynchronous null errors', async () => {
  for (const failQuery of [false, true]) {
    const client = new EventEmitter();
    client.connect = async () => {};
    client.query = async () => { if (failQuery) throw null; client.emit('error', null); return { rows: [{ version: 180003, recovery: false }] }; };
    client.end = async () => { if (failQuery) throw new Error('cleanup'); };
    const result = await createPostgresHostProbe({ connectionConfig: {}, clientFactory: () => client })();
    assert.equal(result.outcome, 'failed'); assert.equal(result.error, null);
    assert.equal(result.closed, !failQuery);
  }
});

test('readiness uses exact captured argv, short limits and reports only approved exit states', async () => {
  for (const exitCode of [0, 1, 2, 3]) {
    const probe = createPostgresReadinessProbe({ containerId, user: 'owned_role', executeFileFn: async (file, args, options) => {
      assert.equal(file, 'docker'); assert.deepEqual(args, ['exec', containerId, 'pg_isready', '-q', '-t', '1',
        '-h', '127.0.0.1', '-p', '5432', '-U', 'owned_role', '-d', 'postgres']);
      assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
      assert.equal(options.timeout, 2000); assert.equal(options.maxBuffer, 512); assert.equal(options.killSignal, 'SIGKILL');
      if (exitCode) throw Object.assign(new Error('private output'), { code: exitCode });
    } });
    const result = await probe();
    assert.equal(result.cliExitCode, exitCode);
    assert.equal(result.outcome, exitCode === 0 ? 'accepting' : 'failed');
  }
  assert.throws(() => createPostgresReadinessProbe({ containerId: 'private;host' }), TypeError);
  assert.throws(() => createPostgresReadinessProbe({ containerId, user: 'private;role' }), TypeError);
  const result = await createPostgresReadinessProbe({ containerId, executeFileFn: async () => { throw Object.assign(new Error('private'), { code: 'ENOENT' }); } })();
  assert.equal(result.outcome, 'failed'); assert.equal(result.cliExitCode, null);
});

test('a real owned CLI child overflowing the bounded output closes before probe completion', async () => {
  const execute = promisify(execFile); let closed = false;
  const result = await createPostgresReadinessProbe({ containerId, executeFileFn: (_file, _args, options) => {
    const pending = execute(process.execPath, ['--input-type=module', '-e', "process.stdout.write('x'.repeat(1024)); setInterval(() => {}, 1000);"], options);
    pending.child.once('close', () => { closed = true; });
    return pending;
  } })();
  assert.equal(result.outcome, 'failed'); assert.equal(closed, true);
});
