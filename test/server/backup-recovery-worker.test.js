/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupRecoveryWorker } from '../../src/server/recovery/backup-recovery-worker.js';
import { createBackupRecoveryStartupService } from '../../src/server/recovery/backup-recovery-startup-service.js';
const lease = { leaseKey: 'backup_artifact_recovery:run', ownerInstanceId: 'instance', acquisitionId: '00000000-0000-4000-8000-000000000001', releasedAt: null, expiresAt: '2099-01-01T00:00:00.000Z' };
function fixture({ page = async () => ({ processedCount: 1, completedCount: 1, hasMore: false }), interruption = false, renewal = null } = {}) {
  const calls = []; let current = lease;
  const store = {
acquireLease: async () => lease, getLease: async () => current, isCancellationRequested: async () => interruption,
    releaseLease: async input => { calls.push(['release', input]); }, renewLease: async () => lease,
    ...Object.fromEntries(['Started', 'Completed', 'Failed', 'Paused', 'Cancelled'].map(name => ['markRun' + name, async input => { calls.push([name, input]); return true; }]))
};
  const worker = createBackupRecoveryWorker({
runStore: store, recoveryService: { recoverIncompleteFileOperationPage: page },
    createHeartbeat: () => ({ start() { }, signal: new AbortController().signal, stopAndDrain: async () => { if (renewal) await renewal; calls.push(['drained']); } })
  });
  return { worker, calls, lose: () => { current = null; }, start: () => worker.startWorkerRun({ run: { id: 'run', summary: { backupRecoveryThrough: '2026-10-26' } } }).completion };
}
test('worker returns actual completion through admitted recovery, heartbeat drain and release', async () => {
  const gate = Promise.withResolvers(), drain = Promise.withResolvers(), entered = Promise.withResolvers();
  const f = fixture({ page: async () => { entered.resolve(); await gate.promise; return { completedCount: 1, processedCount: 1, hasMore: false }; }, renewal: drain.promise });
  let done = false; const task = f.start().finally(() => { done = true; }); await entered.promise; assert.equal(done, false); gate.resolve(); await new Promise(resolve => { setImmediate(resolve); });
  assert.equal(done, false); assert.equal(f.calls.some(([name]) => name === 'release'), false); drain.resolve(); await task; assert.deepEqual(f.calls.slice(-2).map(row => row[0]), ['drained', 'release']); await f.worker.close();
  });
test('continuation persists counts/cursor and pauses rather than consuming a failure retry', async () => {
  const cursor = { createdAt: '2026-10-26', id: 'cursor' };
  const f = fixture({ page: async () => ({ completedCount: 2, processedCount: 2, cursor, hasMore: true }) }); await f.start();
  const saved = f.calls.find(([name]) => name === 'Paused')[1]; assert.equal(saved.summary.completedCount, 2); assert.deepEqual(saved.summary.backupRecoveryAfter, cursor); assert.equal(f.calls.at(-1)[1].status, 'paused'); await f.worker.close();
  });
test('cancellation and lost acquisition refuse admitted page work', async () => {
  let admitted = 0; const f = fixture({ interruption: true, page: async () => { admitted++; } }); await f.start(); assert.equal(admitted, 0); assert.ok(f.calls.some(([name]) => name === 'Cancelled')); await f.worker.close();
  const lost = fixture({ page: async input => { lost.lose(); await input.assertRecoveryAuthority(); } }); await lost.start(); assert.ok(!lost.calls.some(([name]) => name === 'Completed')); await lost.worker.close();
  });
test('worker records fixed safe failure without raw filesystem/provider content', async () => {
  const f = fixture({ page: async () => { throw new Error('private /data/music secret'); } }); await f.start();
  const saved = f.calls.find(([name]) => name === 'Failed')[1]; assert.doesNotMatch(saved.errorMessage, /private|secret|music/u); await f.worker.close();
  });
test('startup admission is one owned task with bounded retries and visible failure', async () => {
  let attempts = 0; const service = createBackupRecoveryStartupService({ queueStartupRecovery: async () => { attempts++; throw new Error('private'); }, delayFn: async () => { } });
  service.start(); service.start(); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(attempts, 3); assert.equal(service.getState(), 'failed'); await service.stopAndDrain();
  });
