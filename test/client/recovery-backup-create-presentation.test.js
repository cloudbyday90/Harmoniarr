import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecoveryBackupCreateStatus } from '../../src/client/lib/recovery-backup-create-presentation.js';

test('recovery backup create presentation reports a polite in-progress state', () => {
  assert.deepEqual(buildRecoveryBackupCreateStatus({ isCreating: true }), {
    message: 'Creating backup. You can review it when it is ready.',
    state: 'creating',
  });
});

test('recovery backup create presentation confirms a created artifact without storage details', () => {
  assert.deepEqual(buildRecoveryBackupCreateStatus({
    lastCreatedBackupArtifact: { id: 'backup-1', storagePath: '/private/backups/backup-1.json' },
  }), {
    message: 'Backup created. Review it in backup history below.',
    state: 'created',
  });
});

test('recovery backup create presentation is idle before an action', () => {
  assert.deepEqual(buildRecoveryBackupCreateStatus(), {
    message: '',
    state: 'idle',
  });
});
