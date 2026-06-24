import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestService } from '../../src/server/library/library-media-request-service.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';

test('library-media-request-service calls onRequestCreatedFn after creating a request', async () => {
  const notifications = [];
  const mediaRequestStore = {
    createMediaRequest: async (data) => ({ ...data, id: 'req-1' }),
    findActiveDuplicateRequest: async () => null,
  };
  const metadataSearchService = { searchReleases: async () => ({ results: [] }) };

  const service = createLibraryMediaRequestService({
    mediaRequestStore,
    metadataSearchService,
    recordAuditEventFn: async () => {},
    recordActivityEventFn: async () => {},
    onRequestCreatedFn: async (payload) => { notifications.push(payload); },
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      requestKind: 'release',
      artistName: 'Radiohead',
      releaseTitle: 'OK Computer',
    },
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].artistName, 'Radiohead');
  assert.equal(notifications[0].releaseTitle, 'OK Computer');
  assert.equal(notifications[0].requestKind, 'release');
});

test('library-media-request-service does not call onRequestCreatedFn when null', async () => {
  const mediaRequestStore = {
    createMediaRequest: async (data) => ({ ...data, id: 'req-1' }),
    findActiveDuplicateRequest: async () => null,
  };
  const metadataSearchService = { searchReleases: async () => ({ results: [] }) };

  const service = createLibraryMediaRequestService({
    mediaRequestStore,
    metadataSearchService,
    recordAuditEventFn: async () => {},
    recordActivityEventFn: async () => {},
  });

  await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      requestKind: 'release',
      artistName: 'Radiohead',
      releaseTitle: 'OK Computer',
    },
  });
});

test('library-media-request-service swallows onRequestCreatedFn errors', async () => {
  const mediaRequestStore = {
    createMediaRequest: async (data) => ({ ...data, id: 'req-1' }),
    findActiveDuplicateRequest: async () => null,
  };
  const metadataSearchService = { searchReleases: async () => ({ results: [] }) };

  const service = createLibraryMediaRequestService({
    mediaRequestStore,
    metadataSearchService,
    recordAuditEventFn: async () => {},
    recordActivityEventFn: async () => {},
    onRequestCreatedFn: async () => { throw new Error('notification failed'); },
  });

  const result = await service.createMediaRequest({
    actorUserId: 'user-1',
    payload: {
      requestKind: 'release',
      artistName: 'Radiohead',
      releaseTitle: 'OK Computer',
    },
  });

  assert.equal(result.id, 'req-1');
});

test('reconciliation service calls onDownloadCompletedFn when transitioning to import_pending', async () => {
  const notifications = [];
  const activityEvents = [];
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: { id: 'run-1', items: [{
        importCandidateId: 'ic-1',
        itemStatus: 'active',
        planningSnapshot: { candidate: { id: 'ic-1' } },
        liveTransferSummary: { status: 'completed', message: 'done' },
        statusMessage: 'completed',
      }] },
    }),
    getImportCandidate: async () => ({ id: 'ic-1', status: 'downloading' }),
    markImportCandidateImportPending: async () => ({
      candidate: { id: 'ic-1', status: 'import_pending', username: 'uploader1', folderPath: '/music/album' },
    }),
    onDownloadCompletedFn: async (payload) => { notifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
  });

  const _result = await service.reconcileImportCandidateExecutionState();

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].importCandidateId, 'ic-1');
  assert.equal(notifications[0].username, 'uploader1');
  assert.equal(notifications[0].folderPath, '/music/album');

  assert.equal(activityEvents.length, 1);
  assert.equal(activityEvents[0].eventType, 'download_completed');
  assert.equal(activityEvents[0].entityId, 'ic-1');
});

test('reconciliation service does not call onDownloadCompletedFn when no import_pending transition', async () => {
  const notifications = [];
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: { id: 'run-1', items: [{
        importCandidateId: 'ic-1',
        itemStatus: 'active',
        planningSnapshot: { candidate: { id: 'ic-1' } },
        liveTransferSummary: { status: 'active', message: 'downloading' },
        statusMessage: 'downloading',
      }] },
    }),
    getImportCandidate: async () => ({ id: 'ic-1', status: 'selected' }),
    markImportCandidateDownloading: async () => ({
      candidate: { id: 'ic-1', status: 'downloading' },
    }),
    onDownloadCompletedFn: async (payload) => { notifications.push(payload); },
  });

  await service.reconcileImportCandidateExecutionState();

  assert.equal(notifications.length, 0);
});

test('reconciliation service swallows onDownloadCompletedFn errors', async () => {
  const service = createImportCandidateExecutionReconciliationService({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: { id: 'run-1', items: [{
        importCandidateId: 'ic-1',
        itemStatus: 'active',
        planningSnapshot: { candidate: { id: 'ic-1' } },
        liveTransferSummary: { status: 'completed', message: 'done' },
        statusMessage: 'completed',
      }] },
    }),
    getImportCandidate: async () => ({ id: 'ic-1', status: 'downloading' }),
    markImportCandidateImportPending: async () => ({
      candidate: { id: 'ic-1', status: 'import_pending' },
    }),
    onDownloadCompletedFn: async () => { throw new Error('notification failed'); },
  });

  const result = await service.reconcileImportCandidateExecutionState();
  assert.equal(result.summary.transitioned, 1);
});

test('apply worker calls onReleaseAddedFn and recordActivityEventFn after successful apply', async () => {
  const notifications = [];
  const activityEvents = [];
  let _runStarted = false;
  let _runCompleted = false;

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    releaseLease: async () => {},
    renewLease: async () => {},
    markRunStarted: async () => { _runStarted = true; },
    markRunCompleted: async () => { _runCompleted = true; },
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunCancelled: async () => {},
    buildImportPendingCandidateSummary: async () => ({
      counts: { ready: 1, readyWithWarnings: 0, blocked: 0, totalImportPending: 1 },
      importPendingCandidates: [{
        id: 'ic-1',
        importStatus: { code: 'ready', message: 'ready' },
        fileCount: 5,
        folderPath: '/music/album',
        releaseIdentity: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
        username: 'uploader1',
        importPendingAt: new Date().toISOString(),
        planning: {},
        applyPreview: {},
        requestOwnership: { sourceRequestedForUserId: 'user-1' },
      }],
    }),
    previewImportCandidateApply: async () => ({
      files: [],
      preview: {},
      summary: { status: 'ready' },
    }),
    applyImportCandidatePreview: async () => ({
      summary: { appliedFileCount: 5, failedFileCount: 0, skippedFileCount: 0 },
      fileOperations: [],
    }),
    markImportCandidateApplied: async () => null,
    replaceImportApplyRunItems: async () => [],
    updateImportApplyRunItem: async () => null,
    sendFulfillmentNotificationFn: async () => {},
    onReleaseAddedFn: async (payload) => { notifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-1',
  });

  await new Promise((resolve) => { setTimeout(resolve, 100); });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].artistName, 'Radiohead');
  assert.equal(notifications[0].importCandidateId, 'ic-1');
  assert.equal(notifications[0].releaseTitle, 'OK Computer');
  assert.equal(notifications[0].username, 'uploader1');

  const releaseAddedEvents = activityEvents.filter((e) => e.eventType === 'release_added');
  const fulfilledEvents = activityEvents.filter((e) => e.eventType === 'request_fulfilled');
  assert.equal(releaseAddedEvents.length, 1);
  assert.equal(releaseAddedEvents[0].entityArtist, 'Radiohead');
  assert.equal(releaseAddedEvents[0].entityTitle, 'OK Computer');
  assert.equal(fulfilledEvents.length, 1);
  assert.equal(fulfilledEvents[0].extraPayload.requestedForUserId, 'user-1');
});

test('apply worker does not call onReleaseAddedFn for failed apply', async () => {
  const notifications = [];
  const activityEvents = [];

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    releaseLease: async () => {},
    renewLease: async () => {},
    markRunStarted: async () => {},
    markRunCompleted: async () => {},
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunCancelled: async () => {},
    buildImportPendingCandidateSummary: async () => ({
      counts: { ready: 1, readyWithWarnings: 0, blocked: 0, totalImportPending: 1 },
      importPendingCandidates: [{
        id: 'ic-1',
        importStatus: { code: 'ready', message: 'ready' },
        fileCount: 5,
        folderPath: '/music/album',
        username: 'uploader1',
        importPendingAt: new Date().toISOString(),
        planning: {},
        applyPreview: {},
      }],
    }),
    previewImportCandidateApply: async () => ({
      files: [],
      preview: {},
      summary: { status: 'ready' },
    }),
    applyImportCandidatePreview: async () => ({
      summary: { appliedFileCount: 3, failedFileCount: 2, skippedFileCount: 0 },
      fileOperations: [],
    }),
    markImportCandidateApplied: async () => null,
    replaceImportApplyRunItems: async () => [],
    updateImportApplyRunItem: async () => null,
    sendFulfillmentNotificationFn: async () => {},
    onReleaseAddedFn: async (payload) => { notifications.push(payload); },
    recordActivityEventFn: async (payload) => { activityEvents.push(payload); },
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-1',
  });

  await new Promise((resolve) => { setTimeout(resolve, 100); });

  assert.equal(notifications.length, 0);
  assert.equal(activityEvents.length, 0);
});

test('apply worker swallows onReleaseAddedFn errors', async () => {
  let runCompleted = false;

  const worker = createImportCandidateApplyWorker({
    acquireLease: async () => {},
    releaseLease: async () => {},
    renewLease: async () => {},
    markRunStarted: async () => {},
    markRunCompleted: async () => { runCompleted = true; },
    markRunFailed: async () => {},
    markRunPaused: async () => {},
    markRunCancelled: async () => {},
    buildImportPendingCandidateSummary: async () => ({
      counts: { ready: 1, readyWithWarnings: 0, blocked: 0, totalImportPending: 1 },
      importPendingCandidates: [{
        id: 'ic-1',
        importStatus: { code: 'ready', message: 'ready' },
        fileCount: 5,
        folderPath: '/music/album',
        username: 'uploader1',
        importPendingAt: new Date().toISOString(),
        planning: {},
        applyPreview: {},
      }],
    }),
    previewImportCandidateApply: async () => ({
      files: [],
      preview: {},
      summary: { status: 'ready' },
    }),
    applyImportCandidatePreview: async () => ({
      summary: { appliedFileCount: 5, failedFileCount: 0, skippedFileCount: 0 },
      fileOperations: [],
    }),
    markImportCandidateApplied: async () => null,
    replaceImportApplyRunItems: async () => [],
    updateImportApplyRunItem: async () => null,
    sendFulfillmentNotificationFn: async () => {},
    onReleaseAddedFn: async () => { throw new Error('notification failed'); },
    recordActivityEventFn: async () => {},
  });

  await worker.startWorkerRun({
    executableCandidateCount: 1,
    requestedCandidateCount: 1,
    runId: 'run-1',
  });

  await new Promise((resolve) => { setTimeout(resolve, 100); });
  assert.ok(runCompleted);
});
