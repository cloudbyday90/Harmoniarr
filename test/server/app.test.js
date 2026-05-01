import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

test('createApp composes shared modules and preserves api and spa fallbacks', async (t) => {
  const clientDistDir = await mkdtemp(join(tmpdir(), 'harmoniarr-app-test-'));
  const startedAt = new Date('2026-04-28T12:00:00.000Z');
  const authModule = { routeDependencies: { auth: 'deps' } };
  const importCandidateModule = { routeDependencies: { importCandidates: 'deps' } };
  const libraryModule = {
    libraryScanSummaryService: { buildLibraryScanSummary: () => ({}) },
    routeDependencies: { library: 'deps' },
  };
  const metadataModule = {
    musicBrainzSearchService: { checkProviderHealth: t.mock.fn(async () => ({ status: 'healthy' })) },
    routeDependencies: { metadata: 'deps' },
  };
  const settingsService = { buildSettingsPayload: () => {}, updateSettings: () => {} };
  const slskdTransferSnapshotService = {
    buildTransferSnapshot: () => {},
  };
  const slskdModule = {
    routeDependencies: { slskd: 'deps' },
    slskdService: {
      getConnectionStatus: t.mock.fn(async () => ({
        provider: 'slskd',
        status: 'healthy',
        details: {
          isConnected: true,
          isLoggedIn: true,
          isTransitioning: false,
        },
      })),
    },
    slskdTransferSnapshotService,
  };
  const systemModule = { routeDependencies: { system: 'deps' } };
  const createAuthModule = t.mock.fn(() => authModule);
  const createImportCandidateModule = t.mock.fn(() => importCandidateModule);
  const createLibraryModule = t.mock.fn(() => libraryModule);
  const createMetadataModule = t.mock.fn(() => metadataModule);
  const createSettingsService = t.mock.fn(() => settingsService);
  const createSlskdModule = t.mock.fn(() => slskdModule);
  const createSystemModule = t.mock.fn(() => systemModule);
  const registerAuthRoutes = t.mock.fn();
  const registerImportCandidateRoutes = t.mock.fn();
  const registerLibraryRoutes = t.mock.fn();
  const registerMetadataRoutes = t.mock.fn();
  const registerSlskdRoutes = t.mock.fn();
  const registerSystemRoutes = t.mock.fn();

  await writeFile(join(clientDistDir, 'index.html'), '<!doctype html><html><body>Harmoniarr App Shell</body></html>');

  t.after(async () => {
    await rm(clientDistDir, { recursive: true, force: true });
  });

  const { app, appPort, importCandidateModule: composedImportCandidateModule } = createApp({
    appPort: 4510,
    clientDistDir,
    packageJsonPath: 'C:/virtual/package.json',
    startedAt,
    createAuthModule,
    createImportCandidateModule,
    createLibraryModule,
    createMetadataModule,
    createSettingsService,
    createSlskdModule,
    createSystemModule,
    registerAuthRoutes,
    registerImportCandidateRoutes,
    registerLibraryRoutes,
    registerMetadataRoutes,
    registerSlskdRoutes,
    registerSystemRoutes,
  });

  assert.equal(appPort, 4510);
  assert.equal(composedImportCandidateModule, importCandidateModule);
  assert.equal(createAuthModule.mock.callCount(), 1);
  assert.equal(createImportCandidateModule.mock.callCount(), 1);
  assert.equal(createLibraryModule.mock.callCount(), 1);
  assert.equal(createMetadataModule.mock.callCount(), 1);
  assert.equal(createSettingsService.mock.callCount(), 1);
  assert.equal(createSlskdModule.mock.callCount(), 1);
  assert.equal(createSystemModule.mock.callCount(), 1);
  const authModuleArgs = createAuthModule.mock.calls[0].arguments[0];
  const metadataModuleArgs = createMetadataModule.mock.calls[0].arguments[0];
  const importCandidateModuleArgs = createImportCandidateModule.mock.calls[0].arguments[0];
  const libraryModuleArgs = createLibraryModule.mock.calls[0].arguments[0];
  const slskdModuleArgs = createSlskdModule.mock.calls[0].arguments[0];
  const systemModuleArgs = createSystemModule.mock.calls[0].arguments[0];

  assert.equal(authModuleArgs.settingsService, settingsService);
  assert.equal(typeof metadataModuleArgs.providerHealthRecorder.recordError, 'function');
  assert.equal(typeof metadataModuleArgs.providerHealthRecorder.recordSuccess, 'function');
  assert.equal(slskdModuleArgs.providerHealthRecorder, metadataModuleArgs.providerHealthRecorder);
  assert.equal(importCandidateModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(importCandidateModuleArgs.slskdTransferSnapshotService, slskdTransferSnapshotService);
  assert.equal(libraryModuleArgs.importCandidateService, importCandidateModule.importCandidateService);
  assert.equal(libraryModuleArgs.settingsService, settingsService);
  assert.equal(libraryModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(typeof systemModuleArgs.dependencyHealthService.getDependencyHealth, 'function');
  assert.equal(systemModuleArgs.libraryScanSummaryService, libraryModule.libraryScanSummaryService);
  assert.equal(systemModuleArgs.settingsService, settingsService);
  assert.equal(systemModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(systemModuleArgs.musicBrainzSearchService, metadataModule.musicBrainzSearchService);

  const providerError = new Error('MusicBrainz is throttled');
  providerError.code = 'musicbrainz_unavailable';
  providerError.details = {
    retryAfterMs: 2000,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/artist?fmt=json',
  };
  metadataModuleArgs.providerHealthRecorder.recordError('musicbrainz', providerError);
  const dependencyHealth = await systemModuleArgs.dependencyHealthService.getDependencyHealth();
  assert.equal(dependencyHealth.length, 2);
  assert.equal(slskdModule.slskdService.getConnectionStatus.mock.callCount(), 1);
  const musicBrainzHealth = dependencyHealth.find((dependency) => dependency.provider === 'musicbrainz');
  const slskdHealth = dependencyHealth.find((dependency) => dependency.provider === 'slskd');

  assert.match(musicBrainzHealth.observedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(
    {
      ...musicBrainzHealth,
      observedAt: '<observed-at>',
    },
    {
      provider: 'musicbrainz',
      status: 'degraded',
      code: 'musicbrainz_unavailable',
      message: 'MusicBrainz is throttling requests',
      details: {
        retryAfterMs: 2000,
        throttled: true,
      },
      observedAt: '<observed-at>',
    },
  );
  assert.deepEqual(slskdHealth, {
    provider: 'slskd',
    status: 'healthy',
    details: {
      isConnected: true,
      isLoggedIn: true,
      isTransitioning: false,
    },
  });

  assert.deepEqual(systemModuleArgs, {
    appPort: 4510,
    dependencyHealthService: systemModuleArgs.dependencyHealthService,
    libraryScanSummaryService: libraryModule.libraryScanSummaryService,
    musicBrainzSearchService: metadataModule.musicBrainzSearchService,
    packageJsonPath: 'C:/virtual/package.json',
    settingsService,
    slskdService: slskdModule.slskdService,
    startedAt,
  });
  assert.equal(registerAuthRoutes.mock.callCount(), 1);
  assert.equal(registerImportCandidateRoutes.mock.callCount(), 1);
  assert.equal(registerLibraryRoutes.mock.callCount(), 1);
  assert.equal(registerMetadataRoutes.mock.callCount(), 1);
  assert.equal(registerSlskdRoutes.mock.callCount(), 1);
  assert.equal(registerSystemRoutes.mock.callCount(), 1);
  assert.equal(registerAuthRoutes.mock.calls[0].arguments[0], app);
  assert.deepEqual(registerAuthRoutes.mock.calls[0].arguments[1], authModule.routeDependencies);
  assert.equal(registerImportCandidateRoutes.mock.calls[0].arguments[0], app);
  assert.deepEqual(registerImportCandidateRoutes.mock.calls[0].arguments[1], importCandidateModule.routeDependencies);
  assert.equal(registerLibraryRoutes.mock.calls[0].arguments[0], app);
  assert.deepEqual(registerLibraryRoutes.mock.calls[0].arguments[1], libraryModule.routeDependencies);
  assert.equal(registerMetadataRoutes.mock.calls[0].arguments[0], app);
  assert.deepEqual(registerMetadataRoutes.mock.calls[0].arguments[1], metadataModule.routeDependencies);
  assert.equal(registerSlskdRoutes.mock.calls[0].arguments[0], app);
  assert.deepEqual(registerSlskdRoutes.mock.calls[0].arguments[1], slskdModule.routeDependencies);
  assert.equal(registerSystemRoutes.mock.calls[0].arguments[0], app);
  assert.deepEqual(registerSystemRoutes.mock.calls[0].arguments[1], systemModule.routeDependencies);

  await withServer(app, async (baseUrl) => {
    const apiResponse = await fetch(`${baseUrl}/api/does-not-exist`);
    const apiPayload = await apiResponse.json();
    const spaResponse = await fetch(`${baseUrl}/metadata/workspace`);
    const spaHtml = await spaResponse.text();

    assert.equal(apiResponse.status, 404);
    assert.deepEqual(apiPayload, { ok: false, error: 'not_found' });
    assert.equal(spaResponse.status, 200);
    assert.match(spaHtml, /Harmoniarr App Shell/);
  });
});
