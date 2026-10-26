/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createHealthReadinessService } from '../../src/server/readiness/health-readiness-service.js';
import { createReadinessDiagnosticsService } from '../../src/server/readiness/readiness-diagnostics-service.js';
import { createReadinessDiagnosticLogService } from '../../src/server/readiness/readiness-diagnostic-log-service.js';
import { classifyReadinessFailure } from '../../src/server/readiness/readiness-diagnostic-policy.js';
import { createSystemService } from '../../src/server/system-service.js';

const overview = { service: { startedAt: '2026-10-26T12:00:00.000Z' }, database: { pendingMigrations: 0, name: 'private_db' } };
function fixture() {
  let clock = 0; const lines = [], stream = new EventEmitter();
  stream.write = (line, callback) => { lines.push(line); callback?.(); return true; };
  const log = createReadinessDiagnosticLogService({ stream, nowFn: () => clock });
  const diagnostics = createReadinessDiagnosticsService({ logService: log });
  return { diagnostics, log, stream, lines, advance: () => { clock += 15_000; } };
}
test('health projection is minimal and failure preserves original identity without raw text', async () => {
  const f = fixture(), original = Object.assign(new Error('secret SELECT /private/path admin@example.com'), { code: '42P01' });
  const service = createHealthReadinessService({ appPort: 3000, diagnostics: f.diagnostics, getOverview: async options => { options.onReadinessStage('active_jobs'); throw original; } });
  const result = await service.check(); assert.equal(result.failure, original); assert.equal(result.statusCode, 500);
  assert.equal(result.body.error.code, 'health_check_failed'); assert.ok(result.body.error.reference);
  assert.doesNotMatch(JSON.stringify([result.body, f.diagnostics.getSnapshot(), f.lines]), /secret|SELECT|private|example/u);
  const record = f.diagnostics.getSnapshot().recentFailures[0]; assert.equal(record.stage, 'active_jobs'); assert.equal(record.code, '42P01');
  await service.close();
  const success = createHealthReadinessService({ appPort: 3000, getOverview: async () => overview, diagnostics: fixture().diagnostics });
  assert.deepEqual((await success.check()).body, { ok: true, service: 'harmoniarr', startedAt: overview.service.startedAt, appPort: 3000, pendingMigrations: 0 });
  await success.close();
});
test('classification reads safe own scalars without getters or message inference', () => {
  const object = Object.defineProperty({}, 'code', { get() { throw new Error('must not execute'); } });
  assert.deepEqual(classifyReadinessFailure(object), { code: null, category: 'unknown', httpStatus: 500 });
  assert.equal(classifyReadinessFailure({ code: '57014' }).category, 'query_cancelled');
  assert.deepEqual(classifyReadinessFailure({ code: 'XX000' }), { code: 'XX000', category: 'database_query', httpStatus: 500 });
  assert.equal(classifyReadinessFailure({ code: 'ECONNRESET' }).httpStatus, 503);
  assert.equal(classifyReadinessFailure({ status: 409, message: 'timeout private' }).httpStatus, 409);
  assert.equal(classifyReadinessFailure(null).category, 'unknown');
});

test('invalid optional clock/reference providers cannot inject unbounded diagnostic strings', async () => {
  const records = [];
  const diagnostics = createReadinessDiagnosticsService({ nowFn: () => ({ toISOString: () => '/private clock' }), referenceFn: () => '/private reference',
    logService: { writeFailure: row => records.push(row), getState: () => ({}), close() {} } });
  const record = diagnostics.recordFailure({ error: { code: '/private code' }, stage: '/private stage', durationMs: Infinity });
  assert.equal(record.observedAt, null); assert.equal(record.reference, null); assert.equal(record.code, null); assert.equal(record.durationMs, 0);
  assert.doesNotMatch(JSON.stringify([records, diagnostics.getSnapshot()]), /private/u); await diagnostics.close();
});
test('failure history and log emission stay bounded under repeated failures and snapshots cannot mutate retained records', async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) f.diagnostics.recordFailure({ error: { code: 'ENOENT' }, stage: 'package_metadata', durationMs: i });
  let state = f.diagnostics.getSnapshot(); assert.equal(state.recentFailures.length, 16); assert.equal(state.failureCount, 100);
  assert.equal(f.lines.length, 1); assert.equal(state.log.suppressedCount, 99);
  state.recentFailures[0].stage = '/private'; state.lastCheck.outcome = 'changed';
  state = f.diagnostics.getSnapshot(); assert.equal(state.recentFailures[0].stage, 'package_metadata'); assert.equal(state.lastCheck.outcome, 'failed');
  f.advance(); f.diagnostics.recordFailure({ error: null, stage: 'private-stage', durationMs: -1 });
  assert.equal(f.lines.length, 2); assert.equal(f.diagnostics.getSnapshot().recentFailures[0].stage, 'unknown');
  await f.diagnostics.close();
});
test('backpressured output admits no more lines until drain and closing retires the listener', async () => {
  const f = fixture(); f.stream.write = (line, callback) => { f.lines.push(line); callback?.(); return false; };
  f.diagnostics.recordFailure({ error: null }); assert.equal(f.stream.listenerCount('drain'), 1);
  f.advance(); f.diagnostics.recordFailure({ error: null }); assert.equal(f.lines.length, 1);
  f.stream.emit('drain'); f.diagnostics.recordFailure({ error: null }); assert.equal(f.lines.length, 2);
  await f.diagnostics.close(); assert.equal(f.stream.listenerCount('drain'), 0); assert.equal(f.stream.listenerCount('error'), 0);
});

test('log callback/error completion is owned through close and asynchronous errors cannot escape', async () => {
  const f = fixture(); let callback;
  f.stream.write = (_line, done) => { callback = done; return true; };
  f.diagnostics.recordFailure({ error: null }); f.advance(); f.diagnostics.recordFailure({ error: null });
  let closed = false; const close = f.diagnostics.close().then(() => { closed = true; }); await Promise.resolve(); assert.equal(closed, false);
  callback(new Error('private sink error')); f.stream.emit('error', new Error('private sink error')); await close;
  assert.equal(f.diagnostics.getSnapshot().log.outputUnavailable, true);
  assert.equal(f.stream.listenerCount('error'), 0); assert.doesNotMatch(JSON.stringify(f.diagnostics.getSnapshot()), /private/u);
});
test('log failures cannot replace Error or null failure outcomes', async () => {
  for (const original of [new Error('original'), null]) {
    const f = fixture(); f.stream.write = () => { throw new Error('sink failed'); };
    const service = createHealthReadinessService({ diagnostics: f.diagnostics, getOverview: async () => { throw original; } });
    const result = await service.check(); assert.equal(result.failure, original); assert.equal(result.statusCode, 500);
    assert.equal(f.diagnostics.getSnapshot().log.suppressedCount, 1);
    await service.close();
  }
});
test('overlapping checks retain their own observed stage and shutdown drains actual completion', async () => {
  const f = fixture(), gates = [Promise.withResolvers(), Promise.withResolvers()], entered = Promise.withResolvers(); let calls = 0;
  const service = createHealthReadinessService({ diagnostics: f.diagnostics, getOverview: async options => {
    const index = calls++; options.onReadinessStage(index ? 'activity_feed' : 'migration_status'); if (calls === 2) entered.resolve();
    await gates[index].promise; throw Object.assign(new Error('private'), { code: index ? '42P01' : '57014' });
  } });
  const first = service.check(), second = service.check(); await entered.promise;
  let closed = false; const drain = service.close().then(() => { closed = true; }); await Promise.resolve(); assert.equal(closed, false);
  assert.equal((await service.check()).statusCode, 503); assert.equal(calls, 2);
  gates[1].resolve(); await second; assert.equal(closed, false); gates[0].resolve(); await first; await drain;
  assert.deepEqual(f.diagnostics.getSnapshot().recentFailures.map(row => row.stage), ['migration_status', 'activity_feed']);
});
test('overview stage observation identifies the actual failed boundary and cannot replace its error', async () => {
  const original = new Error('original');
  const service = createSystemService({ startedAt: new Date(), packageJsonPath: 'unused',
    readPackageMetadataFn: async () => ({ version: 'test' }), settingsService: { buildSettingsPayload: async () => ({ settings: {} }) },
    getMigrationStatusFn: async () => ({ applied: 115, pending: [] }), getPoolFn: () => ({ query: async () => ({ rows: [{ name: 'private' }] }) }),
    operationHistoryService: { countActiveOperationRuns: async () => { throw original; } } });
  const stages = [];
  await assert.rejects(service.getOverview({ includeDependencies: false, includeArtworkMaintenance: false, onReadinessStage: stage => stages.push(stage) }), error => error === original);
  assert.equal(stages.at(-1), 'active_jobs');
  await assert.rejects(service.getOverview({ includeDependencies: false, onReadinessStage: () => { throw new Error('observer'); } }), error => error === original);
});
