import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

test('operation queue handlers register shared operation types and map run summaries to worker inputs', async (t) => {
  const artworkCleanupStartWorkerRun = t.mock.fn(async () => {});
  const importCandidateExecutionStartWorkerRun = t.mock.fn(async () => {});
  const importCandidateApplyStartWorkerRun = t.mock.fn(async () => {});
  const importCandidateMediaInspectionStartWorkerRun = t.mock.fn(async () => {});
  const importCandidateTranscodeStartWorkerRun = t.mock.fn(async () => {});
  const libraryDiscoveryStartWorkerRun = t.mock.fn(async () => {});
  const libraryExternalIntakeStartWorkerRun = t.mock.fn(async () => {});
  const libraryOrganizeApplyStartWorkerRun = t.mock.fn(async () => {});
  const libraryScanStartWorkerRun = t.mock.fn(async () => {});
  const metadataArtistRefreshStartWorkerRun = t.mock.fn(async () => {});
  const operatorNotificationFanoutStartWorkerRun = t.mock.fn(async () => {});
  const handlers = createOperationQueueHandlers({
    artworkModule: {
      artworkCleanupWorker: {
        startWorkerRun: artworkCleanupStartWorkerRun,
      },
    },
    importCandidateModule: {
      importCandidateApplyWorker: {
        startWorkerRun: importCandidateApplyStartWorkerRun,
      },
      importCandidateExecutionWorker: {
        startWorkerRun: importCandidateExecutionStartWorkerRun,
      },
      importCandidateMediaInspectionWorker: {
        startWorkerRun: importCandidateMediaInspectionStartWorkerRun,
      },
      importCandidateTranscodeWorker: {
        startWorkerRun: importCandidateTranscodeStartWorkerRun,
      },
    },
    libraryModule: {
      libraryDiscoveryWorker: {
        startWorkerRun: libraryDiscoveryStartWorkerRun,
      },
      libraryExternalIntakeWorker: {
        startWorkerRun: libraryExternalIntakeStartWorkerRun,
      },
      libraryOrganizeApplyWorker: {
        startWorkerRun: libraryOrganizeApplyStartWorkerRun,
      },
      libraryScanWorker: {
        startWorkerRun: libraryScanStartWorkerRun,
      },
    },
    metadataModule: {
      metadataArtistRefreshWorker: {
        startWorkerRun: metadataArtistRefreshStartWorkerRun,
      },
    },
    systemModule: {
      operatorNotificationFanoutWorker: {
        startWorkerRun: operatorNotificationFanoutStartWorkerRun,
      },
    },
  });

  assert.deepEqual(Object.keys(handlers).sort(), [
    'artwork_cleanup',
    'import_candidate_apply',
    'import_candidate_execution_planning',
    'import_candidate_media_inspection',
    'import_candidate_transcode_orchestration',
    'library_discovery_dispatch',
    'library_external_intake_planning',
    'library_organize_apply',
    'library_scan',
    'metadata_artist_refresh',
    'operator_notification_fanout',
  ]);

  await handlers.artwork_cleanup({
    run: {
      id: 'run-1',
      summary: {
        requestedAssetCount: 9,
        retentionCutoff: '2026-05-01T00:00:00.000Z',
      },
    },
  });
  await handlers.import_candidate_execution_planning({
    run: {
      id: 'run-2',
      summary: {
        requestedCandidateCount: 7,
      },
    },
  });
  await handlers.import_candidate_apply({
    run: {
      id: 'run-3',
      summary: {
        executableCandidateCount: 4,
        requestedCandidateCount: 6,
      },
    },
  });
  await handlers.import_candidate_media_inspection({
    run: {
      id: 'run-10',
      summary: {
        requestedCandidateCount: 5,
      },
    },
  });
  await handlers.import_candidate_transcode_orchestration({
    run: {
      id: 'run-11',
      summary: {
        requestedCandidateCount: 5,
        transcodeCandidateFileCount: 3,
      },
    },
  });
  await handlers.library_external_intake_planning({
    run: {
      id: 'run-7',
      summary: {
        canonicalUrl: 'https://open.spotify.com/playlist/abc',
        mediaRequestId: 'req-1',
        resourceType: 'playlist',
        sourceIdentifier: 'abc',
        sourceProvider: 'spotify',
        triggerSource: 'request_submit',
      },
      triggeredByUserId: 'user-1',
    },
  });
  await handlers.library_discovery_dispatch({
    run: {
      id: 'run-4',
      summary: {
        triggerSource: 'automatic',
      },
      triggeredByUserId: 'admin-1',
    },
  });
  await handlers.library_scan({
    run: {
      id: 'run-5',
      summary: {
        libraryRoot: 'D:/music',
      },
    },
  });
  await handlers.metadata_artist_refresh({
    run: {
      id: 'run-6',
      summary: {
        artistName: 'Autechre',
        metadataArtistId: 'local-artist-1',
        musicBrainzArtistId: 'mb-artist-1',
        triggerSource: 'heartbeat',
      },
    },
  });
  await handlers.library_organize_apply({
    run: {
      id: 'run-8',
      summary: {
        plannedRenameCount: 3,
      },
    },
  });
  await handlers.operator_notification_fanout({
    run: {
      id: 'run-9',
      summary: {},
    },
  });

  assert.deepEqual(artworkCleanupStartWorkerRun.mock.calls[0].arguments[0], {
    requestedAssetCount: 9,
    retentionCutoff: '2026-05-01T00:00:00.000Z',
    runId: 'run-1',
  });
  assert.deepEqual(importCandidateExecutionStartWorkerRun.mock.calls[0].arguments[0], {
    requestedCandidateCount: 7,
    runId: 'run-2',
  });
  assert.deepEqual(importCandidateApplyStartWorkerRun.mock.calls[0].arguments[0], {
    executableCandidateCount: 4,
    requestedCandidateCount: 6,
    runId: 'run-3',
  });
  assert.deepEqual(importCandidateMediaInspectionStartWorkerRun.mock.calls[0].arguments[0], {
    requestedCandidateCount: 5,
    runId: 'run-10',
  });
  assert.deepEqual(importCandidateTranscodeStartWorkerRun.mock.calls[0].arguments[0], {
    requestedCandidateCount: 5,
    runId: 'run-11',
    transcodeCandidateFileCount: 3,
  });
  assert.deepEqual(libraryDiscoveryStartWorkerRun.mock.calls[0].arguments[0], {
    runId: 'run-4',
    triggerSource: 'automatic',
    triggeredByUserId: 'admin-1',
  });
  assert.deepEqual(libraryScanStartWorkerRun.mock.calls[0].arguments[0], {
    libraryRoot: 'D:/music',
    runId: 'run-5',
  });
  assert.deepEqual(libraryOrganizeApplyStartWorkerRun.mock.calls[0].arguments[0], {
    plannedRenameCount: 3,
    runId: 'run-8',
  });
  assert.deepEqual(libraryExternalIntakeStartWorkerRun.mock.calls[0].arguments[0], {
    canonicalUrl: 'https://open.spotify.com/playlist/abc',
    mediaRequestId: 'req-1',
    resourceType: 'playlist',
    runId: 'run-7',
    sourceIdentifier: 'abc',
    sourceProvider: 'spotify',
    triggerSource: 'request_submit',
    triggeredByUserId: 'user-1',
  });
  assert.deepEqual(metadataArtistRefreshStartWorkerRun.mock.calls[0].arguments[0], {
    artistName: 'Autechre',
    metadataArtistId: 'local-artist-1',
    musicBrainzArtistId: 'mb-artist-1',
    runId: 'run-6',
    triggerSource: 'heartbeat',
  });
  assert.deepEqual(operatorNotificationFanoutStartWorkerRun.mock.calls[0].arguments[0], {
    runId: 'run-9',
  });
});