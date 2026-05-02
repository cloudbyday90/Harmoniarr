import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryModule } from '../../src/server/library/library-module.js';

test('createLibraryModule exposes the shared summary services and scan route dependencies', () => {
  const artworkAssignmentService = {};
  const artworkIngestionService = {};
  const dispatchReadyDiscoveryRequests = () => {};
  const startLibraryDiscoveryRun = () => {};
  const buildLibraryDiscoveryRunDetail = () => {};
  const buildLibraryDiscoverySummary = () => {};
  const startLibraryOrganizeApplyRun = () => {};
  const buildLibraryOrganizePreview = () => {};
  const buildMediaRequestSummary = () => {};
  const buildLibraryReconciliationSummary = () => {};
  const buildLibraryWantedSummary = () => {};
  const buildLibraryScanRunDetail = () => {};
  const buildLibraryScanSummary = () => {};
  const captureEmbeddedArtwork = () => {};
  const captureSidecarArtwork = () => {};
  const createMediaRequest = () => {};
  const extractLibraryFileTags = () => {};
  const listMediaRequests = () => {};
  const matchLibraryFiles = () => {};
  const reconcileDiscoveryRequests = () => {};
  const reconcileLibraryReleases = () => {};
  const reconcileWantedReleases = () => {};
  const startLibraryScan = () => {};
  const libraryCatalogStore = {};
  const libraryDiscoveryDispatchService = { dispatchReadyDiscoveryRequests };
  const libraryDiscoveryRunService = { startLibraryDiscoveryRun };
  const libraryDiscoveryRunStore = {};
  const libraryDiscoveryRequestService = { reconcileDiscoveryRequests };
  const libraryDiscoveryRequestStore = {};
  const libraryDiscoverySummaryService = { buildLibraryDiscoveryRunDetail, buildLibraryDiscoverySummary };
  const libraryDiscoverySummaryStore = {};
  const libraryDiscoveryWorker = {};
  const libraryEmbeddedArtworkService = { captureEmbeddedArtwork };
  const libraryFileMatcherService = { matchLibraryFiles };
  const libraryFileMatchStore = {};
  const libraryMediaRequestService = { buildMediaRequestSummary, createMediaRequest, listMediaRequests };
  const libraryMediaRequestStore = {};
  const libraryOrganizeApplyRunStore = {};
  const libraryOrganizeApplyService = { startLibraryOrganizeApplyRun };
  const libraryOrganizeApplyWorker = {};
  const libraryOrganizePreviewService = { buildLibraryOrganizePreview };
  const libraryOrganizePreviewStore = {};
  const providerClientResolverService = {};
  const libraryReleaseAvailabilityStore = {};
  const libraryExternalIntakeRunStore = {};
  const libraryExternalIntakeService = {};
  const libraryExternalIntakeWorker = {};
  const libraryProviderIngestPlanningService = {};
  const libraryProviderIngestRequestStore = {};
  const libraryReconciliationSummaryService = { buildLibraryReconciliationSummary };
  const libraryReconciliationSummaryStore = {};
  const libraryReleaseReconciliationService = { reconcileLibraryReleases };
  const libraryReleaseReconciliationStore = {};
  const libraryScanRunStore = {};
  const libraryScanService = { startLibraryScan };
  const libraryScanSummaryService = { buildLibraryScanRunDetail, buildLibraryScanSummary };
  const librarySidecarArtworkService = { captureSidecarArtwork };
  const libraryTagExtractionService = { extractLibraryFileTags };
  const libraryTagSnapshotStore = {};
  const libraryWantedReleaseService = { reconcileWantedReleases };
  const libraryWantedReleaseStore = {};
  const libraryWantedSummaryService = { buildLibraryWantedSummary };
  const libraryWantedSummaryStore = {};
  const libraryScanWorker = {};

  const libraryModule = createLibraryModule({
    artworkAssignmentService,
    artworkIngestionService,
    libraryCatalogStore,
    libraryDiscoveryDispatchService,
    libraryDiscoveryRunService,
    libraryDiscoveryRunStore,
    libraryDiscoveryRequestService,
    libraryDiscoveryRequestStore,
    libraryDiscoverySummaryService,
    libraryDiscoverySummaryStore,
    libraryDiscoveryWorker,
    libraryEmbeddedArtworkService,
    libraryFileMatcherService,
    libraryFileMatchStore,
    libraryMediaRequestService,
    libraryMediaRequestStore,
    libraryOrganizeApplyRunStore,
    libraryOrganizeApplyService,
    libraryOrganizeApplyWorker,
    libraryOrganizePreviewService,
    libraryOrganizePreviewStore,
    providerClientResolverService,
    libraryReleaseAvailabilityStore,
    libraryExternalIntakeRunStore,
    libraryExternalIntakeService,
    libraryExternalIntakeWorker,
    libraryProviderIngestPlanningService,
    libraryProviderIngestRequestStore,
    libraryReconciliationSummaryService,
    libraryReconciliationSummaryStore,
    libraryReleaseReconciliationService,
    libraryReleaseReconciliationStore,
    libraryScanRunStore,
    libraryScanService,
    libraryScanSummaryService,
    librarySidecarArtworkService,
    libraryTagExtractionService,
    libraryTagSnapshotStore,
    libraryWantedReleaseService,
    libraryWantedReleaseStore,
    libraryWantedSummaryService,
    libraryWantedSummaryStore,
    libraryScanWorker,
    settingsService: {},
  });

  assert.equal(libraryModule.libraryCatalogStore, libraryCatalogStore);
  assert.equal(libraryModule.libraryDiscoveryDispatchService, libraryDiscoveryDispatchService);
  assert.equal(libraryModule.libraryDiscoveryRunService, libraryDiscoveryRunService);
  assert.equal(libraryModule.libraryDiscoveryRunStore, libraryDiscoveryRunStore);
  assert.equal(libraryModule.libraryDiscoveryRequestService, libraryDiscoveryRequestService);
  assert.equal(libraryModule.libraryDiscoveryRequestStore, libraryDiscoveryRequestStore);
  assert.equal(libraryModule.libraryDiscoverySummaryService, libraryDiscoverySummaryService);
  assert.equal(libraryModule.libraryDiscoverySummaryStore, libraryDiscoverySummaryStore);
  assert.equal(libraryModule.libraryDiscoveryWorker, libraryDiscoveryWorker);
  assert.equal(libraryModule.libraryEmbeddedArtworkService, libraryEmbeddedArtworkService);
  assert.equal(libraryModule.libraryFileMatcherService, libraryFileMatcherService);
  assert.equal(libraryModule.libraryFileMatchStore, libraryFileMatchStore);
  assert.equal(libraryModule.libraryMediaRequestService, libraryMediaRequestService);
  assert.equal(libraryModule.libraryMediaRequestStore, libraryMediaRequestStore);
  assert.equal(libraryModule.libraryOrganizeApplyRunStore, libraryOrganizeApplyRunStore);
  assert.equal(libraryModule.libraryOrganizeApplyService, libraryOrganizeApplyService);
  assert.equal(libraryModule.libraryOrganizeApplyWorker, libraryOrganizeApplyWorker);
  assert.equal(libraryModule.libraryOrganizePreviewService, libraryOrganizePreviewService);
  assert.equal(libraryModule.libraryOrganizePreviewStore, libraryOrganizePreviewStore);
  assert.equal(libraryModule.providerClientResolverService, providerClientResolverService);
  assert.equal(libraryModule.libraryReleaseAvailabilityStore, libraryReleaseAvailabilityStore);
  assert.equal(libraryModule.libraryExternalIntakeRunStore, libraryExternalIntakeRunStore);
  assert.equal(libraryModule.libraryExternalIntakeService, libraryExternalIntakeService);
  assert.equal(libraryModule.libraryExternalIntakeWorker, libraryExternalIntakeWorker);
  assert.equal(libraryModule.libraryProviderIngestPlanningService, libraryProviderIngestPlanningService);
  assert.equal(libraryModule.libraryProviderIngestRequestStore, libraryProviderIngestRequestStore);
  assert.equal(libraryModule.libraryReconciliationSummaryService, libraryReconciliationSummaryService);
  assert.equal(libraryModule.libraryReconciliationSummaryStore, libraryReconciliationSummaryStore);
  assert.equal(libraryModule.libraryReleaseReconciliationService, libraryReleaseReconciliationService);
  assert.equal(libraryModule.libraryReleaseReconciliationStore, libraryReleaseReconciliationStore);
  assert.equal(libraryModule.libraryScanRunStore, libraryScanRunStore);
  assert.equal(libraryModule.libraryScanService, libraryScanService);
  assert.equal(libraryModule.libraryScanSummaryService, libraryScanSummaryService);
  assert.equal(libraryModule.librarySidecarArtworkService, librarySidecarArtworkService);
  assert.equal(libraryModule.libraryTagExtractionService, libraryTagExtractionService);
  assert.equal(libraryModule.libraryTagSnapshotStore, libraryTagSnapshotStore);
  assert.equal(libraryModule.libraryWantedReleaseService, libraryWantedReleaseService);
  assert.equal(libraryModule.libraryWantedReleaseStore, libraryWantedReleaseStore);
  assert.equal(libraryModule.libraryWantedSummaryService, libraryWantedSummaryService);
  assert.equal(libraryModule.libraryWantedSummaryStore, libraryWantedSummaryStore);
  assert.equal(libraryModule.libraryScanWorker, libraryScanWorker);
  assert.deepEqual(libraryModule.routeDependencies, {
    buildLibraryDiscoveryRunDetail,
    buildLibraryDiscoverySummary,
    buildLibraryOrganizePreview,
    buildMediaRequestSummary,
    buildLibraryReconciliationSummary,
    buildLibraryScanRunDetail,
    buildLibraryWantedSummary,
    createMediaRequest,
    listMediaRequests,
    startLibraryOrganizeApplyRun,
    startLibraryDiscoveryRun,
    startLibraryScan,
  });
});
