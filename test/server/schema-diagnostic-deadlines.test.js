/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { startSchemaDiagnosticTask } from '../../src/server/schema-diagnostic-task-service.js';
import { createSchemaObservationConnection } from '../../src/server/schema-observation-connection-service.js';
import { withSchemaObservation } from '../../src/server/schema-observation-owner-service.js';
import { startDatabaseSchemaDriftInspection } from '../../src/server/schema-drift-service.js';
import { createSchemaDiagnosticsService } from '../../src/server/schema-diagnostics-service.js';

test('diagnostic deadline rejects the caller but retains admission until the original work drains', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const started = Promise.withResolvers(), finish = Promise.withResolvers(); let calls = 0, signal;
  const service = createSchemaDiagnosticsService({ timeoutMs: 100, inspectFn: async options => {
    calls++; signal = options.signal; started.resolve(); await finish.promise; throw new Error('private late error');
  } });
  const first = service.getSchemaDiagnostics(); await started.promise;
  t.mock.timers.tick(100);
  assert.equal((await first).state, 'unavailable'); assert.equal(signal.aborted, true);
  assert.equal((await service.getSchemaDiagnostics()).state, 'busy'); assert.equal(calls, 1);
  finish.resolve(); await new Promise(resolve => { setImmediate(resolve); });
  assert.equal((await service.getSchemaDiagnostics()).state, 'unavailable'); assert.equal(calls, 2);
});

test('pre-aborted or expired preparation cannot open a late database connection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manifest = Promise.withResolvers(); let reads = 0;
  const task = startDatabaseSchemaDriftInspection({ timeoutMs: 100, loadMigrationManifestFn: () => manifest.promise,
    readSnapshotFn: () => { reads++; assert.fail('late snapshot read'); }, createConnectionFn: () => assert.fail('late connection') });
  const rejected = assert.rejects(task.result, { code: 'schema_diagnostics_unavailable' });
  await Promise.resolve(); t.mock.timers.tick(100); await rejected;
  manifest.resolve([]); await task.drained; assert.equal(reads, 0);
  const controller = new AbortController(); controller.abort(new Error('private reason'));
  const aborted = startSchemaDiagnosticTask(() => assert.fail('aborted work'), { signal: controller.signal });
  await assert.rejects(aborted.result, error => error.code === 'schema_diagnostics_unavailable' && !error.message.includes('private'));
  await aborted.drained;
});

test('cancellation owns late connection delivery and waits for close without entering observation', async () => {
  const controller = new AbortController(), connecting = Promise.withResolvers(), closing = Promise.withResolvers(), started = Promise.withResolvers();
  const client = Object.assign(new EventEmitter(), { getTransactionStatus: () => 'I', query: () => assert.fail('late SQL') });
  let closeCalls = 0, drained = false;
  const task = startSchemaDiagnosticTask(scope => withSchemaObservation({ scope, createConnectionFn: () => ({ client,
    connect: () => { started.resolve(); return connecting.promise; }, close: ({ force }) => {
      closeCalls++; assert.equal(force, true); return closing.promise;
    } }) }, () => assert.fail('late observation')), { signal: controller.signal });
  task.drained.then(() => { drained = true; });
  const rejected = assert.rejects(task.result, { code: 'schema_diagnostics_unavailable' });
  await started.promise; controller.abort(); await rejected;
  connecting.resolve(); await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(drained, false); assert.equal(closeCalls, 1);
  closing.resolve(); await task.drained;
  assert.equal(closeCalls, 1); assert.equal(client.listenerCount('error'), 0); assert.equal(client.listenerCount('end'), 0);
});

test('single-use driver configuration bounds startup, refuses pipelining and force closes an already closing transport', async () => {
  let config, closes = 0, destroys = 0;
  class Client {
    constructor(options) { config = options; this.connection = { stream: { destroy() { destroys++; } } }; }
    connect() { return Promise.resolve(); }
    end() { closes++; return Promise.resolve(); }
  }
  const connection = createSchemaObservationConnection({ Client, config: { database: 'fixture', pipeline: true, connectionTimeoutMillis: 0 } });
  assert.equal(config.database, 'fixture'); assert.equal(config.pipeline, false); assert.equal(config.connectionTimeoutMillis, 2_000);
  await connection.connect(); await connection.close(); await connection.close({ force: true });
  assert.equal(closes, 1); assert.equal(destroys, 1);
});

test('deadline drainage preserves primary Error and null when owned work fails', async () => {
  for (const original of [new Error('original'), null]) {
    const task = startSchemaDiagnosticTask(async () => { throw original; });
    await assert.rejects(task.result, error => error === original); await task.drained;
  }
});

test('uncertain connection retirement fences admission even after the owned promise rejects', async () => {
  for (const original of [new Error('original'), null]) {
    const client = Object.assign(new EventEmitter(), { getTransactionStatus: () => 'I', query: async () => { throw original; } });
    const task = startSchemaDiagnosticTask(scope => withSchemaObservation({ scope, createConnectionFn: () => ({ client,
      connect: async () => {}, close: async () => { throw new Error('unconfirmed close'); },
    }) }, () => assert.fail('work entered')));
    await assert.rejects(task.result, error => error === original); assert.equal(await task.drained, false);
  }
  const service = createSchemaDiagnosticsService({ inspectFn: async scope => {
    scope.markRetirementUncertain(); throw null;
  } });
  assert.equal((await service.getSchemaDiagnostics()).state, 'unavailable');
  assert.equal((await service.getSchemaDiagnostics()).state, 'busy');
});
