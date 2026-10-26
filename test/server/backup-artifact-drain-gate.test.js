/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupArtifactDrainGate } from '../../src/server/recovery/backup-artifact-drain-gate.js';
import { createOwnedBackupArtifactService } from '../../src/server/recovery/owned-backup-artifact-service.js';

test('local backup admission is synchronous, nonqueued and retained until actual work settles', async () => {
  const gate = createBackupArtifactDrainGate();
  const finish = Promise.withResolvers();
  let admitted = 0;
  const task = gate.run(async () => { admitted++; return finish.promise; });
  try {
    await assert.rejects(gate.run(() => { admitted++; }), { code: 'backup_artifact_operation_busy', status: 409 });
    assert.equal(await gate.run(() => { admitted++; }, { onBusy: () => 'busy' }), 'busy');
    assert.equal(admitted, 1);
  } finally {
    finish.resolve('done');
    await task;
  }
  assert.equal(await gate.run(() => 'replacement'), 'replacement');
});

for (const primary of [new Error('controlled failure'), null]) {
  test(`local backup admission preserves ${primary === null ? 'null' : 'Error'} and admits work after settlement`, async () => {
    const gate = createBackupArtifactDrainGate();
    await assert.rejects(gate.run(() => { throw primary; }), error => error === primary);
    assert.equal(await gate.run(() => 'replacement'), 'replacement');
  });
}

test('independent production facades share local ownership through delayed session cleanup', async () => {
  const ready = Promise.withResolvers();
  const cleanup = Promise.withResolvers();
  let secondCheckouts = 0;
  const first = createOwnedBackupArtifactService({ ownershipStore: { withOwnership: async () => {
    ready.resolve();
    await cleanup.promise;
    throw Object.assign(new Error('lost session after admitted work'), { code: 'backup_artifact_owner_lost' });
  } } });
  const second = createOwnedBackupArtifactService({ ownershipStore: { withOwnership: async () => { secondCheckouts++; return 'admitted'; } } });
  const task = first.publishBackupArtifact().then(value => ({ value }), error => ({ error }));
  try {
    await ready.promise;
    for (const method of ['publishBackupArtifact', 'deleteBackupArtifact']) {
      await assert.rejects(second[method](), { code: 'backup_artifact_operation_busy' });
    }
    assert.deepEqual(await second.recoverIncompleteFileOperations(), {
      abandonedCount: 0, awaitingConfirmationCount: 0, completedCount: 0, deferredCount: 0, ownershipBusy: true,
    });
    assert.equal(secondCheckouts, 0);
  } finally {
    cleanup.resolve();
    await task;
  }
  assert.equal((await task).error.code, 'backup_artifact_owner_lost');
  assert.equal(await second.publishBackupArtifact(), 'admitted');
  assert.equal(secondCheckouts, 1);
});
