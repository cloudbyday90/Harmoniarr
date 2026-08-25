import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';

function createRow(overrides = {}) {
  return {
    artifact_snapshot_json: { filename: 'backup.json' },
    backup_artifact_id: null,
    completed_at: null,
    created_at: new Date('2026-08-25T12:00:00.000Z'),
    created_by_user_id: 'user-1',
    expected_file_sha256: 'a'.repeat(64),
    expected_file_size_bytes: '42',
    filename: 'backup.json',
    id: 'operation-1',
    last_error_code: null,
    last_error_message: null,
    operation_type: 'publish',
    status: 'prepared',
    storage_path: '/backups/backup.json',
    temporary_path: '/backups/.backup.json.operation-1.partial',
    updated_at: new Date('2026-08-25T12:00:00.000Z'),
    ...overrides,
  };
}

test('backup artifact file operation store persists durable publication intent before filesystem work', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [createRow()] }));
  const store = createBackupArtifactFileOperationStore({ getPoolFn: () => ({ query }) });

  const operation = await store.createFileOperation({
    artifactSnapshot: { filename: 'backup.json' },
    createdByUserId: 'user-1',
    expectedFileSha256: 'a'.repeat(64),
    expectedFileSizeBytes: 42,
    filename: 'backup.json',
    operationType: 'publish',
    storagePath: '/backups/backup.json',
    temporaryPath: '/backups/.backup.json.operation-1.partial',
  });

  assert.equal(operation.status, 'prepared');
  assert.equal(operation.expectedFileSizeBytes, 42);
  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO backup_artifact_file_operations/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'publish',
    null,
    'backup.json',
    '/backups/backup.json',
    '/backups/.backup.json.operation-1.partial',
    '{"filename":"backup.json"}',
    'a'.repeat(64),
    42,
    'user-1',
  ]);
});

test('backup artifact file operation store only lists recoverable operation states', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [createRow({ status: 'awaiting_confirmation' })] }));
  const store = createBackupArtifactFileOperationStore({ getPoolFn: () => ({ query }) });

  const operations = await store.listIncompleteFileOperations();

  assert.equal(operations[0].status, 'awaiting_confirmation');
  assert.match(query.mock.calls[0].arguments[0], /status IN \('prepared', 'temporary_ready', 'finalized', 'awaiting_confirmation'\)/);
});

test('backup artifact file operation store records completion and the linked inventory row', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [createRow({ backup_artifact_id: 'artifact-1', status: 'completed' })] }));
  const store = createBackupArtifactFileOperationStore({ getPoolFn: () => ({ query }) });

  const operation = await store.updateFileOperation({
    backupArtifactId: 'artifact-1',
    fileOperationId: 'operation-1',
    status: 'completed',
  });

  assert.equal(operation.backupArtifactId, 'artifact-1');
  assert.equal(operation.status, 'completed');
  assert.match(query.mock.calls[0].arguments[0], /completed_at = CASE WHEN \$7 THEN NOW\(\)/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'operation-1',
    'completed',
    true,
    'artifact-1',
    null,
    null,
    true,
  ]);
});
