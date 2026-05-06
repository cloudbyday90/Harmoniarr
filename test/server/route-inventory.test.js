import assert from 'node:assert/strict';
import test from 'node:test';
import { registerArtworkRoutes } from '../../src/server/routes/artwork-routes.js';
import { registerAppUserRoutes } from '../../src/server/routes/app-user-routes.js';
import { registerAuthRoutes } from '../../src/server/routes/auth-routes.js';
import { registerAdminRecoveryRoutes } from '../../src/server/routes/admin-recovery-routes.js';
import { registerImportCandidateRoutes } from '../../src/server/routes/import-candidate-routes.js';
import { registerLibraryRoutes } from '../../src/server/routes/library-routes.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { registerOperationsRoutes } from '../../src/server/routes/operations-routes.js';
import { registerProviderRoutes } from '../../src/server/routes/provider-routes.js';
import { registerSlskdRoutes } from '../../src/server/routes/slskd-routes.js';
import { registerSystemRoutes } from '../../src/server/routes/system-routes.js';
import { serverRouteInventory, toRouteSignature } from '../../src/server/route-inventory.js';

function createRecordingApp() {
  const routes = [];
  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  const app = {};

  for (const method of methods) {
    app[method] = (path) => {
      routes.push({
        method: method.toUpperCase(),
        path,
      });
    };
  }

  return { app, routes };
}

function asyncNoopResult(result = {}) {
  return async () => result;
}

function collectRegisteredRoutes() {
  const { app, routes } = createRecordingApp();

  registerAuthRoutes(app, {
    completeAppUserClaim: asyncNoopResult({ requiresLogin: true }),
    createAuthenticatedResponse: () => ({}),
    createBootstrapAdmin: asyncNoopResult({ user: {}, issuedSession: {} }),
    createBootstrapStatusResponse: () => ({}),
    createClaimCompletedResponse: () => ({}),
    createLogoutResponse: () => ({}),
    createRefreshResponse: () => ({}),
    createSessionResponse: () => ({}),
    getRequestMetadata: () => ({}),
    loginUser: asyncNoopResult({ user: {}, issuedSession: {} }),
    logoutSession: asyncNoopResult(),
    requireCsrf: () => {},
    requireFreshSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireSession: asyncNoopResult({ appUserId: 'user-1' }),
    rotateSession: asyncNoopResult({}),
  });

  registerAdminRecoveryRoutes(app, {
    getBootstrapAdminRecoveryStatus: asyncNoopResult({ recoveryAvailable: false }),
    completeBootstrapAdminRecovery: asyncNoopResult({ success: true, requiresLogin: true }),
  });

  registerAppUserRoutes(app, {
    applyPlexDirectoryImport: asyncNoopResult({}),
    buildPlexDirectoryImportPreview: asyncNoopResult({}),
    claimManagedLibraryRoot: asyncNoopResult({}),
    createAppUser: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    issueAppUserClaimCode: asyncNoopResult({}),
    listAppUsers: asyncNoopResult([]),
    relinkPlexDirectoryConflict: asyncNoopResult({}),
    resetAppUserPassword: asyncNoopResult({}),
    unlinkPlexAppUser: asyncNoopResult({}),
    provisionManagedLibraryRoot: asyncNoopResult({}),
    requireAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireFreshSession: asyncNoopResult({ appUserId: 'user-1' }),
    roleOptions: ['admin', 'operator', 'requester'],
    updateAppUser: asyncNoopResult({}),
  });

  registerArtworkRoutes(app, {
    buildArtworkCleanupHistory: asyncNoopResult({}),
    buildArtworkCleanupRunDetail: asyncNoopResult({}),
    buildArtworkSummary: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    requireAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    startArtworkCleanupRun: asyncNoopResult({}),
  });

  registerLibraryRoutes(app, {
    buildLibraryDiscoverySummary: asyncNoopResult({}),
    buildLibraryOrganizePreview: asyncNoopResult({}),
    buildMediaRequestSummary: asyncNoopResult({}),
    buildLibraryReconciliationSummary: asyncNoopResult({}),
    buildLibraryWantedSummary: asyncNoopResult({}),
    createMediaRequest: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireSession: asyncNoopResult({ appUserId: 'user-1', user: { role: 'requester' } }),
    listMediaRequests: asyncNoopResult([]),
    startLibraryOrganizeApplyRun: asyncNoopResult({}),
    startLibraryDiscoveryRun: asyncNoopResult({}),
    startLibraryScan: asyncNoopResult({}),
  });

  registerMetadataRoutes(app, {
    browseMusicBrainzArtistReleaseGroups: asyncNoopResult({}),
    getMusicBrainzReleaseGroupReleases: asyncNoopResult({}),
    getMetadataArtist: asyncNoopResult({}),
    getMetadataArtistByMusicBrainzId: asyncNoopResult({}),
    getMetadataRelease: asyncNoopResult({}),
    getMetadataReleaseByMusicBrainzId: asyncNoopResult({}),
    getMetadataReleaseGroup: asyncNoopResult({}),
    getMetadataReleaseGroupByMusicBrainzId: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    importMusicBrainzArtist: asyncNoopResult({ artist: {}, source: 'musicbrainz' }),
    importMusicBrainzRelease: asyncNoopResult({ artist: {}, releaseGroup: {}, release: {}, source: 'musicbrainz' }),
    importMusicBrainzReleaseGroup: asyncNoopResult({ artist: {}, releaseGroup: {}, source: 'musicbrainz' }),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireFreshSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireSession: asyncNoopResult({ appUserId: 'user-1' }),
    searchLocalMetadataArtists: asyncNoopResult({}),
    searchLocalMetadataReleaseGroups: asyncNoopResult({}),
    searchLocalMetadataReleases: asyncNoopResult({}),
    searchMusicBrainzArtists: asyncNoopResult({}),
    searchMusicBrainzReleases: asyncNoopResult({}),
    startMetadataArtistRefresh: asyncNoopResult({}),
    updateMetadataArtistMonitoring: asyncNoopResult({}),
  });

  registerSlskdRoutes(app, {
    getConnectionStatus: asyncNoopResult({}),
    getSearchResponses: asyncNoopResult({}),
    getSearchState: asyncNoopResult({}),
    requireAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireCsrf: () => {},
    startSearch: asyncNoopResult({}),
  });

  registerOperationsRoutes(app, {
    buildOperationHistory: asyncNoopResult({}),
    buildOperationRunDetail: asyncNoopResult({}),
    requestOperationRunCancellation: asyncNoopResult({}),
    requireAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
  });

  registerImportCandidateRoutes(app, {
    buildImportCandidateApplySummary: asyncNoopResult({}),
    buildImportCandidateExecutionSummary: asyncNoopResult({}),
    buildImportPendingCandidateSummary: asyncNoopResult({}),
    buildSelectedImportCandidateSummary: asyncNoopResult({}),
    clearImportCandidateFileDecision: asyncNoopResult({}),
    getImportCandidate: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    holdImportCandidate: asyncNoopResult({}),
    ingestSlskdSearchResponses: asyncNoopResult([]),
    listImportCandidates: asyncNoopResult([]),
    previewImportCandidate: asyncNoopResult({}),
    previewImportCandidateApply: asyncNoopResult({}),
    reconcileImportCandidateExecutionState: asyncNoopResult({}),
    rejectImportCandidate: asyncNoopResult({}),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireSession: asyncNoopResult({ appUserId: 'user-1' }),
    reopenImportCandidate: asyncNoopResult({}),
    selectImportCandidate: asyncNoopResult({}),
    setImportCandidateFileAllowLossyDerivativeDecision: asyncNoopResult({}),
    setImportCandidateFileSkipDecision: asyncNoopResult({}),
    startImportCandidateApplyRun: asyncNoopResult({}),
    startImportCandidateMediaInspectionRun: asyncNoopResult({}),
    startImportCandidateTranscodeRun: asyncNoopResult({}),
    startImportCandidateExecutionRun: asyncNoopResult({}),
  });

  registerSystemRoutes(app, {
    appPort: 3000,
    buildLibraryScanSummary: asyncNoopResult({}),
    buildOnboardingSummary: asyncNoopResult({}),
    buildSettingsPayload: asyncNoopResult({}),
    createBackupExport: asyncNoopResult({}),
    deleteBackupExportById: asyncNoopResult({}),
    enterMaintenanceLock: asyncNoopResult({}),
    getQueueDiagnostics: asyncNoopResult({}),
    getRecoveryDiagnostics: asyncNoopResult({}),
    getBackupExportById: asyncNoopResult({}),
    getBackupExportDownloadById: asyncNoopResult({}),
    getBackupRestorePreview: asyncNoopResult({}),
    getMaintenanceLockStatus: asyncNoopResult({}),
    startBackupRestoreApply: asyncNoopResult({}),
    getOperatorNotifications: asyncNoopResult({}),
    getOverview: asyncNoopResult({ service: { name: 'harmoniarr', startedAt: 'now' }, database: { name: 'postgres', pendingMigrations: 0 } }),
    listBackupExports: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    requireAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    releaseMaintenanceLockById: asyncNoopResult({}),
    requireSession: asyncNoopResult({ appUserId: 'user-1' }),
    startOperatorNotificationFanoutRun: asyncNoopResult({}),
    updateSettings: asyncNoopResult({}),
  });

  registerProviderRoutes(app, {
    buildAppleMusicStatus: asyncNoopResult({}),
    buildPlexLinkStatus: asyncNoopResult({}),
    buildSpotifyOAuthStatus: asyncNoopResult({}),
    buildYoutubeOAuthStatus: asyncNoopResult({}),
    clearPlexLink: asyncNoopResult({}),
    clearSpotifyAuthorization: asyncNoopResult({}),
    clearYoutubeAuthorization: asyncNoopResult({}),
    completePlexLink: asyncNoopResult({}),
    completeSpotifyAuthorization: asyncNoopResult({}),
    completeYoutubeAuthorization: asyncNoopResult({}),
    getRequestMetadata: () => ({}),
    requireCsrf: () => {},
    requireFreshAdminSession: asyncNoopResult({ appUserId: 'user-1' }),
    requireSession: asyncNoopResult({ appUserId: 'user-1' }),
    startPlexLink: asyncNoopResult({}),
    startSpotifyAuthorization: asyncNoopResult({}),
    startYoutubeAuthorization: asyncNoopResult({}),
  });

  return routes;
}

test('serverRouteInventory matches the actual registered server route surface', () => {
  const registeredSignatures = collectRegisteredRoutes()
    .map(toRouteSignature)
    .sort();
  const inventorySignatures = serverRouteInventory
    .map(toRouteSignature)
    .sort();

  assert.deepEqual(inventorySignatures, registeredSignatures);
});

test('serverRouteInventory uses supported access and kind classifications', () => {
  const supportedAccess = new Set(['public', 'authenticated', 'admin']);
  const supportedKinds = new Set(['read', 'mutation', 'diagnostic']);
  const uniqueSignatures = new Set();

  for (const route of serverRouteInventory) {
    assert.equal(supportedAccess.has(route.access), true);
    assert.equal(supportedKinds.has(route.kind), true);

    const signature = toRouteSignature(route);
    assert.equal(uniqueSignatures.has(signature), false);
    uniqueSignatures.add(signature);
  }
});
