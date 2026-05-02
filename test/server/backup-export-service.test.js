import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBackupExportService } from '../../src/server/recovery/backup-export-service.js';

test('createBackupExport writes backup artifact and persists metadata', async (t) => {
  const backupsDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-backups-'));
  const createdArtifacts = [];
  const createBackupArtifact = t.mock.fn(async (artifact) => {
    createdArtifacts.push(artifact);

    return {
      ...artifact,
      createdAt: '2026-05-02T13:00:00.000Z',
      id: 'backup-artifact-1',
    };
  });
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createBackupExportService({
    backupsDirectory,
    createBackupArtifact,
    getMigrationStatusFn: async () => ({
      applied: 42,
      pending: [],
    }),
    loadSettingsFn: async () => ({
      paths: {
        downloadMappings: [{ localPathPrefix: '/downloads', remotePathPrefix: '/downloads' }],
        userMusicRoots: [{ id: 'root-1', rootPath: '/music' }],
      },
      system: {
        baseUrl: 'https://harmoniarr.local',
      },
    }),
    packageJsonPath: '/ignored/package.json',
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    recordAuditEventFn,
  });

  t.after(async () => {
    await rm(backupsDirectory, { force: true, recursive: true });
  });

  const result = await service.createBackupExport({
    requestMetadata: {
      ipAddress: '203.0.113.41',
      userAgent: 'HarmoniarrBackupExportTest/1.0',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.backupArtifact.id, 'backup-artifact-1');
  assert.equal(createBackupArtifact.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(createdArtifacts[0].scope.includes('settings'), true);

  const serialized = await readFile(createdArtifacts[0].storagePath, 'utf8');
  const payload = JSON.parse(serialized);

  assert.equal(payload.formatVersion, '1');
  assert.equal(payload.backup.type, 'logical');
  assert.equal(payload.authRecovery.interactiveAuthIncluded, false);
  assert.equal(payload.data.settings.system.baseUrl, 'https://harmoniarr.local');
});

test('getBackupExportById throws when backup artifact does not exist', async () => {
  const service = createBackupExportService({
    getBackupArtifactById: async () => null,
    packageJsonPath: '/ignored/package.json',
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
  });

  await assert.rejects(
    () => service.getBackupExportById({ backupArtifactId: 'missing' }),
    (error) => error.code === 'backup_artifact_not_found',
  );
});
