import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { suite, test } from 'node:test';
import { createApp } from '../../src/server/app.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

suite('createApp', () => {
  test('composes shared modules and preserves api and spa fallbacks', async (t) => {
  const clientDistDir = await mkdtemp(join(tmpdir(), 'harmoniarr-app-test-'));
  const startedAt = new Date('2026-04-28T12:00:00.000Z');
  const artworkModule = {
    artworkAssignmentService: { assignPreferredArtwork: () => ({}) },
    artworkMonitoredArtistPrefetchService: { prefetchMonitoredArtistArtwork: () => ({}) },
    routeDependencies: { artwork: 'deps' },
    artworkIngestionService: { ingestArtworkBuffer: () => ({}) },
    artworkPolicyService: { buildArtworkOverviewFromSettingsPayload: () => ({}) },
    artworkSummaryService: { buildArtworkSummary: () => ({}) },
  };
  const authModule = { routeDependencies: { auth: 'deps' } };
  const downloaderModule = { routeDependencies: { downloader: 'deps' } };
  const importCandidateModule = {
    importCandidateAutoDownloadRunService: { startDownloadRunAfterAutoSelection: () => {} },
    importCandidateAutoSelectionService: { selectHighConfidenceCandidate: () => {} },
    routeDependencies: { importCandidates: 'deps' },
  };
  const missingMusicModule = { routeDependencies: { missingMusic: 'deps' } };
  const libraryModule = {
    libraryDiscoveryRequestService: {
      reconcileDiscoveryRequests: t.mock.fn(async () => {}),
    },
    libraryWantedReleaseStore: { replaceLibraryWantedReleases: async () => {}, listLibraryWantedReleases: async () => [] },
    libraryWantedReleaseService: {
      reconcileWantedReleases: t.mock.fn(async () => {}),
    },
    libraryScanService: {
      queueDeferredLibraryScan: t.mock.fn(async () => ({ accepted: true, run: { id: 'deferred-scan-run-1' } })),
      startLibraryScan: t.mock.fn(async () => ({ accepted: true, run: { id: 'scan-run-1' } })),
    },
    libraryScanSummaryService: { buildLibraryScanSummary: () => ({}) },
    routeDependencies: {
      buildLibraryWantedReleases: async () => ({
        pagination: { limit: 100, offset: 0, total: 0 },
        releases: [],
      }),
      library: 'deps',
    },
  };
  const operationsModule = {
    operationHistoryService: { listRecentOperationRuns: t.mock.fn(async () => []) },
    routeDependencies: { operations: 'deps' },
  };
  const providerModule = {
    routeDependencies: { providers: 'deps' },
    plexOwnerLinkService: {
      buildStatus: t.mock.fn(async () => ({ linked: false })),
      clearLink: t.mock.fn(async () => ({ status: { linked: false } })),
      completeLink: t.mock.fn(async () => ({ status: { linked: true } })),
      resolveLinkedAccessToken: t.mock.fn(async () => null),
      startLink: t.mock.fn(async () => ({ authorizationUrl: 'https://app.plex.tv/auth#?' })),
    },
    spotifyOAuthService: { resolveAccessToken: async () => null },
    youtubeOAuthService: { resolveAccessToken: async () => null },
  };
  const metadataModule = {
    musicBrainzSearchService: { checkProviderHealth: t.mock.fn(async () => ({ provider: 'musicbrainz', status: 'healthy', message: 'MusicBrainz lookups are reachable.' })) },
    routeDependencies: { metadata: 'deps' },
  };
  let slskdApiKeyConfigured = true;
  const slskdConfigService = {
    buildRuntimeConfig: t.mock.fn(async () => ({ })),
    buildSecretStatus: t.mock.fn(async () => ({
      apiKeyConfigured: slskdApiKeyConfigured,
      apiKeySource: slskdApiKeyConfigured ? 'stored' : 'unset',
    })),
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
  const systemModule = {
    routeDependencies: { system: 'deps' },
    adminRecoveryService: {
      getBootstrapAdminRecoveryStatus: t.mock.fn(async () => ({ recoveryAvailable: false })),
      completeBootstrapAdminRecovery: t.mock.fn(async () => ({ success: true, requiresLogin: true })),
    },
  };
  const createArtworkModule = t.mock.fn(() => artworkModule);
  const createAuthModule = t.mock.fn(() => authModule);
  const deploymentSecurityPolicy = {
    csrfProtectionMode: 'disabled',
    enforceHttps: false,
    secureCookies: false,
    strictTransportSecurity: false,
  };
  const deploymentSecurityService = {
    applySettings: t.mock.fn(() => deploymentSecurityPolicy),
    getCachedPolicy: t.mock.fn(() => deploymentSecurityPolicy),
    getPolicy: t.mock.fn(async () => deploymentSecurityPolicy),
  };
  const createDeploymentSecurityService = t.mock.fn(() => deploymentSecurityService);
  const createDownloaderModule = t.mock.fn(() => downloaderModule);
  const createImportCandidateModule = t.mock.fn(() => importCandidateModule);
  const mediaToolingStatusService = {
    getStatus: t.mock.fn(async () => ({
      status: 'healthy',
      details: {
        ffmpegAvailable: true,
        ffprobeAvailable: true,
      },
    })),
  };
  const createMediaToolingStatusService = t.mock.fn(() => mediaToolingStatusService);
  const createLibraryModule = t.mock.fn(() => libraryModule);
  const createMissingMusicModule = t.mock.fn(() => missingMusicModule);
  const createMetadataModule = t.mock.fn(() => metadataModule);
  const createOperationsModule = t.mock.fn(() => operationsModule);
  const createProviderModule = t.mock.fn(() => providerModule);
  const createSettingsService = t.mock.fn(() => settingsService);
  const createSlskdConfigService = t.mock.fn(() => slskdConfigService);
  const createSlskdModule = t.mock.fn(() => slskdModule);
  const createSystemModule = t.mock.fn(() => systemModule);
  const registerAuthRoutes = t.mock.fn((testApp) => {
    testApp.get('/api/v1/test/ping', (_request, response) => {
      response.json({ ok: true, pong: true });
    });
    testApp.post('/api/v1/test/ping', (_request, response) => {
      response.json({ ok: true, pong: true });
    });
  });
  const registerAdminRecoveryRoutes = t.mock.fn();
  const registerArtworkRoutes = t.mock.fn();
  const registerDownloaderRoutes = t.mock.fn();
  const registerImportCandidateRoutes = t.mock.fn();
  const registerLibraryRoutes = t.mock.fn();
  const registerMissingMusicRoutes = t.mock.fn();
  const registerMetadataRoutes = t.mock.fn();
  const registerOperationsRoutes = t.mock.fn();
  const registerProviderRoutes = t.mock.fn();
  const registerSlskdRoutes = t.mock.fn();
  const registerSystemRoutes = t.mock.fn();

  await writeFile(join(clientDistDir, 'index.html'), '<!doctype html><html><body>Harmoniarr App Shell</body></html>');

  t.after(async () => {
    await rm(clientDistDir, { recursive: true, force: true });
  });

  const {
    app,
    appPort,
    importCandidateModule: composedImportCandidateModule,
    runtimeResourceService,
  } = createApp({
    appPort: 4510,
    clientDistDir,
    packageJsonPath: 'C:/virtual/package.json',
    startedAt,
    createArtworkModule,
    createAuthModule,
    createDeploymentSecurityService,
    createDownloaderModule,
    createImportCandidateModule,
    createLibraryModule,
    createMissingMusicModule,
    createMediaToolingStatusService,
    createMetadataModule,
    createOperationsModule,
    createProviderModule,
    createSettingsService,
    createSlskdConfigService,
    createSlskdModule,
    createSystemModule,
    registerArtworkRoutes,
    registerAuthRoutes,
    registerAdminRecoveryRoutes,
    registerDownloaderRoutes,
    registerImportCandidateRoutes,
    registerLibraryRoutes,
    registerMissingMusicRoutes,
    registerMetadataRoutes,
    registerOperationsRoutes,
    registerProviderRoutes,
    registerSlskdRoutes,
    registerSystemRoutes,
  });

  assert.equal(appPort, 4510);
  assert.equal(composedImportCandidateModule, importCandidateModule);
  assert.equal(createArtworkModule.mock.callCount(), 1);
  assert.equal(createAuthModule.mock.callCount(), 1);
  assert.equal(createDeploymentSecurityService.mock.callCount(), 1);
  assert.equal(createDownloaderModule.mock.callCount(), 1);
  assert.equal(createImportCandidateModule.mock.callCount(), 1);
  assert.equal(createMediaToolingStatusService.mock.callCount(), 1);
  assert.equal(createLibraryModule.mock.callCount(), 1);
  assert.equal(createMissingMusicModule.mock.callCount(), 1);
  assert.equal(createMetadataModule.mock.callCount(), 1);
  assert.equal(createOperationsModule.mock.callCount(), 1);
  assert.equal(createProviderModule.mock.callCount(), 1);
  assert.equal(createSettingsService.mock.callCount(), 1);
  assert.equal(createSlskdConfigService.mock.callCount(), 1);
  assert.equal(createSlskdModule.mock.callCount(), 1);
  assert.equal(createSystemModule.mock.callCount(), 1);
  const artworkModuleArgs = createArtworkModule.mock.calls[0].arguments[0];
  const authModuleArgs = createAuthModule.mock.calls[0].arguments[0];
  const metadataModuleArgs = createMetadataModule.mock.calls[0].arguments[0];
  const downloaderModuleArgs = createDownloaderModule.mock.calls[0].arguments[0];
  const importCandidateModuleArgs = createImportCandidateModule.mock.calls[0].arguments[0];
  const libraryModuleArgs = createLibraryModule.mock.calls[0].arguments[0];
  const slskdModuleArgs = createSlskdModule.mock.calls[0].arguments[0];
  const systemModuleArgs = createSystemModule.mock.calls[0].arguments[0];

  assert.equal(artworkModuleArgs.settingsService, settingsService);
  assert.equal(typeof artworkModuleArgs.maintenanceLockService.listActiveMaintenanceLocks, 'function');
  assert.equal(authModuleArgs.settingsService, settingsService);
  assert.equal(createSettingsService.mock.calls[0].arguments[0].deploymentSecurityService, deploymentSecurityService);
  assert.equal(createSettingsService.mock.calls[0].arguments[0].plexOwnerLinkService, providerModule.plexOwnerLinkService);
  assert.equal(createSettingsService.mock.calls[0].arguments[0].slskdConfigService, slskdConfigService);
  assert.equal(createSettingsService.mock.calls[0].arguments[0].spotifyOAuthService, providerModule.spotifyOAuthService);
  assert.equal(createSettingsService.mock.calls[0].arguments[0].youtubeOAuthService, providerModule.youtubeOAuthService);
  assert.equal(typeof metadataModuleArgs.providerHealthRecorder.recordError, 'function');
  assert.equal(typeof metadataModuleArgs.providerHealthRecorder.recordSuccess, 'function');
  assert.equal(slskdModuleArgs.providerHealthRecorder, metadataModuleArgs.providerHealthRecorder);
  assert.equal(slskdModuleArgs.slskdConfigService, slskdConfigService);
  assert.equal(downloaderModuleArgs.slskdConfigService, slskdConfigService);
  assert.equal(downloaderModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(importCandidateModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(importCandidateModuleArgs.slskdTransferSnapshotService, slskdTransferSnapshotService);
  assert.equal(importCandidateModuleArgs.getMediaToolingStatus, mediaToolingStatusService.getStatus);
  assert.equal(typeof importCandidateModuleArgs.mediaInspectionService.inspectSourceFile, 'function');
  assert.equal(typeof importCandidateModuleArgs.mediaTranscodeExecutionService.executeCandidate, 'function');
  assert.equal(typeof importCandidateModuleArgs.scheduleLibraryScan, 'function');
  assert.equal(typeof importCandidateModuleArgs.queueDeferredLibraryScan, 'function');
  assert.deepEqual(await importCandidateModuleArgs.scheduleLibraryScan({
    releaseHints: [{
      canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
    triggeredByRunId: 'apply-run-1',
    triggerReason: 'import_candidate_apply',
  }), { accepted: true, run: { id: 'scan-run-1' } });
  assert.deepEqual(libraryModule.libraryScanService.startLibraryScan.mock.calls[0].arguments[0], {
    releaseHints: [{
      canonicalPath: '/music/Autechre/Amber/01 Foil.flac',
      metadataReleaseId: 'release-1',
    }],
    triggeredByRunId: 'apply-run-1',
    triggeredByUserId: null,
    triggerReason: 'import_candidate_apply',
  });
  assert.deepEqual(await importCandidateModuleArgs.queueDeferredLibraryScan({
    deferredReason: 'library_scan_in_progress',
    releaseHints: [{
      canonicalPath: '/music/Autechre/Amber/02 Montreal.flac',
      metadataReleaseId: 'release-2',
    }],
    triggeredByRunId: 'apply-run-2',
    triggerReason: 'import_candidate_apply',
  }), { accepted: true, run: { id: 'deferred-scan-run-1' } });
  assert.deepEqual(libraryModule.libraryScanService.queueDeferredLibraryScan.mock.calls[0].arguments[0], {
    deferredReason: 'library_scan_in_progress',
    releaseHints: [{
      canonicalPath: '/music/Autechre/Amber/02 Montreal.flac',
      metadataReleaseId: 'release-2',
    }],
    triggeredByRunId: 'apply-run-2',
    triggeredByUserId: null,
    triggerReason: 'import_candidate_apply',
  });
  assert.equal(typeof importCandidateModuleArgs.maintenanceLockService.listActiveMaintenanceLocks, 'function');
  assert.equal(artworkModuleArgs.maintenanceLockService, importCandidateModuleArgs.maintenanceLockService);
  assert.equal(libraryModuleArgs.maintenanceLockService, importCandidateModuleArgs.maintenanceLockService);
  assert.equal(libraryModuleArgs.artworkAssignmentService, artworkModule.artworkAssignmentService);
  assert.equal(libraryModuleArgs.artworkIngestionService, artworkModule.artworkIngestionService);
  assert.equal(
    libraryModuleArgs.importCandidateAutoDownloadRunService,
    importCandidateModule.importCandidateAutoDownloadRunService,
  );
  assert.equal(
    libraryModuleArgs.importCandidateAutoSelectionService,
    importCandidateModule.importCandidateAutoSelectionService,
  );
  assert.equal(libraryModuleArgs.importCandidateService, importCandidateModule.importCandidateService);
  assert.equal(libraryModuleArgs.prefetchMonitoredArtistArtwork, artworkModule.artworkMonitoredArtistPrefetchService.prefetchMonitoredArtistArtwork);
  assert.equal(typeof libraryModuleArgs.providerClientResolverService.resolveProviderClients, 'function');
  assert.equal(libraryModuleArgs.settingsService, settingsService);
  assert.equal(libraryModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(systemModuleArgs.artworkPolicyService, artworkModule.artworkPolicyService);
  assert.equal(typeof systemModuleArgs.dependencyHealthService.getDependencyHealth, 'function');
  assert.equal(systemModuleArgs.libraryScanSummaryService, libraryModule.libraryScanSummaryService);
  assert.equal(systemModuleArgs.libraryWantedReleaseStore, libraryModule.libraryWantedReleaseStore);
  assert.equal(systemModuleArgs.operationHistoryService, operationsModule.operationHistoryService);
  assert.equal(systemModuleArgs.settingsService, settingsService);
  assert.equal(systemModuleArgs.slskdService, slskdModule.slskdService);
  assert.equal(systemModuleArgs.musicBrainzSearchService, metadataModule.musicBrainzSearchService);
  assert.equal(systemModuleArgs.maintenanceLockService, importCandidateModuleArgs.maintenanceLockService);
  assert.equal(typeof systemModuleArgs.maintenanceLockOperationPauseService.resolveDispatchReadiness, 'function');
  assert.equal(systemModuleArgs.runtimeResourceService, runtimeResourceService);

  const providerError = new Error('MusicBrainz is throttled');
  providerError.code = 'musicbrainz_unavailable';
  providerError.details = {
    retryAfterMs: 2000,
    throttled: true,
    url: 'https://musicbrainz.test/ws/2/artist?fmt=json',
  };
  metadataModuleArgs.providerHealthRecorder.recordError('musicbrainz', providerError);
  const dependencyHealth = await systemModuleArgs.dependencyHealthService.getDependencyHealth();
  assert.equal(dependencyHealth.length, 3);
  assert.equal(mediaToolingStatusService.getStatus.mock.callCount(), 1);
  assert.equal(metadataModule.musicBrainzSearchService.checkProviderHealth.mock.callCount(), 1);
  assert.equal(slskdModule.slskdService.getConnectionStatus.mock.callCount(), 1);
  const mediaToolingHealth = dependencyHealth.find((dependency) => dependency.provider === 'media_tooling');
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
      status: 'healthy',
      message: 'MusicBrainz lookups are reachable.',
      observedAt: '<observed-at>',
    },
  );
  assert.match(slskdHealth.observedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(
    {
      ...slskdHealth,
      observedAt: '<observed-at>',
    },
    {
      provider: 'slskd',
      status: 'healthy',
      details: {
        isConnected: true,
        isLoggedIn: true,
        isTransitioning: false,
      },
      observedAt: '<observed-at>',
    },
  );
  slskdApiKeyConfigured = false;
  const disabledSlskdHealth = await systemModuleArgs.dependencyHealthService.getDependencyHealth({
    providers: ['slskd'],
  });
  assert.equal(slskdModule.slskdService.getConnectionStatus.mock.callCount(), 1);
  assert.deepEqual(
    {
      ...disabledSlskdHealth[0],
      observedAt: '<observed-at>',
    },
    {
      provider: 'slskd',
      status: 'disabled',
      code: 'slskd_not_configured',
      message: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
      observedAt: '<observed-at>',
    },
  );
  assert.match(mediaToolingHealth.observedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(
    {
      ...mediaToolingHealth,
      observedAt: '<observed-at>',
    },
    {
      provider: 'media_tooling',
      status: 'healthy',
      details: {
        ffmpegAvailable: true,
        ffprobeAvailable: true,
      },
      observedAt: '<observed-at>',
    },
  );

  assert.deepEqual(systemModuleArgs, {
    appPort: 4510,
    appleMusicStatusService: providerModule.appleMusicStatusService,
    artworkPolicyService: artworkModule.artworkPolicyService,
    artworkSummaryService: artworkModule.artworkSummaryService,
    controlPlaneIdempotencyService: systemModuleArgs.controlPlaneIdempotencyService,
    dependencyHealthService: systemModuleArgs.dependencyHealthService,
    importCandidateExecutionHeartbeatConfig: undefined,
    importCandidateExecutionHeartbeatState: undefined,
    libraryDiscoveryHeartbeatState: undefined,
    libraryScanSummaryService: libraryModule.libraryScanSummaryService,
    libraryWantedReleaseStore: libraryModule.libraryWantedReleaseStore,
    metadataRefreshHeartbeatConfig: undefined,
    metadataRefreshHeartbeatState: undefined,
    musicBrainzSearchService: metadataModule.musicBrainzSearchService,
    operatorArtistMonitoringStore: metadataModule.operatorArtistMonitoringStore,
    operatorReleaseGroupSelectionStore: metadataModule.operatorReleaseGroupSelectionStore,
    operatorTrackOverrideStore: metadataModule.operatorTrackOverrideStore,
    maintenanceLockService: systemModuleArgs.maintenanceLockService,
    maintenanceLockOperationPauseService: systemModuleArgs.maintenanceLockOperationPauseService,
    operationHistoryService: operationsModule.operationHistoryService,
    packageJsonPath: 'C:/virtual/package.json',
    plexOwnerLinkService: providerModule.plexOwnerLinkService,
    restoreScopeRuntimeSnapshotStore: systemModuleArgs.restoreScopeRuntimeSnapshotStore,
    runtimeResourceService,
    settingsService,
    slskdService: slskdModule.slskdService,
    spotifyOAuthService: providerModule.spotifyOAuthService,
    startedAt,
    youtubeOAuthService: providerModule.youtubeOAuthService,
  });
  assert.equal(registerAuthRoutes.mock.callCount(), 1);
  assert.equal(registerArtworkRoutes.mock.callCount(), 1);
  assert.equal(registerDownloaderRoutes.mock.callCount(), 1);
  assert.equal(registerImportCandidateRoutes.mock.callCount(), 1);
  assert.equal(registerLibraryRoutes.mock.callCount(), 1);
  assert.equal(registerMissingMusicRoutes.mock.callCount(), 1);
  assert.equal(registerMetadataRoutes.mock.callCount(), 1);
  assert.equal(registerOperationsRoutes.mock.callCount(), 1);
  assert.equal(registerProviderRoutes.mock.callCount(), 1);
  assert.equal(registerSlskdRoutes.mock.callCount(), 1);
  assert.equal(registerSystemRoutes.mock.callCount(), 1);
  assert.equal(registerAuthRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerAuthRoutes.mock.calls[0].arguments[1].auth, 'deps');
  assert.equal(typeof registerAuthRoutes.mock.calls[0].arguments[1].limitBootstrapAdmin, 'function');
  assert.equal(typeof registerAuthRoutes.mock.calls[0].arguments[1].limitLogin, 'function');
  assert.equal(typeof registerAuthRoutes.mock.calls[0].arguments[1].limitRefresh, 'function');
  assert.equal(typeof registerAuthRoutes.mock.calls[0].arguments[1].limitChangePassword, 'function');
  assert.equal(typeof registerAuthRoutes.mock.calls[0].arguments[1].limitSessionRevoke, 'function');
  assert.equal(registerArtworkRoutes.mock.calls[0].arguments[0], app);
  assert.equal(typeof registerArtworkRoutes.mock.calls[0].arguments[1].limitArtworkCleanupRun, 'function');
  assert.equal(registerArtworkRoutes.mock.calls[0].arguments[1].artwork, 'deps');
  assert.equal(registerDownloaderRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerDownloaderRoutes.mock.calls[0].arguments[1].downloader, 'deps');
  assert.equal(typeof registerDownloaderRoutes.mock.calls[0].arguments[1].limitDownloaderMutation, 'function');
  assert.equal(typeof registerDownloaderRoutes.mock.calls[0].arguments[1].limitDownloaderQueueRead, 'function');
  assert.equal(registerImportCandidateRoutes.mock.calls[0].arguments[0], app);
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateExecutionRun, 'function');
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateApplyRun, 'function');
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateMediaInspectionRun, 'function');
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateTranscodeRun, 'function');
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateExecutionReconcile, 'function');
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateSlskdIngest, 'function');
  assert.equal(typeof registerImportCandidateRoutes.mock.calls[0].arguments[1].limitImportCandidateDecision, 'function');
  assert.equal(registerImportCandidateRoutes.mock.calls[0].arguments[1].startImportCandidateExecutionRun, importCandidateModule.routeDependencies.startImportCandidateExecutionRun);
  assert.equal(registerLibraryRoutes.mock.calls[0].arguments[0], app);
  assert.equal(typeof registerLibraryRoutes.mock.calls[0].arguments[1].limitLibraryDiscoveryRun, 'function');
  assert.equal(typeof registerLibraryRoutes.mock.calls[0].arguments[1].limitLibraryOrganizeApplyRun, 'function');
  assert.equal(typeof registerLibraryRoutes.mock.calls[0].arguments[1].limitLibraryScanRun, 'function');
  assert.equal(typeof registerLibraryRoutes.mock.calls[0].arguments[1].limitMediaRequestMutation, 'function');
  assert.equal(typeof registerLibraryRoutes.mock.calls[0].arguments[1].limitMediaRequestAdminMutation, 'function');
  assert.equal(registerLibraryRoutes.mock.calls[0].arguments[1].startLibraryDiscoveryRun, libraryModule.routeDependencies.startLibraryDiscoveryRun);
  assert.equal(registerMissingMusicRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerMissingMusicRoutes.mock.calls[0].arguments[1].missingMusic, 'deps');
  assert.equal(typeof registerMissingMusicRoutes.mock.calls[0].arguments[1].limitMissingMusicDecisionDetailRead, 'function');
  assert.equal(typeof registerMissingMusicRoutes.mock.calls[0].arguments[1].limitMissingMusicDecisionRead, 'function');
  assert.equal(registerMetadataRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerMetadataRoutes.mock.calls[0].arguments[1].metadata, metadataModule.routeDependencies.metadata);
  assert.equal(typeof registerMetadataRoutes.mock.calls[0].arguments[1].limitMetadataArtistRefreshRun, 'function');
  assert.equal(typeof registerMetadataRoutes.mock.calls[0].arguments[1].limitMetadataImport, 'function');
  assert.equal(typeof registerMetadataRoutes.mock.calls[0].arguments[1].limitMetadataMutation, 'function');
  assert.equal(registerOperationsRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerOperationsRoutes.mock.calls[0].arguments[1].operations, operationsModule.routeDependencies.operations);
  assert.equal(typeof registerOperationsRoutes.mock.calls[0].arguments[1].limitOperationRunMutation, 'function');
  assert.equal(registerProviderRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerProviderRoutes.mock.calls[0].arguments[1].providers, providerModule.routeDependencies.providers);
  assert.equal(typeof registerProviderRoutes.mock.calls[0].arguments[1].limitProviderOAuthStart, 'function');
  assert.equal(typeof registerProviderRoutes.mock.calls[0].arguments[1].limitProviderOAuthClear, 'function');
  assert.equal(registerSlskdRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerSlskdRoutes.mock.calls[0].arguments[1].slskd, slskdModule.routeDependencies.slskd);
  assert.equal(typeof registerSlskdRoutes.mock.calls[0].arguments[1].limitSlskdSearch, 'function');
  assert.equal(registerSystemRoutes.mock.calls[0].arguments[0], app);
  assert.equal(registerSystemRoutes.mock.calls[0].arguments[1].system, systemModule.routeDependencies.system);
  assert.equal(typeof registerSystemRoutes.mock.calls[0].arguments[1].limitBackupExport, 'function');
  assert.equal(typeof registerSystemRoutes.mock.calls[0].arguments[1].limitOperatorNotificationFanoutRun, 'function');
  assert.equal(typeof registerSystemRoutes.mock.calls[0].arguments[1].limitSettingsUpdate, 'function');
  assert.equal(typeof registerSystemRoutes.mock.calls[0].arguments[1].limitMaintenanceLockMutation, 'function');
  assert.equal(typeof registerSystemRoutes.mock.calls[0].arguments[1].limitBackupMutation, 'function');

  await withServer(app, async (baseUrl) => {
    const apiResponse = await fetch(`${baseUrl}/api/does-not-exist`);
    const apiPayload = await apiResponse.json();
    const protectedApiResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      headers: {
        accept: 'application/json',
      },
    });
    const invalidAcceptResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      headers: {
        accept: 'text/html',
      },
    });
    const invalidAcceptPayload = await invalidAcceptResponse.json();
    const invalidContentTypeResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
      },
      body: 'not-json',
    });
    const invalidContentTypePayload = await invalidContentTypeResponse.json();
    const invalidJsonResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{',
    });
    const invalidJsonPayload = await invalidJsonResponse.json();
    const spaResponse = await fetch(`${baseUrl}/metadata/workspace`);
    const spaHtml = await spaResponse.text();

    assert.equal(apiResponse.status, 404);
    assert.deepEqual(apiPayload, { ok: false, error: 'not_found' });
    assert.equal(protectedApiResponse.headers.get('cache-control'), 'no-store');
    assert.equal(protectedApiResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(protectedApiResponse.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(protectedApiResponse.headers.get('x-frame-options'), 'DENY');
    assert.equal(protectedApiResponse.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.match(protectedApiResponse.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(protectedApiResponse.headers.get('strict-transport-security'), null);
    assert.equal(invalidAcceptResponse.status, 406);
    assert.deepEqual(invalidAcceptPayload, {
      ok: false,
      error: {
        code: 'not_acceptable',
        message: 'API responses are only available as application/json',
      },
    });
    assert.equal(invalidContentTypeResponse.status, 415);
    assert.deepEqual(invalidContentTypePayload, {
      ok: false,
      error: {
        code: 'unsupported_media_type',
        message: 'API requests with a body must use application/json',
      },
    });
    assert.equal(invalidJsonResponse.status, 400);
    assert.deepEqual(invalidJsonPayload, {
      ok: false,
      error: {
        code: 'invalid_json',
        message: 'Request body must contain valid JSON',
      },
    });
    assert.equal(spaResponse.status, 200);
    assert.equal(spaResponse.headers.get('x-content-type-options'), 'nosniff');
    assert.match(spaHtml, /Harmoniarr App Shell/);
  });
  });

  test('enforces opt-in https and hsts from the shared deployment security service', async (t) => {
  const clientDistDir = await mkdtemp(join(tmpdir(), 'harmoniarr-app-security-test-'));
  const deploymentSecurityPolicy = {
    csrfProtectionMode: 'required',
    enforceHttps: true,
    secureCookies: true,
    strictTransportSecurity: true,
  };

  t.after(async () => {
    await rm(clientDistDir, { recursive: true, force: true });
  });

  await writeFile(join(clientDistDir, 'index.html'), '<!doctype html><html><body>Harmoniarr App Shell</body></html>');

  const { app } = createApp({
    clientDistDir,
    createAuthModule: () => ({ routeDependencies: {} }),
    createDeploymentSecurityService: () => ({
      applySettings: t.mock.fn(() => deploymentSecurityPolicy),
      getCachedPolicy: t.mock.fn(() => deploymentSecurityPolicy),
      getPolicy: t.mock.fn(async () => deploymentSecurityPolicy),
    }),
    createDownloaderModule: () => ({ routeDependencies: {} }),
    createImportCandidateModule: () => ({ routeDependencies: {} }),
    createLibraryModule: () => ({
      libraryDiscoveryRequestService: {
        reconcileDiscoveryRequests: async () => {},
      },
      libraryWantedReleaseStore: {
        listWantedReleasesWithMetadata: async () => [],
      },
      libraryWantedReleaseService: {
        reconcileWantedReleases: async () => {},
      },
      libraryScanSummaryService: { buildLibraryScanSummary: () => ({}) },
      routeDependencies: {
        buildLibraryWantedReleases: async () => ({
          pagination: { limit: 100, offset: 0, total: 0 },
          releases: [],
        }),
      },
    }),
    createMissingMusicModule: () => ({ routeDependencies: {} }),
    createMetadataModule: () => ({
      musicBrainzSearchService: { checkProviderHealth: async () => ({ status: 'healthy' }) },
      routeDependencies: {},
    }),
    createOperationsModule: () => ({
      operationHistoryService: { listRecentOperationRuns: async () => [] },
      routeDependencies: {},
    }),
    createSettingsService: () => ({ buildSettingsPayload: async () => ({}), updateSettings: async () => ({}) }),
    createSlskdConfigService: () => ({ buildRuntimeConfig: async () => ({}) }),
    createSlskdModule: () => ({
      routeDependencies: {},
      slskdService: { getConnectionStatus: async () => ({ provider: 'slskd', status: 'healthy', details: {} }) },
      slskdTransferSnapshotService: {},
    }),
    createSystemModule: () => ({
      routeDependencies: {},
      adminRecoveryService: {
        getBootstrapAdminRecoveryStatus: async () => ({ recoveryAvailable: false }),
        completeBootstrapAdminRecovery: async () => ({ success: true, requiresLogin: true }),
      },
    }),
    registerAuthRoutes(testApp) {
      testApp.get('/api/v1/test/ping', (_request, response) => {
        response.json({ ok: true });
      });
      testApp.post('/api/v1/test/ping', (_request, response) => {
        response.json({ ok: true });
      });
    },
    registerImportCandidateRoutes: () => {},
    registerLibraryRoutes: () => {},
    registerMissingMusicRoutes: () => {},
    registerMetadataRoutes: () => {},
    registerSlskdRoutes: () => {},
    registerSystemRoutes: () => {},
    registerArtworkRoutes: () => {},
    registerAdminRecoveryRoutes: () => {},
    registerDownloaderRoutes: () => {},
  });

  await withServer(app, async (baseUrl) => {
    const redirectResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      headers: {
        'x-forwarded-proto': 'http',
      },
      redirect: 'manual',
    });
    const writeResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-forwarded-proto': 'http',
      },
      body: JSON.stringify({ ok: true }),
    });
    const writePayload = await writeResponse.json();
    const secureResponse = await fetch(`${baseUrl}/api/v1/test/ping`, {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(redirectResponse.status, 307);
    assert.match(redirectResponse.headers.get('location') ?? '', /^https:\/\//);
    assert.equal(writeResponse.status, 426);
    assert.deepEqual(writePayload, {
      ok: false,
      error: {
        code: 'https_required',
        message: 'HTTPS is required',
      },
    });
    assert.equal(secureResponse.headers.get('strict-transport-security'), 'max-age=15552000; includeSubDomains');
  });
  });
});
