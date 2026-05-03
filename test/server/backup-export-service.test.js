import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  assert.equal(payload.data.scopeSettings.settings.system.baseUrl, 'https://harmoniarr.local');
  assert.equal(payload.data.scopeSettings.pathMappings.paths.downloadMappings.length, 1);
  assert.deepEqual(payload.data.scopeSettings.monitoring.artistMonitoring, []);
  assert.deepEqual(payload.data.scopeSettings.overrides.manualOverrides, []);
  assert.deepEqual(payload.data.scopeSettings.trust.sourceUsers, []);
  assert.deepEqual(payload.data.scopeSettings.wanted.wantedReleases, []);
});

test('createBackupExport includes monitoring and wanted snapshots when provided', async (t) => {
  const backupsDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-backups-scope-snapshots-'));
  let capturedArtifact = null;
  const service = createBackupExportService({
    backupsDirectory,
    createBackupArtifact: async (artifact) => {
      capturedArtifact = artifact;
      return {
        ...artifact,
        id: 'backup-artifact-scoped',
      };
    },
    getMigrationStatusFn: async () => ({
      applied: 42,
      pending: [],
    }),
    loadSettingsFn: async () => ({
      paths: {
        downloadMappings: [],
        userMusicRoots: [],
      },
      system: {
        baseUrl: 'https://harmoniarr.local',
      },
    }),
    listArtistMonitoringForBackup: async () => ([
      {
        metadataArtistId: 'artist-1',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album'],
      },
    ]),
    listOverridesSnapshotForBackup: async () => ([
      {
        scope: 'release',
        targetId: 'release-1',
        decision: 'prefer',
      },
    ]),
    listTrustSnapshotForBackup: async () => ([
      {
        username: 'trusted-uploader',
        trustState: 'trusted',
      },
    ]),
    listWantedReleasesForBackup: async () => ([
      {
        metadataArtistId: 'artist-1',
        metadataReleaseGroupId: 'rg-1',
        metadataReleaseId: 'release-1',
        wantedStatus: 'missing',
        expectedTrackCount: 12,
        matchedTrackCount: 0,
        missingTrackCount: 12,
      },
    ]),
    packageJsonPath: '/ignored/package.json',
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    recordAuditEventFn: async () => {},
  });

  t.after(async () => {
    await rm(backupsDirectory, { force: true, recursive: true });
  });

  await service.createBackupExport();
  const serialized = await readFile(capturedArtifact.storagePath, 'utf8');
  const payload = JSON.parse(serialized);

  assert.equal(payload.data.scopeSettings.monitoring.artistMonitoring.length, 1);
  assert.equal(payload.data.scopeSettings.monitoring.artistMonitoring[0].metadataArtistId, 'artist-1');
  assert.equal(payload.data.scopeSettings.overrides.manualOverrides.length, 1);
  assert.equal(payload.data.scopeSettings.overrides.manualOverrides[0].targetId, 'release-1');
  assert.equal(payload.data.scopeSettings.trust.sourceUsers.length, 1);
  assert.equal(payload.data.scopeSettings.trust.sourceUsers[0].username, 'trusted-uploader');
  assert.equal(payload.data.scopeSettings.wanted.wantedReleases.length, 1);
  assert.equal(payload.data.scopeSettings.wanted.wantedReleases[0].metadataReleaseId, 'release-1');
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

test('getBackupExportDownloadById returns payload for managed backup artifact', async (t) => {
  const backupsDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-backups-download-'));
  const storagePath = join(backupsDirectory, 'harmoniarr_backup_2026-05-02T14-00-00-000Z.json');

  const service = createBackupExportService({
    backupsDirectory,
    getBackupArtifactById: async () => ({
      id: 'backup-artifact-77',
      filename: 'harmoniarr_backup_2026-05-02T14-00-00-000Z.json',
      storagePath,
    }),
    packageJsonPath: '/ignored/package.json',
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
  });

  t.after(async () => {
    await rm(backupsDirectory, { force: true, recursive: true });
  });

  await rm(storagePath, { force: true });
  await writeFile(storagePath, '{"backup":true}\n', 'utf8');

  const result = await service.getBackupExportDownloadById({ backupArtifactId: 'backup-artifact-77' });
  assert.equal(result.backupArtifact.id, 'backup-artifact-77');
  assert.equal(result.filename, 'harmoniarr_backup_2026-05-02T14-00-00-000Z.json');
  assert.equal(result.contentType, 'application/json; charset=utf-8');
  assert.equal(result.content.toString('utf8'), '{"backup":true}\n');
});

test('deleteBackupExportById removes metadata when payload file is already missing', async (t) => {
  const backupsDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-backups-delete-'));
  const storagePath = join(backupsDirectory, 'harmoniarr_backup_2026-05-02T15-00-00-000Z.json');
  const deleteBackupArtifactById = t.mock.fn(async () => ({
    id: 'backup-artifact-88',
    filename: 'harmoniarr_backup_2026-05-02T15-00-00-000Z.json',
    storagePath,
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});

  const service = createBackupExportService({
    backupsDirectory,
    deleteBackupArtifactById,
    getBackupArtifactById: async () => ({
      id: 'backup-artifact-88',
      filename: 'harmoniarr_backup_2026-05-02T15-00-00-000Z.json',
      storagePath,
    }),
    packageJsonPath: '/ignored/package.json',
    readPackageMetadataFn: async () => ({ version: '0.1.0-beta' }),
    recordAuditEventFn,
  });

  t.after(async () => {
    await rm(backupsDirectory, { force: true, recursive: true });
  });

  const result = await service.deleteBackupExportById({
    backupArtifactId: 'backup-artifact-88',
    requestMetadata: {
      ipAddress: '198.51.100.65',
      userAgent: 'HarmoniarrBackupDeleteServiceTest/1.0',
    },
    triggeredByUserId: 'user-88',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.backupArtifact.id, 'backup-artifact-88');
  assert.equal(result.fileDeleted, false);
  assert.equal(deleteBackupArtifactById.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});
