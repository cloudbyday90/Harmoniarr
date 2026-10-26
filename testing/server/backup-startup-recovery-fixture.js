/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createBackupArtifactFixture } from './backup-artifact-fixture.js';
import { createBackupArtifactFileOperationStore } from '/app/server-dist/recovery/backup-artifact-file-operation-store.js';
import { createTemporaryBackupArtifactPath } from '/app/server-dist/recovery/backup-artifact-file-service.js';
import { backupRecoveryFileByteLimit } from '/app/server-dist/recovery/backup-recovery-policy.js';

export async function seedBackupStartupRecovery(pool, root) {
  const store = createBackupArtifactFileOperationStore(), rows = [];
  const types = [...Array(29).fill('complete'), 'declared-large', 'actual-large', 'missing-tree', 'partial', 'unwritten'];
  for (const [index, type] of types.entries()) {
    const filename = 'startup-' + index + '.json', storagePath = join(root, 'case-' + index, filename);
    const draft = createBackupArtifactFixture({ storagePath, filename }), temporaryPath = createTemporaryBackupArtifactPath({ storagePath, token: 'fixture-' + index });
    if (type !== 'missing-tree') await mkdir(dirname(storagePath), { recursive: true, mode: 0o700 });
    if (type === 'complete' || type === 'partial' || type === 'actual-large') await writeFile(temporaryPath, type === 'partial' ? draft.content.slice(0, 32) : draft.content, { mode: 0o600 });
    if (type === 'actual-large') { const handle = await open(temporaryPath, 'r+'); try { await handle.truncate(backupRecoveryFileByteLimit + 1); } finally { await handle.close(); } }
    const operation = await store.createFileOperation({
artifactSnapshot: draft.artifact, filename, storagePath, temporaryPath, operationType: 'publish',
      expectedFileSha256: createHash('sha256').update(draft.content).digest('hex'), expectedFileSizeBytes: type === 'declared-large' ? backupRecoveryFileByteLimit + 1 : Buffer.byteLength(draft.content)
  });
    await pool.query("UPDATE backup_artifact_file_operations SET created_at='2026-01-01 00:00:00+00'::timestamptz+($2::int*interval '1 microsecond') WHERE id=$1", [operation.id, index]);
    rows.push({ type, draft, temporaryPath, id: operation.id });
  }
  assert.equal(rows.length, 34); return rows;
}
