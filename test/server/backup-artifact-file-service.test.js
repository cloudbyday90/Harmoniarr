import assert from 'node:assert/strict';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  assert.equal(await readFile(temporaryPath, 'utf8'), '{"backup":true}\n');
  await service.removeLinkedTemporaryFile({ storagePath, temporaryPath });

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


test('exclusive promotion preserves a destination created after the caller inspected it', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-exclusive-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const temporaryPath = join(directory, 'temporary'), storagePath = join(directory, 'final'); const service = createBackupArtifactFileService();
  await service.writePrivateTemporaryFile({ content: 'owned bytes', temporaryPath });
  await writeFile(storagePath, 'unrelated bytes', { flag: 'wx' });
  await assert.rejects(service.promoteTemporaryFile({ temporaryPath, storagePath }), { code: 'EEXIST' });
  assert.equal(await readFile(storagePath, 'utf8'), 'unrelated bytes'); assert.equal(await readFile(temporaryPath, 'utf8'), 'owned bytes');
});

test('exclusive publication leaves complete dual names and cleanup refuses a different temporary inode', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-identity-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const temporaryPath = join(directory, 'temporary'), storagePath = join(directory, 'final'); const service = createBackupArtifactFileService();
  await service.writePrivateTemporaryFile({ content: 'identical bytes', temporaryPath }); await service.promoteTemporaryFile({ temporaryPath, storagePath });
  assert.equal((await lstat(temporaryPath)).ino, (await lstat(storagePath)).ino);
  await rm(temporaryPath); await writeFile(temporaryPath, 'identical bytes');
  await assert.rejects(service.removeLinkedTemporaryFile({ temporaryPath, storagePath }), { code: 'backup_artifact_temporary_identity_mismatch' });
  assert.equal(await readFile(temporaryPath, 'utf8'), 'identical bytes'); assert.equal(await readFile(storagePath, 'utf8'), 'identical bytes');
});

test('unsupported hard links fail closed without copy or rename fallback', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-backup-unsupported-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const temporaryPath = join(directory, 'temporary'), storagePath = join(directory, 'final');
  const service = createBackupArtifactFileService({ linkFn: async () => { throw Object.assign(new Error('unsupported'), { code: 'ENOTSUP' }); } });
  await service.writePrivateTemporaryFile({ content: 'owned bytes', temporaryPath });
  await assert.rejects(service.promoteTemporaryFile({ temporaryPath, storagePath }), { code: 'ENOTSUP' });
  await assert.rejects(readFile(storagePath), { code: 'ENOENT' }); assert.equal(await readFile(temporaryPath, 'utf8'), 'owned bytes');
});
