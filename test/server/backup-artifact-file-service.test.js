import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import {
  createBackupArtifactFileService,
  createTemporaryBackupArtifactPath,
} from '../../src/server/recovery/backup-artifact-file-service.js';

test('createTemporaryBackupArtifactPath keeps the temporary file beside the final artifact', () => {
  const storagePath = join(tmpdir(), 'harmoniarr-backups', 'harmoniarr_backup.json');
  const temporaryPath = createTemporaryBackupArtifactPath({ storagePath, token: 'operation-1' });

  assert.equal(dirname(temporaryPath), dirname(storagePath));
  assert.equal(basename(temporaryPath), '.harmoniarr_backup.json.operation-1.partial');
});

test('writePrivateTemporaryFile flushes a private file that can be promoted without partial visibility', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-file-service-'));
  const storagePath = join(directory, 'backup.json');
  const temporaryPath = createTemporaryBackupArtifactPath({ storagePath, token: 'operation-1' });
  const service = createBackupArtifactFileService();
  t.after(async () => rm(directory, { force: true, recursive: true }));

  await service.writePrivateTemporaryFile({
    content: '{"backup":true}\n',
    temporaryPath,
  });

  assert.equal(await readFile(temporaryPath, 'utf8'), '{"backup":true}\n');
  await assert.rejects(
    () => service.writePrivateTemporaryFile({ content: '{"replacement":true}\n', temporaryPath }),
    { code: 'EEXIST' },
  );

  await service.promoteTemporaryFile({ storagePath, temporaryPath });

  assert.equal(await readFile(storagePath, 'utf8'), '{"backup":true}\n');
  await assert.rejects(() => readFile(temporaryPath), { code: 'ENOENT' });
});

test('removeFileIfPresent distinguishes an already-absent file from deletion', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-file-remove-'));
  const storagePath = join(directory, 'backup.json');
  const service = createBackupArtifactFileService();
  t.after(async () => rm(directory, { force: true, recursive: true }));

  assert.deepEqual(await service.removeFileIfPresent({ storagePath }), { removed: false });
});
