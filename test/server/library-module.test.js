import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryModule } from '../../src/server/library/library-module.js';

test('createLibraryModule exposes the shared summary services and scan route dependencies', () => {
  const dispatchReadyDiscoveryRequests = () => {};
  const startLibraryDiscoveryRun = () => {};
  const buildLibraryDiscoverySummary = () => {};
  const buildLibraryReconciliationSummary = () => {};
  const buildLibraryWantedSummary = () => {};
  const buildLibraryScanSummary = () => {};
  const extractLibraryFileTags = () => {};
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
  const libraryDiscoverySummaryService = { buildLibraryDiscoverySummary };
  const libraryDiscoverySummaryStore = {};
  const libraryDiscoveryWorker = {};
  const libraryFileMatcherService = { matchLibraryFiles };
  const libraryFileMatchStore = {};
  const libraryReconciliationSummaryService = { buildLibraryReconciliationSummary };
  const libraryReconciliationSummaryStore = {};
  const libraryReleaseReconciliationService = { reconcileLibraryReleases };
  const libraryReleaseReconciliationStore = {};
  const libraryScanRunStore = {};
  const libraryScanService = { startLibraryScan };
  const libraryScanSummaryService = { buildLibraryScanSummary };
  const libraryTagExtractionService = { extractLibraryFileTags };
  const libraryTagSnapshotStore = {};
  const libraryWantedReleaseService = { reconcileWantedReleases };
  const libraryWantedReleaseStore = {};
  const libraryWantedSummaryService = { buildLibraryWantedSummary };
  const libraryWantedSummaryStore = {};
  const libraryScanWorker = {};

  const libraryModule = createLibraryModule({
    libraryCatalogStore,
    libraryDiscoveryDispatchService,
    libraryDiscoveryRunService,
    libraryDiscoveryRunStore,
    libraryDiscoveryRequestService,
    libraryDiscoveryRequestStore,
    libraryDiscoverySummaryService,
    libraryDiscoverySummaryStore,
    libraryDiscoveryWorker,
    libraryFileMatcherService,
    libraryFileMatchStore,
    libraryReconciliationSummaryService,
    libraryReconciliationSummaryStore,
    libraryReleaseReconciliationService,
    libraryReleaseReconciliationStore,
    libraryScanRunStore,
    libraryScanService,
    libraryScanSummaryService,
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
  assert.equal(libraryModule.libraryFileMatcherService, libraryFileMatcherService);
  assert.equal(libraryModule.libraryFileMatchStore, libraryFileMatchStore);
  assert.equal(libraryModule.libraryReconciliationSummaryService, libraryReconciliationSummaryService);
  assert.equal(libraryModule.libraryReconciliationSummaryStore, libraryReconciliationSummaryStore);
  assert.equal(libraryModule.libraryReleaseReconciliationService, libraryReleaseReconciliationService);
  assert.equal(libraryModule.libraryReleaseReconciliationStore, libraryReleaseReconciliationStore);
  assert.equal(libraryModule.libraryScanRunStore, libraryScanRunStore);
  assert.equal(libraryModule.libraryScanService, libraryScanService);
  assert.equal(libraryModule.libraryScanSummaryService, libraryScanSummaryService);
  assert.equal(libraryModule.libraryTagExtractionService, libraryTagExtractionService);
  assert.equal(libraryModule.libraryTagSnapshotStore, libraryTagSnapshotStore);
  assert.equal(libraryModule.libraryWantedReleaseService, libraryWantedReleaseService);
  assert.equal(libraryModule.libraryWantedReleaseStore, libraryWantedReleaseStore);
  assert.equal(libraryModule.libraryWantedSummaryService, libraryWantedSummaryService);
  assert.equal(libraryModule.libraryWantedSummaryStore, libraryWantedSummaryStore);
  assert.equal(libraryModule.libraryScanWorker, libraryScanWorker);
  assert.deepEqual(libraryModule.routeDependencies, {
    buildLibraryDiscoverySummary,
    buildLibraryReconciliationSummary,
    buildLibraryWantedSummary,
    startLibraryDiscoveryRun,
    startLibraryScan,
  });
});