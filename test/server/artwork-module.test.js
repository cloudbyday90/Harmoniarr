import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkModule } from '../../src/server/artwork/artwork-module.js';

test('createArtworkModule exposes the shared artwork policy service', () => {
  const artworkAssignmentService = {
    assignPreferredArtwork: () => {},
  };
  const artworkCleanupService = {
    cleanupUnassignedArtwork: () => {},
  };
  const artworkCleanupDetailService = {
    buildArtworkCleanupRunDetail: () => {},
  };
  const artworkCleanupHistoryService = {
    buildArtworkCleanupHistory: () => {},
  };
  const artworkCleanupRunService = {
    startArtworkCleanupRun: () => {},
  };
  const artworkCleanupRunStore = {
    getActiveRun: () => {},
  };
  const artworkCleanupWorker = {
    startWorkerRun: () => {},
  };
  const artworkFetchBackoffService = {
    clearFailure: () => {},
    recordFailure: () => {},
    shouldBackoff: () => {},
  };
  const artworkIngestionService = {
    ingestArtworkBuffer: () => {},
  };
  const artworkMonitoredArtistPrefetchService = {
    prefetchMonitoredArtistArtwork: () => {},
  };
  const artworkPolicyService = {
    buildArtworkOverview: () => {},
    getArtworkRuntimePolicy: () => {},
  };
  const artworkSummaryService = {
    buildArtworkSummary: () => {},
  };

  const artworkModule = createArtworkModule({
    artworkAssignmentService,
    artworkCleanupDetailService,
    artworkCleanupService,
    artworkCleanupHistoryService,
    artworkCleanupRunService,
    artworkCleanupRunStore,
    artworkCleanupWorker,
    artworkFetchBackoffService,
    artworkIngestionService,
    artworkMonitoredArtistPrefetchService,
    artworkPolicyService,
    artworkSummaryService,
    settingsService: { buildSettingsPayload: () => ({}) },
  });

  assert.equal(artworkModule.artworkAssignmentService, artworkAssignmentService);
  assert.equal(artworkModule.artworkCleanupDetailService, artworkCleanupDetailService);
  assert.equal(artworkModule.artworkCleanupService, artworkCleanupService);
  assert.equal(artworkModule.artworkCleanupHistoryService, artworkCleanupHistoryService);
  assert.equal(artworkModule.artworkCleanupRunService, artworkCleanupRunService);
  assert.equal(artworkModule.artworkCleanupRunStore, artworkCleanupRunStore);
  assert.equal(artworkModule.artworkCleanupWorker, artworkCleanupWorker);
  assert.equal(artworkModule.artworkFetchBackoffService, artworkFetchBackoffService);
  assert.equal(artworkModule.artworkIngestionService, artworkIngestionService);
  assert.equal(artworkModule.artworkMonitoredArtistPrefetchService, artworkMonitoredArtistPrefetchService);
  assert.equal(artworkModule.artworkPolicyService, artworkPolicyService);
  assert.equal(artworkModule.artworkSummaryService, artworkSummaryService);
  assert.equal(typeof artworkModule.artworkRepository.upsertArtworkAsset, 'function');
  assert.equal(typeof artworkModule.artworkRepository.upsertArtworkAssignment, 'function');
  assert.equal(artworkModule.routeDependencies.buildArtworkCleanupRunDetail, artworkCleanupDetailService.buildArtworkCleanupRunDetail);
  assert.equal(artworkModule.routeDependencies.buildArtworkCleanupHistory, artworkCleanupHistoryService.buildArtworkCleanupHistory);
  assert.equal(artworkModule.routeDependencies.buildArtworkSummary, artworkSummaryService.buildArtworkSummary);
  assert.equal(artworkModule.routeDependencies.startArtworkCleanupRun, artworkCleanupRunService.startArtworkCleanupRun);
  assert.equal(typeof artworkModule.routeDependencies.writeDominantColor, 'function');
});
