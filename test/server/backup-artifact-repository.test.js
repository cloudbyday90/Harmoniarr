import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackupArtifactRepository } from '../../src/server/recovery/backup-artifact-repository.js';

function createArtifactRow(overrides = {}) {
  return {
    app_version: '0.1.0-beta',
    backup_type: 'logical',
    created_at: new Date('2026-08-25T12:00:00.000Z'),
    created_by_user_id: 'user-1',
    encrypted: true,
    encryption_key_fingerprint: 'a'.repeat(64),
    file_size_bytes: '1234',
    filename: 'harmoniarr_backup.json',
    format_version: '1',
    id: 'artifact-1',
    manifest_json: { formatVersion: '1' },
    migration_level: 'applied:99',
    payload_sha256: 'b'.repeat(64),
    scope_json: ['settings'],
    storage_path: '/backups/harmoniarr_backup.json',
    ...overrides,
  };
}

test('getBackupArtifactByFilename resolves the existing artifact for interrupted publication recovery', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [createArtifactRow()] }));
  const repository = createBackupArtifactRepository({ getPoolFn: () => ({ query }) });

  const artifact = await repository.getBackupArtifactByFilename({ filename: 'harmoniarr_backup.json' });

  assert.equal(artifact.id, 'artifact-1');
  assert.equal(artifact.fileSizeBytes, 1234);
  assert.match(query.mock.calls[0].arguments[0], /WHERE filename = \$1/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['harmoniarr_backup.json']);
});
