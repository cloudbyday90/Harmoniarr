import { registerActivityRoutes } from '../../src/server/routes/activity-routes.js';
import { registerAppUserRoutes } from '../../src/server/routes/app-user-routes.js';
import { registerArtworkRoutes } from '../../src/server/routes/artwork-routes.js';
import { registerAuthRoutes } from '../../src/server/routes/auth-routes.js';
import { registerImportCandidateRoutes } from '../../src/server/routes/import-candidate-routes.js';
import { registerLibraryRoutes } from '../../src/server/routes/library-routes.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { registerOperationsRoutes } from '../../src/server/routes/operations-routes.js';
import { registerSystemRoutes } from '../../src/server/routes/system-routes.js';
import { createJsonTestApp } from '../../testing/server/http-test-helpers.js';
import { runPaginationRegressionTests } from '../../testing/server/pagination-regression-runner.js';

function _noopMiddleware(_request, _response, next) { next(); }

const stubSession = async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', csrfTokenHash: 'hashed' });
const stubAdminSession = async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-token', csrfTokenHash: 'hashed', user: { role: 'admin' } });

const emptyFeed = () => ({ checkedAt: '2026-01-01T00:00:00Z', entries: [], total: 0 });
const emptyList = () => ({ items: [], total: 0 });

function createActivityApp() {
  return createJsonTestApp((app) => {
    registerActivityRoutes(app, {
      buildActivityFeed: emptyFeed,
      getSourceUserDetail: async () => ({ checkedAt: '2026-01-01T00:00:00Z', sourceUser: { trustHistory: [], trustState: 'neutral', username: 'peer-1' } }),
      requireSession: stubSession,
      requireAdminSession: stubAdminSession,
      requireFreshAdminSession: stubAdminSession,
      requireCsrf: () => {},
    });
  });
}

function createAppUserApp() {
  return createJsonTestApp((app) => {
    registerAppUserRoutes(app, {
      getAppUserById: async ({ userId }) => ({ id: userId, username: 'test-user', role: 'requester' }),
      requireAdminSession: stubAdminSession,
      requireFreshAdminSession: stubAdminSession,
      requireFreshSession: stubSession,
      requireCsrf: () => {},
      listAppUsersPage: async () => ({ users: [], totalCount: 0 }),
      listAppUsers: async () => [],
      countAppUsers: async () => 0,
      listUserAuditEvents: async () => ({ events: [], hasMore: false, nextCursor: null }),
    });
  });
}

function createArtworkApp() {
  return createJsonTestApp((app) => {
    registerArtworkRoutes(app, {
      buildArtworkCleanupHistory: emptyList,
      requireAdminSession: stubAdminSession,
      requireSession: stubSession,
      requireFreshAdminSession: stubAdminSession,
      requireCsrf: () => {},
      getRequestMetadata: (req) => ({ ipAddress: req.ip, userAgent: null }),
    });
  });
}

function createAuthApp() {
  return createJsonTestApp((app) => {
    registerAuthRoutes(app, {
      requireSession: stubSession,
      requireFreshSession: stubSession,
      requireCsrf: () => {},
      createRecentActivityResponse: (payload) => ({ ok: true, ...payload }),
      listRecentActivity: async () => [],
    });
  });
}

function createImportCandidateApp() {
  return createJsonTestApp((app) => {
    registerImportCandidateRoutes(app, {
      listImportCandidates: emptyList,
      buildSelectedImportCandidateSummary: emptyList,
      buildImportPendingCandidateSummary: emptyList,
      requireSession: stubSession,
      requireAdminSession: stubAdminSession,
      requireFreshAdminSession: stubAdminSession,
      requireCsrf: () => {},
    });
  });
}

function createLibraryApp() {
  return createJsonTestApp((app) => {
    registerLibraryRoutes(app, {
      listMediaRequests: emptyList,
      listMediaRequestEventsPage: async () => ({ events: [], hasMore: false }),
      buildReleaseRadar: async () => ({ releases: [] }),
      buildLibraryReleases: async () => ({ releases: [] }),
      buildLibraryWantedReleases: async () => ({ releases: [] }),
      requireSession: stubSession,
      requireAdminSession: stubAdminSession,
      requireFreshAdminSession: stubAdminSession,
      requireCsrf: () => {},
      getRequestMetadata: (req) => ({ ipAddress: req.ip, userAgent: null }),
    });
  });
}

function createMetadataApp() {
  return createJsonTestApp((app) => {
    registerMetadataRoutes(app, {
      searchLocalMetadataArtists: async () => ({ results: [] }),
      searchLocalMetadataReleaseGroups: async () => ({ results: [] }),
      searchLocalMetadataReleases: async () => ({ results: [] }),
      searchAllLocalMetadata: async () => ({ artists: [], releaseGroups: [], releases: [] }),
      listMonitoredArtists: async () => ({ results: [] }),
      searchMusicBrainzArtists: async () => ({ results: [] }),
      searchMusicBrainzReleases: async () => ({ results: [] }),
      browseMusicBrainzArtistReleaseGroups: async () => ({ browse: { results: [] } }),
      getMusicBrainzReleaseGroupReleases: async () => ({ results: [] }),
      getMetadataArtistDetectionEvents: async () => ({ entries: [], pageInfo: { hasMore: false, nextCursor: null } }),
      getSimilarArtists: async () => ({ similar: [] }),
      requireSession: stubSession,
      requireFreshAdminSession: stubAdminSession,
      requireFreshSession: stubSession,
      requireCsrf: () => {},
      getRequestMetadata: (req) => ({ ipAddress: req.ip, userAgent: null }),
    });
  });
}

function createOperationsApp() {
  return createJsonTestApp((app) => {
    registerOperationsRoutes(app, {
      buildOperationHistory: async () => ({ checkedAt: '2026-01-01T00:00:00Z', runs: [] }),
      buildOperationRunDetail: async () => ({ checkedAt: '2026-01-01T00:00:00Z', run: { id: 'run-1' }, auditEvents: [] }),
      requireAdminSession: stubAdminSession,
      requireFreshAdminSession: stubAdminSession,
      requireCsrf: () => {},
    });
  });
}

function createSystemApp() {
  return createJsonTestApp((app) => {
    registerSystemRoutes(app, {
      appPort: 4312,
      getActivityFeed: emptyFeed,
      getOperatorNotifications: async () => ({ checkedAt: '2026-01-01T00:00:00Z', notifications: [] }),
      listBackupExports: async () => ({ backupArtifacts: [] }),
      getQueueDiagnostics: async () => ({ checkedAt: '2026-01-01T00:00:00Z', queueState: {}, recentRuns: [] }),
      getRecoveryDiagnostics: async () => ({ checkedAt: '2026-01-01T00:00:00Z', maintenance: {}, recentFailedRuns: [], recentPrivilegedActions: [] }),
      getDiagnosticsExportDownload: async () => ({ content: Buffer.from('{}'), contentType: 'application/json', filename: 'diag.json' }),
      requireAdminSession: stubAdminSession,
      requireFreshAdminSession: stubAdminSession,
      requireCsrf: () => {},
      getRequestMetadata: (req) => ({ ipAddress: req.ip, userAgent: null }),
      buildLibraryScanSummary: async () => ({ checkedAt: '2026-01-01T00:00:00Z', summary: {} }),
      buildOnboardingSummary: async () => ({ checkedAt: '2026-01-01T00:00:00Z', summary: {} }),
      buildSettingsPayload: async () => ({ settings: {} }),
      executeIdempotentMutation: async ({ executeMutation }) => executeMutation(),
    });
  });
}

runPaginationRegressionTests(createActivityApp, [
  { path: '/api/v1/activity/feed', params: ['limit'] },
  { path: '/api/v1/activity/source-users/:username', params: ['historyLimit', 'historyOffset'], pathParams: { username: 'peer-1' } },
]);

runPaginationRegressionTests(createAppUserApp, [
  { path: '/api/v1/users', params: ['limit', 'offset'] },
  { path: '/api/v1/users/:userId/activity', params: ['limit'], pathParams: { userId: 'user-1' } },
]);

runPaginationRegressionTests(createArtworkApp, [
  { path: '/api/v1/artwork/cleanup-runs', params: ['limit'] },
]);

runPaginationRegressionTests(createAuthApp, [
  { path: '/api/v1/auth/activity', params: ['limit'] },
]);

runPaginationRegressionTests(createImportCandidateApp, [
  { path: '/api/v1/import-candidates', params: ['limit', 'offset'] },
  { path: '/api/v1/import-candidates/selected-summary', params: ['limit'] },
  { path: '/api/v1/import-candidates/import-pending-summary', params: ['limit'] },
]);

runPaginationRegressionTests(createLibraryApp, [
  { path: '/api/v1/library/media-requests', params: ['limit', 'offset'] },
  { path: '/api/v1/library/media-requests/:mediaRequestId/events', params: ['limit'], pathParams: { mediaRequestId: 'req-1' } },
  { path: '/api/v1/library/release-radar', params: ['limit'] },
  { path: '/api/v1/library/releases', params: ['limit'] },
  { path: '/api/v1/library/wanted-releases', params: ['limit'] },
]);

runPaginationRegressionTests(createMetadataApp, [
  { path: '/api/v1/metadata/artists/search', params: ['limit'] },
  { path: '/api/v1/search', params: ['artistLimit', 'releaseGroupLimit', 'releaseLimit'] },
  { path: '/api/v1/metadata/artists/monitored', params: ['limit'] },
  { path: '/api/v1/metadata/release-groups/search', params: ['limit'] },
  { path: '/api/v1/metadata/releases/search', params: ['limit'] },
  { path: '/api/v1/metadata/artists/:artistId/detection-events', params: ['limit'], pathParams: { artistId: 'artist-1' } },
  { path: '/api/v1/metadata/artists/:artistId/similar', params: ['limit'], pathParams: { artistId: 'artist-1' } },
  { path: '/api/v1/metadata/musicbrainz/artists/search', params: ['limit'] },
  { path: '/api/v1/metadata/musicbrainz/releases/search', params: ['limit'] },
  { path: '/api/v1/metadata/musicbrainz/artists/:artistId/release-groups', params: ['limit', 'offset'], pathParams: { artistId: 'mb-1' } },
  { path: '/api/v1/metadata/musicbrainz/release-groups/:releaseGroupId/releases', params: ['limit', 'offset'], pathParams: { releaseGroupId: 'rg-1' } },
]);

runPaginationRegressionTests(createOperationsApp, [
  { path: '/api/v1/operations/history', params: ['limit'] },
  { path: '/api/v1/operations/runs/:runId', params: ['auditLimit'], pathParams: { runId: 'run-1' } },
]);

runPaginationRegressionTests(createSystemApp, [
  { path: '/api/v1/system/activity-feed', params: ['limit'] },
  { path: '/api/v1/system/operator-notifications', params: ['limit'] },
  { path: '/api/v1/recovery/backups', params: ['limit'] },
  { path: '/api/v1/system/diagnostics/queue-state', params: ['runLimit'] },
  { path: '/api/v1/system/diagnostics/recovery-state', params: ['auditLimit', 'runLimit'] },
  { path: '/api/v1/system/diagnostics/export', params: ['activityLimit', 'auditLimit', 'notificationLimit', 'runLimit'] },
]);
