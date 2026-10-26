/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readBackupRecoveryHandle } from '../../src/server/recovery/backup-recovery-file-reader.js';
import { createBackupArtifactFileOperationService } from '../../src/server/recovery/backup-artifact-file-operation-service.js';
import { createBackupArtifactFileOperationStore } from '../../src/server/recovery/backup-artifact-file-operation-store.js';
import { backupRecoveryFileByteLimit } from '../../src/server/recovery/backup-recovery-policy.js';

test('automatic handle reader bounds growth beyond declared size and refuses oversized files before reads', async () => {
  let reads = 0;
  await assert.rejects(readBackupRecoveryHandle({ stat: async () => ({ size: 11 }), read: async () => { reads++; } }, 10), { code: 'backup_recovery_file_limit' }); assert.equal(reads, 0);
  const handle = { stat: async () => ({ size: 2 }), read: async (buffer, offset, length) => { reads++; buffer.fill(1, offset, offset + length); return { bytesRead: length }; } };
  await assert.rejects(readBackupRecoveryHandle(handle, 10), { code: 'backup_recovery_file_limit' }); assert.equal(reads, 1);
  let position = 0; const source = Buffer.from('bounded');
  const result = await readBackupRecoveryHandle({
stat: async () => ({ size: source.length }), read: async (buffer, offset, length) => {
      const size = Math.min(length, source.length - position); source.copy(buffer, offset, position, position + size); position += size; return { bytesRead: size };
    }
}, 10); assert.equal(result.toString(), 'bounded');
  });
test('ordered recovery page preserves exact microsecond cursor and bounded lookahead parameters', async () => {
  let call; const store = createBackupArtifactFileOperationStore({ getPoolFn: () => ({ query: async (sql, values) => { call = { sql, values }; return { rows: [{ id: '00000000-0000-4000-8000-000000000001', created_at: new Date(), recovery_cursor_created_at: '2026-10-26 12:00:00.123456+00' }] }; } }) });
  const through = '2026-10-26 13:00:00.987654+00', after = { createdAt: '2026-10-26 12:00:00.123455+00', id: '00000000-0000-4000-8000-000000000000' };
  const result = await store.listIncompleteFileOperationPage({ through, after });
  assert.equal(result[0].cursor.createdAt, '2026-10-26 12:00:00.123456+00'); assert.deepEqual(call.values, [through, after.createdAt, after.id, 26]); assert.match(call.sql, /ORDER BY created_at ASC,id ASC LIMIT/u);
  await assert.rejects(store.listIncompleteFileOperationPage({ through: 'invalid' }), TypeError);
  });
test('automatic pages progress beyond confirmation and oversized entries without mutating them', async () => {
  const rows = Array.from({ length: 26 }, (_, index) => ({
operation: { id: String(index), status: index % 2 ? 'prepared' : 'awaiting_confirmation', expectedFileSizeBytes: backupRecoveryFileByteLimit + 1 },
    cursor: { createdAt: '2026-10-26 12:00:00.123456+00', id: String(index) }
}));
  const service = createBackupArtifactFileOperationService({
maxRecoveryFileSizeBytes: backupRecoveryFileByteLimit, listIncompleteFileOperationPage: async () => rows,
    updateFileOperation: async () => { throw new Error('must not mutate held/oversized entries'); }
  });
  const result = await service.recoverIncompleteFileOperationPage({ through: '2026-10-26' });
  assert.equal(result.processedCount, 25); assert.equal(result.awaitingConfirmationCount, 13); assert.equal(result.deferredCount, 12); assert.equal(result.hasMore, true); assert.deepEqual(result.cursor, rows[24].cursor);
  });
test('admission deadline stops between operations rather than discarding admitted work', async () => {
  let time = 0; const rows = [1, 2].map(id => ({ operation: { id, status: 'awaiting_confirmation' }, cursor: { createdAt: '2026-10-26', id: String(id) } }));
  const service = createBackupArtifactFileOperationService({ listIncompleteFileOperationPage: async () => rows, nowFn: () => { time += 5001; return time; } });
  const result = await service.recoverIncompleteFileOperationPage({ through: '2026-10-26' }); assert.equal(result.processedCount, 1); assert.equal(result.hasMore, true); assert.equal(result.cursor.id, '1');
  });
