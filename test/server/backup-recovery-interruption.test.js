/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { hasIncompleteBackupRecoveryProgress } from '../../src/server/recovery/backup-recovery-progress-policy.js';
import { parseBackupRecoveryInterruptionMessage } from '../../testing/server/backup-recovery-interruption-plan.js';
import { startBackupRecoveryInterruptionProcess } from '../../testing/server/backup-recovery-interruption-process.js';

const caseName = 'crash-open-handle', runId = '00000000-0000-4000-8000-000000000001';
const context = { caseName, runId, pid: 123 };
const message = { event: 'checkpoint', caseName, runId, processPid: 123, openHandles: 1, backendPid: 456 };
function fixture() {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = 123;
  let killed = false; child.kill = () => { killed = true; };
  child.send = (_value, callback) => callback();
  const process = startBackupRecoveryInterruptionProcess({ caseName, runId, root: '/app/data/fixture/backups', spawnFn: (_command, _args, options) => { assert.equal(options.shell, false); assert.equal(options.windowsHide, true); return child; } });
  return { child, process, killed: () => killed };
}
test('progress caveat comes from durable recovery or explicit interrupted work and remains conservative', () => {
  assert.equal(hasIncompleteBackupRecoveryProgress(null), false);
  assert.equal(hasIncompleteBackupRecoveryProgress({ progressMayBeIncomplete: 'true', recoveryDetectedAt: 'invalid' }), false);
  assert.equal(hasIncompleteBackupRecoveryProgress({ progressMayBeIncomplete: true }), true);
  assert.equal(hasIncompleteBackupRecoveryProgress({ recoveryDetectedAt: '2026-10-26T12:00:00Z' }), true);
});
test('interruption messages bind finite case, process, run and exact proof fields', () => {
  assert.deepEqual(parseBackupRecoveryInterruptionMessage(message, context), message);
  for (const change of [{ processPid: 2 }, { runId: 'wrong' }, { caseName: 'wrong' }, { extra: true }, { backendPid: 0 }, { openHandles: 2 }]) assert.throws(() => parseBackupRecoveryInterruptionMessage({ ...message, ...change }, context));
  const finished = { event: 'finished', caseName, runId, processPid: 123, openHandles: 0, drained: true };
  assert.deepEqual(parseBackupRecoveryInterruptionMessage(finished, context), finished);
  assert.throws(() => parseBackupRecoveryInterruptionMessage({ ...finished, drained: false }, context));
});
test('termination waits for observed process and stdio close', async () => {
  const f = fixture(); f.child.emit('message', message); await f.process.waitFor('checkpoint');
  let settled = false; const task = f.process.crash().finally(() => { settled = true; });
  await Promise.resolve(); assert.equal(f.killed(), true); assert.equal(settled, false);
  f.child.emit('close', null, 'SIGKILL'); await task; assert.equal(f.process.isClosed(), true); await f.process.dispose();
});
test('protocol and output failures remain terminal and cleanup observes close', async () => {
  for (const overflow of [false, true]) {
    const f = fixture();
    if (overflow) f.child.stderr.emit('data', Buffer.alloc(32769)); else f.child.emit('message', { ...message, processPid: 1 });
    f.child.emit('message', message);
    await assert.rejects(f.process.waitFor('checkpoint'), { code: overflow ? 'recovery_output_budget' : 'recovery_protocol_failed' });
    const cleanup = f.process.dispose(); assert.equal(f.killed(), true); f.child.emit('close', null, 'SIGKILL'); await cleanup;
  }
});

test('invalid run identity or escaped fixture root refuses child launch', () => {
  let launched = false;
  for (const change of [{ runId: '-'.repeat(36) }, { root: '/app/data/../../elsewhere' }, { caseName: 'unknown' }]) {
    assert.throws(() => startBackupRecoveryInterruptionProcess({ caseName, runId, root: '/app/data/fixture/backups', ...change, spawnFn: () => { launched = true; } }));
  }
  assert.equal(launched, false);
});
