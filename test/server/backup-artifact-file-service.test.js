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

test('temporary write/sync failure keeps exact precedence through every close outcome', async () => {
  const original = Object.freeze(new Error('primary work failure'));
  for (const stage of ['write', 'sync']) {
    for (const primary of [original, null, undefined]) {
      for (const closeFailure of [false, new Error('secondary close failure'), null]) {
        const calls = [];
        const service = createBackupArtifactFileService({ mkdirFn: async () => {}, openFn: async (_path, flags, mode) => {
          assert.equal(flags, 'wx'); assert.equal(mode, 0o600);
          return {
            writeFile: async () => { calls.push('write'); if (stage === 'write') throw primary; },
            sync: async () => { calls.push('sync'); if (stage === 'sync') throw primary; },
            close: async () => { calls.push('close'); if (closeFailure !== false) throw closeFailure; },
          };
        } });
        await assert.rejects(service.writePrivateTemporaryFile({ content: 'fixture', temporaryPath: '/unused/fixture.partial' }), error => error === primary);
        assert.deepEqual(calls, stage === 'write' ? ['write', 'close'] : ['write', 'sync', 'close']);
      }
    }
  }
});

test('close-only failure remains visible and an unsuccessful open has no handle to close', async () => {
  for (const closeFailure of [new Error('close-only failure'), null, undefined]) {
    let closed = 0;
    const service = createBackupArtifactFileService({ mkdirFn: async () => {}, openFn: async () => ({
      writeFile: async () => {}, sync: async () => {}, close: async () => { closed++; throw closeFailure; },
    }) });
    await assert.rejects(service.writePrivateTemporaryFile({ content: 'fixture', temporaryPath: '/unused/fixture.partial' }), error => error === closeFailure);
    assert.equal(closed, 1);
  }
  const openFailure = new Error('open failed');
  const service = createBackupArtifactFileService({ mkdirFn: async () => {}, openFn: async () => { throw openFailure; } });
  await assert.rejects(service.writePrivateTemporaryFile({ content: 'fixture', temporaryPath: '/unused/fixture.partial' }), error => error === openFailure);
});

test('temporary writer retains its failure until delayed close settles', async () => {
  const ready = Promise.withResolvers(), finish = Promise.withResolvers();
  const primary = Object.freeze(new Error('work failed'));
  let settled = false;
  const service = createBackupArtifactFileService({ mkdirFn: async () => {}, openFn: async () => ({
    writeFile: async () => { throw primary; }, sync: async () => { assert.fail('sync after failed write'); },
    close: async () => { ready.resolve(); await finish.promise; throw new Error('close failed later'); },
  }) });
  const task = service.writePrivateTemporaryFile({ content: 'fixture', temporaryPath: '/unused/fixture.partial' })
    .then(value => ({ value }), error => ({ error })).then(outcome => { settled = true; return outcome; });
  try { await ready.promise; assert.equal(settled, false); }
  finally { finish.resolve(); await task; }
  assert.equal((await task).error, primary);
});
