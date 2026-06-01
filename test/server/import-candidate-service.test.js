import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createImportCandidateService,
  normalizeSlskdResponsesToImportCandidates,
} from '../../src/server/import-candidates/import-candidate-service.js';

function createPool(t) {
  const client = {
    query: t.mock.fn(async () => ({ rows: [] })),
    release: t.mock.fn(),
  };

  return {
    client,
    pool: {
      connect: t.mock.fn(async () => client),
    },
  };
}

function createStoredCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    sourceResponseKey: 'response-key',
    username: 'source-user',
    folderPath: 'Autechre\\Amber',
    candidateType: 'manual_search',
    status: 'pending',
    fileCount: 1,
    lockedFileCount: 0,
    totalSizeBytes: 123,
    rawPayload: { raw: true },
    normalizedPayload: { normalized: true },
    discoveredAt: '2026-04-30T14:00:00.000Z',
    createdAt: '2026-04-30T14:00:00.000Z',
    updatedAt: '2026-04-30T14:00:00.000Z',
    ...overrides,
  };
}

test('normalizeSlskdResponsesToImportCandidates groups slskd files by user and folder', () => {
  const candidates = normalizeSlskdResponsesToImportCandidates({
    discoveredAt: new Date('2026-04-30T14:00:00.000Z'),
    requestOwnership: {
      sourceRequestedByUserId: 'admin-1',
      sourceRequestedForUserId: 'user-2',
      sourceType: 'media_request',
    },
    searchId: 'search-1',
    responses: [{
      username: 'source-user',
      hasFreeUploadSlot: true,
      queueLength: 1,
      uploadSpeed: 100000,
      files: [{
        filename: 'Autechre\\Amber\\01 Foil.flac',
        size: 123,
        bitRate: 900,
        sampleRate: 44100,
      }, {
        filename: 'Autechre\\Amber\\02 Montreal.flac',
        size: 456,
        bitDepth: 16,
      }, {
        filename: 'Autechre\\Tri Repetae\\01 Dael.flac',
        size: 789,
      }],
      lockedFiles: [{
        filename: 'Autechre\\Amber\\03 Silverside.flac',
        size: 100,
      }],
    }],
  });

  assert.equal(candidates.length, 2);
  assert.deepEqual(
    candidates.map((candidate) => ({
      username: candidate.username,
      folderPath: candidate.folderPath,
      fileCount: candidate.fileCount,
      lockedFileCount: candidate.lockedFileCount,
      totalSizeBytes: candidate.totalSizeBytes,
      extensions: candidate.normalizedPayload.extensions,
      discoveredAt: candidate.discoveredAt,
    })),
    [{
      username: 'source-user',
      folderPath: 'Autechre\\Amber',
      fileCount: 3,
      lockedFileCount: 1,
      totalSizeBytes: 679,
      extensions: ['flac'],
      discoveredAt: '2026-04-30T14:00:00.000Z',
    }, {
      username: 'source-user',
      folderPath: 'Autechre\\Tri Repetae',
      fileCount: 1,
      lockedFileCount: 0,
      totalSizeBytes: 789,
      extensions: ['flac'],
      discoveredAt: '2026-04-30T14:00:00.000Z',
    }],
  );
  assert.equal(candidates[0].sourceProvider, 'slskd');
  assert.equal(candidates[0].sourceSearchId, 'search-1');
  assert.equal(candidates[0].status, 'pending');
  assert.equal(candidates[0].candidateType, 'manual_search');
  assert.equal(candidates[0].files[0].filename, '01 Foil.flac');
  assert.equal(candidates[0].files[0].extension, 'flac');
  assert.equal(candidates[0].files[2].isLocked, true);
  assert.equal(candidates[0].rawPayload.response.files.length, 2);
  assert.equal(candidates[0].rawPayload.response.lockedFiles.length, 1);
  assert.deepEqual(candidates[0].normalizedPayload.requestOwnership, {
    sourceRequestedByUserId: 'admin-1',
    sourceRequestedForUserId: 'user-2',
    sourceType: 'media_request',
  });
  assert.deepEqual(candidates[0].rawPayload.requestOwnership, {
    sourceRequestedByUserId: 'admin-1',
    sourceRequestedForUserId: 'user-2',
    sourceType: 'media_request',
  });
});

test('normalizeSlskdResponsesToImportCandidates includes formatMatchScore when formatPreferences provided', () => {
  const candidates = normalizeSlskdResponsesToImportCandidates({
    formatPreferences: {
      preferredFormat: 'flac',
      minimumQuality: 'any',
    },
    discoveredAt: new Date('2026-04-30T14:00:00.000Z'),
    searchId: 'search-1',
    responses: [{
      username: 'source-user',
      files: [{
        filename: 'Artist\\Album\\01 Track.flac',
        size: 100,
      }],
    }],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].normalizedPayload.formatMatchScore, 100);
  assert.equal(candidates[0].normalizedPayload.formatMatchLabel, 'Format match');
});

test('normalizeSlskdResponsesToImportCandidates omits formatMatchScore when formatPreferences is null', () => {
  const candidates = normalizeSlskdResponsesToImportCandidates({
    formatPreferences: null,
    discoveredAt: new Date('2026-04-30T14:00:00.000Z'),
    searchId: 'search-1',
    responses: [{
      username: 'source-user',
      files: [{
        filename: 'Artist\\Album\\01 Track.flac',
        size: 100,
      }],
    }],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].normalizedPayload.formatMatchScore, undefined);
  assert.equal(candidates[0].normalizedPayload.formatMatchLabel, undefined);
});

test('normalizeSlskdResponsesToImportCandidates scores below quality floor as 0', () => {
  const candidates = normalizeSlskdResponsesToImportCandidates({
    formatPreferences: {
      preferredFormat: 'any',
      minimumQuality: 'lossless',
    },
    discoveredAt: new Date('2026-04-30T14:00:00.000Z'),
    searchId: 'search-1',
    responses: [{
      username: 'source-user',
      files: [{
        filename: 'Artist\\Album\\01 Track.mp3',
        size: 100,
      }],
    }],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].normalizedPayload.formatMatchScore, 0);
  assert.equal(candidates[0].normalizedPayload.formatMatchLabel, 'Below quality floor');
});

test('createImportCandidateService ingests slskd responses in one transaction and records audit', async (t) => {
  const { client, pool } = createPool(t);
  const slskdService = {
    getSearchResponses: t.mock.fn(async () => ({
      searchId: 'search-1',
      responses: [{
        username: 'source-user',
        files: [{
          filename: 'Boards of Canada\\Music Has the Right to Children\\01 Wildlife Analysis.flac',
          size: 321,
        }],
      }],
    })),
  };
  const upsertImportCandidateFn = t.mock.fn(async (candidate) => ({
    id: 'candidate-1',
    ...candidate,
  }));
  const replaceImportCandidateFilesFn = t.mock.fn(async (importCandidateId, files) => files.map((file) => ({
    id: `file-${file.sourceFileIndex}`,
    importCandidateId,
    ...file,
  })));
  const recordAuditEventFn = t.mock.fn();
  const service = createImportCandidateService({
    pool,
    recordAuditEventFn,
    replaceImportCandidateFilesFn,
    slskdService,
    upsertImportCandidateFn,
  });

  const result = await service.ingestSlskdSearchResponses({
    actorUserId: 'user-1',
    requestOwnership: {
      sourceRequestedByUserId: 'admin-9',
      sourceRequestedForUserId: 'user-12',
      sourceType: 'media_request',
    },
    requestMetadata: {
      ipAddress: '203.0.113.10',
      userAgent: 'HarmoniarrTest/1.0',
    },
    searchId: 'search-1',
  });

  assert.equal(slskdService.getSearchResponses.mock.callCount(), 1);
  assert.deepEqual(slskdService.getSearchResponses.mock.calls[0].arguments, [{ searchId: 'search-1' }]);
  assert.equal(pool.connect.mock.callCount(), 1);
  assert.deepEqual(client.query.mock.calls.map((call) => call.arguments[0]), ['BEGIN', 'COMMIT']);
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(upsertImportCandidateFn.mock.callCount(), 1);
  assert.equal(replaceImportCandidateFilesFn.mock.callCount(), 1);
  assert.deepEqual(upsertImportCandidateFn.mock.calls[0].arguments[0].normalizedPayload.requestOwnership, {
    sourceRequestedByUserId: 'admin-9',
    sourceRequestedForUserId: 'user-12',
    sourceType: 'media_request',
  });
  assert.equal(replaceImportCandidateFilesFn.mock.calls[0].arguments[0], 'candidate-1');
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0], {
    actorUserId: 'user-1',
    actorType: 'user',
    eventType: 'import_candidates_slskd_ingested',
    summary: 'slskd search responses ingested as import candidates',
    entityType: 'slskd_search',
    entityId: null,
    details: {
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
      candidateCount: 1,
      fileCount: 1,
    },
    ipAddress: '203.0.113.10',
    userAgent: 'HarmoniarrTest/1.0',
  });
  assert.deepEqual({
    sourceProvider: result.sourceProvider,
    sourceSearchId: result.sourceSearchId,
    candidateCount: result.candidateCount,
    fileCount: result.fileCount,
  }, {
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    candidateCount: 1,
    fileCount: 1,
  });
  assert.equal(result.candidates[0].id, 'candidate-1');
  assert.equal(result.candidates[0].files[0].filename, '01 Wildlife Analysis.flac');
});

test('createImportCandidateService includes stored uploader reputation in candidate scoring', async (t) => {
  const { pool } = createPool(t);
  const scoreDownloadResultFn = t.mock.fn(() => ({ breakdown: [], compositeScore: 88 }));
  const service = createImportCandidateService({
    listSourceUserReputationIndexFn: t.mock.fn(async () => new Map([[
      'source-user',
      { failureCount: 1, successCount: 9, trustState: 'trusted', username: 'source-user' },
    ]])),
    pool,
    recordAuditEventFn: t.mock.fn(),
    replaceImportCandidateFilesFn: t.mock.fn(async (importCandidateId, files) => files.map((file) => ({
      id: `file-${file.sourceFileIndex}`,
      importCandidateId,
      ...file,
    }))),
    scoreDownloadResultFn,
    slskdService: {
      getSearchResponses: async () => ({
        searchId: 'search-1',
        responses: [{
          username: 'source-user',
          files: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 123 }],
        }],
      }),
    },
    upsertImportCandidateFn: t.mock.fn(async (candidate) => ({ id: 'candidate-1', ...candidate })),
  });

  await service.ingestSlskdSearchResponses({ searchId: 'search-1' });

  assert.equal(scoreDownloadResultFn.mock.callCount(), 1);
  assert.deepEqual(scoreDownloadResultFn.mock.calls[0].arguments[0].uploaderReputation, {
    failureCount: 1,
    successCount: 9,
    trustState: 'trusted',
    username: 'source-user',
  });
});

test('createImportCandidateService lists candidates with normalized filters and pagination', async (t) => {
  const listImportCandidatesFn = t.mock.fn(async (filters) => ({
    items: [{
      id: 'candidate-1',
      username: 'source-user',
      status: 'pending',
    }],
    total: 1,
    filters,
  }));
  const service = createImportCandidateService({
    listImportCandidatesFn,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
  });

  const result = await service.listImportCandidates({
    folderPath: '  Autechre   Amber ',
    limit: '10',
    offset: '5',
    requestedForUserId: ' user-9 ',
    sourceSearchId: ' search-1 ',
    status: 'pending',
    username: ' source-user ',
  });

  assert.deepEqual(listImportCandidatesFn.mock.calls[0].arguments, [{
    folderPath: 'Autechre Amber',
    limit: 10,
    offset: 5,
    requestedForUserId: 'user-9',
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source-user',
  }]);
  assert.deepEqual(result, {
    candidates: [{
      id: 'candidate-1',
      username: 'source-user',
      status: 'pending',
    }],
    filters: {
      folderPath: 'Autechre Amber',
      requestedForUserId: 'user-9',
      sourceSearchId: 'search-1',
      status: 'pending',
      username: 'source-user',
    },
    pagination: {
      limit: 10,
      offset: 5,
      total: 1,
    },
  });
});

test('createImportCandidateService rejects invalid candidate list filters', async (t) => {
  const listImportCandidatesFn = t.mock.fn();
  const service = createImportCandidateService({
    listImportCandidatesFn,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
  });

  await assert.rejects(
    () => service.listImportCandidates({ status: 'unknown' }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'status is invalid');
      return true;
    },
  );
  await assert.rejects(
    () => service.listImportCandidates({ limit: '1001' }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'limit must be an integer between 1 and 1000');
      return true;
    },
  );
  assert.equal(listImportCandidatesFn.mock.callCount(), 0);
});

test('createImportCandidateService returns candidate detail with files', async (t) => {
  const getImportCandidateByIdFn = t.mock.fn(async () => ({
    id: 'candidate-1',
    username: 'source-user',
    status: 'pending',
  }));
  const listImportCandidateFilesFn = t.mock.fn(async () => [{
    id: 'file-1',
    filename: '01 Foil.flac',
  }]);
  const service = createImportCandidateService({
    getImportCandidateByIdFn,
    listImportCandidateFilesFn,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
  });

  assert.deepEqual(await service.getImportCandidate({ importCandidateId: ' candidate-1 ' }), {
    id: 'candidate-1',
    username: 'source-user',
    status: 'pending',
    files: [{
      id: 'file-1',
      filename: '01 Foil.flac',
    }],
  });
  assert.deepEqual(getImportCandidateByIdFn.mock.calls[0].arguments, ['candidate-1']);
  assert.deepEqual(listImportCandidateFilesFn.mock.calls[0].arguments, ['candidate-1']);
});

test('createImportCandidateService returns normalized not found errors for missing candidate detail', async () => {
  const service = createImportCandidateService({
    getImportCandidateByIdFn: async () => null,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
  });

  await assert.rejects(
    () => service.getImportCandidate({ importCandidateId: 'missing-candidate' }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'import_candidate_not_found');
      assert.equal(error.message, 'Import candidate not found');
      return true;
    },
  );
});

test('createImportCandidateService holds candidates with guarded status transitions and audit', async (t) => {
  const { client, pool } = createPool(t);
  const heldCandidate = createStoredCandidate({ status: 'held' });
  const getImportCandidateByIdFn = t.mock.fn(async () => createStoredCandidate({ status: 'pending' }));
  const transitionImportCandidateStatusFn = t.mock.fn(async () => heldCandidate);
  const insertImportCandidateEventFn = t.mock.fn(async () => ({
    id: 'event-1',
    importCandidateId: 'candidate-1',
    eventType: 'import_candidate_held',
    previousStatus: 'pending',
    newStatus: 'held',
    reason: 'Needs manual review',
  }));
  const recordAuditEventFn = t.mock.fn();
  const service = createImportCandidateService({
    getImportCandidateByIdFn,
    insertImportCandidateEventFn,
    pool,
    recordAuditEventFn,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn,
  });

  const result = await service.holdImportCandidate({
    actorUserId: 'user-1',
    importCandidateId: ' candidate-1 ',
    reason: '  Needs   manual review ',
    requestMetadata: {
      ipAddress: '198.51.100.9',
      userAgent: 'HarmoniarrReviewTest/1.0',
    },
  });

  assert.deepEqual(client.query.mock.calls.map((call) => call.arguments[0]), ['BEGIN', 'COMMIT']);
  assert.deepEqual(getImportCandidateByIdFn.mock.calls[0].arguments, ['candidate-1', client]);
  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[0].arguments, [{
    fromStatuses: ['pending'],
    importCandidateId: 'candidate-1',
    toStatus: 'held',
  }, client]);
  assert.deepEqual(insertImportCandidateEventFn.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    details: {
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
    },
    eventType: 'import_candidate_held',
    importCandidateId: 'candidate-1',
    newStatus: 'held',
    previousStatus: 'pending',
    reason: 'Needs manual review',
  }, client]);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0], {
    actorUserId: 'user-1',
    actorType: 'user',
    eventType: 'import_candidate_held',
    summary: 'Import candidate held for review',
    entityType: 'import_candidate',
    entityId: 'candidate-1',
    details: {
      importCandidateId: 'candidate-1',
      newStatus: 'held',
      previousStatus: 'pending',
      reason: 'Needs manual review',
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
    },
    ipAddress: '198.51.100.9',
    userAgent: 'HarmoniarrReviewTest/1.0',
  });
  assert.equal(result.candidate, heldCandidate);
  assert.equal(result.event.eventType, 'import_candidate_held');
});

test('createImportCandidateService selects candidates with the expected status guards', async (t) => {
  const { client, pool } = createPool(t);
  const getImportCandidateByIdFn = t.mock.fn(async () => createStoredCandidate({ status: 'held' }));
  const transitionImportCandidateStatusFn = t.mock.fn(async ({ toStatus }) => createStoredCandidate({ status: toStatus }));
  const insertImportCandidateEventFn = t.mock.fn(async ({ eventType, previousStatus, newStatus, reason }) => ({
    eventType,
    previousStatus,
    newStatus,
    reason,
  }));
  const recordAuditEventFn = t.mock.fn();
  const service = createImportCandidateService({
    getImportCandidateByIdFn,
    insertImportCandidateEventFn,
    pool,
    recordAuditEventFn,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn,
  });

  await service.selectImportCandidate({
    actorUserId: 'user-11',
    importCandidateId: 'candidate-1',
    reason: 'Queue for download planning',
    requestMetadata: {
      ipAddress: '198.51.100.12',
      userAgent: 'HarmoniarrSelectReviewTest/1.0',
    },
  });

  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[0].arguments, [{
    fromStatuses: ['pending', 'held'],
    importCandidateId: 'candidate-1',
    toStatus: 'selected',
  }, client]);
  assert.equal(insertImportCandidateEventFn.mock.calls[0].arguments[0].eventType, 'import_candidate_selected');
  assert.deepEqual(recordAuditEventFn.mock.calls[0].arguments[0], {
    actorUserId: 'user-11',
    actorType: 'user',
    eventType: 'import_candidate_selected',
    summary: 'Import candidate selected for download planning',
    entityType: 'import_candidate',
    entityId: 'candidate-1',
    details: {
      importCandidateId: 'candidate-1',
      newStatus: 'selected',
      previousStatus: 'held',
      reason: 'Queue for download planning',
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
    },
    ipAddress: '198.51.100.12',
    userAgent: 'HarmoniarrSelectReviewTest/1.0',
  });
});

test('createImportCandidateService rejects and reopens selected candidates with the expected status guards', async (t) => {
  const { client, pool } = createPool(t);
  const getImportCandidateByIdFn = t.mock.fn(async () => createStoredCandidate({ status: 'selected' }));
  const transitionImportCandidateStatusFn = t.mock.fn(async ({ toStatus }) => createStoredCandidate({ status: toStatus }));
  const insertImportCandidateEventFn = t.mock.fn(async ({ eventType, previousStatus, newStatus, reason }) => ({
    eventType,
    previousStatus,
    newStatus,
    reason,
  }));
  const service = createImportCandidateService({
    getImportCandidateByIdFn,
    insertImportCandidateEventFn,
    pool,
    recordAuditEventFn: t.mock.fn(),
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn,
  });

  await service.rejectImportCandidate({
    importCandidateId: 'candidate-1',
    reason: 'Wrong album',
  });
  await service.reopenImportCandidate({
    importCandidateId: 'candidate-1',
    reason: 'Retry review',
  });

  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[0].arguments, [{
    fromStatuses: ['pending', 'held', 'selected'],
    importCandidateId: 'candidate-1',
    toStatus: 'rejected',
  }, client]);
  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[1].arguments, [{
    fromStatuses: ['held', 'rejected', 'failed', 'selected'],
    importCandidateId: 'candidate-1',
    toStatus: 'pending',
  }, client]);
  assert.equal(insertImportCandidateEventFn.mock.calls[0].arguments[0].eventType, 'import_candidate_rejected');
  assert.equal(insertImportCandidateEventFn.mock.calls[1].arguments[0].eventType, 'import_candidate_reopened');
});

test('createImportCandidateService marks download workflow transitions with shared status guards', async (t) => {
  const { client, pool } = createPool(t);
  const getImportCandidateByIdFn = t.mock.fn(async () => createStoredCandidate({ status: 'selected' }));
  const transitionImportCandidateStatusFn = t.mock.fn(async ({ toStatus }) => createStoredCandidate({ status: toStatus }));
  const insertImportCandidateEventFn = t.mock.fn(async ({ eventType, previousStatus, newStatus, reason }) => ({
    eventType,
    previousStatus,
    newStatus,
    reason,
  }));
  const recordSourceUserOutcomeEvidenceFn = t.mock.fn(async () => null);
  const service = createImportCandidateService({
    getImportCandidateByIdFn,
    insertImportCandidateEventFn,
    pool,
    recordAuditEventFn: t.mock.fn(),
    recordSourceUserOutcomeEvidenceFn,
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn,
  });

  await service.markImportCandidateDownloading({ importCandidateId: 'candidate-1', reason: 'Queued remotely' });
  await service.markImportCandidateImportPending({ importCandidateId: 'candidate-1', reason: 'Completed' });
  await service.markImportCandidateApplied({ importCandidateId: 'candidate-1', reason: 'Imported cleanly' });
  await service.markImportCandidateDownloadFailed({ importCandidateId: 'candidate-1', reason: 'Remote transfer failed' });

  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[0].arguments, [{
    fromStatuses: ['selected'],
    importCandidateId: 'candidate-1',
    toStatus: 'downloading',
  }, client]);
  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[1].arguments, [{
    fromStatuses: ['selected', 'downloading'],
    importCandidateId: 'candidate-1',
    toStatus: 'import_pending',
  }, client]);
  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[2].arguments, [{
    fromStatuses: ['import_pending'],
    importCandidateId: 'candidate-1',
    toStatus: 'applied',
  }, client]);
  assert.deepEqual(transitionImportCandidateStatusFn.mock.calls[3].arguments, [{
    fromStatuses: ['selected', 'downloading'],
    importCandidateId: 'candidate-1',
    toStatus: 'failed',
  }, client]);
  assert.equal(insertImportCandidateEventFn.mock.calls[0].arguments[0].eventType, 'import_candidate_downloading');
  assert.equal(insertImportCandidateEventFn.mock.calls[1].arguments[0].eventType, 'import_candidate_import_pending');
  assert.equal(insertImportCandidateEventFn.mock.calls[2].arguments[0].eventType, 'import_candidate_applied');
  assert.equal(insertImportCandidateEventFn.mock.calls[3].arguments[0].eventType, 'import_candidate_download_failed');
  assert.deepEqual(recordSourceUserOutcomeEvidenceFn.mock.calls.map((call) => call.arguments[0]), [
    {
      actorUserId: null,
      eventType: 'import_candidate_applied',
      occurredAt: '2026-04-30T14:00:00.000Z',
      outcome: 'success',
      reason: 'Imported cleanly',
      username: 'source-user',
    },
    {
      actorUserId: null,
      eventType: 'import_candidate_download_failed',
      occurredAt: '2026-04-30T14:00:00.000Z',
      outcome: 'failure',
      reason: 'Remote transfer failed',
      username: 'source-user',
    },
  ]);
});

test('createImportCandidateService preserves status transitions when trust evidence recording fails', async (t) => {
  const { pool } = createPool(t);
  const service = createImportCandidateService({
    getImportCandidateByIdFn: t.mock.fn(async () => createStoredCandidate({ status: 'selected' })),
    insertImportCandidateEventFn: t.mock.fn(async ({ eventType, previousStatus, newStatus, reason }) => ({
      eventType,
      previousStatus,
      newStatus,
      reason,
    })),
    pool,
    recordAuditEventFn: t.mock.fn(),
    recordSourceUserOutcomeEvidenceFn: t.mock.fn(async () => {
      throw new Error('trust snapshot unavailable');
    }),
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn: t.mock.fn(async ({ toStatus }) => createStoredCandidate({ status: toStatus })),
  });

  const result = await service.markImportCandidateDownloadFailed({
    importCandidateId: 'candidate-1',
    reason: 'Remote transfer failed',
  });

  assert.equal(result.candidate.status, 'failed');
});

test('createImportCandidateService rejects stale review transitions with a conflict', async (t) => {
  const { client, pool } = createPool(t);
  const service = createImportCandidateService({
    getImportCandidateByIdFn: t.mock.fn(async () => createStoredCandidate({ status: 'rejected' })),
    insertImportCandidateEventFn: t.mock.fn(),
    pool,
    recordAuditEventFn: t.mock.fn(),
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn: t.mock.fn(async () => null),
  });

  await assert.rejects(
    () => service.holdImportCandidate({ importCandidateId: 'candidate-1' }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'import_candidate_status_conflict');
      assert.equal(error.message, 'Import candidate cannot transition from rejected to held');
      return true;
    },
  );
  assert.deepEqual(client.query.mock.calls.map((call) => call.arguments[0]), ['BEGIN', 'ROLLBACK']);
});

test('createImportCandidateService returns not found for missing review transition targets', async (t) => {
  const service = createImportCandidateService({
    getImportCandidateByIdFn: t.mock.fn(async () => null),
    pool: createPool(t).pool,
    recordAuditEventFn: t.mock.fn(),
    slskdService: {
      getSearchResponses: async () => ({ searchId: 'unused', responses: [] }),
    },
    transitionImportCandidateStatusFn: t.mock.fn(),
  });

  await assert.rejects(
    () => service.rejectImportCandidate({ importCandidateId: 'missing-candidate' }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'import_candidate_not_found');
      return true;
    },
  );
});

test('createImportCandidateService rolls back candidate ingestion failures', async (t) => {
  const { client, pool } = createPool(t);
  const expectedError = new Error('database failed');
  const service = createImportCandidateService({
    pool,
    recordAuditEventFn: t.mock.fn(),
    replaceImportCandidateFilesFn: t.mock.fn(),
    slskdService: {
      getSearchResponses: async () => ({
        searchId: 'search-1',
        responses: [{
          username: 'source-user',
          files: [{ filename: 'Autechre\\Amber\\01 Foil.flac' }],
        }],
      }),
    },
    upsertImportCandidateFn: async () => {
      throw expectedError;
    },
  });

  await assert.rejects(
    () => service.ingestSlskdSearchResponses({ searchId: 'search-1' }),
    (error) => {
      assert.equal(error, expectedError);
      return true;
    },
  );

  assert.deepEqual(client.query.mock.calls.map((call) => call.arguments[0]), ['BEGIN', 'ROLLBACK']);
  assert.equal(client.release.mock.callCount(), 1);
});

test('createImportCandidateService applies composite scoring during ingestion', async (t) => {
  const { pool } = createPool(t);
  const slskdService = {
    getSearchResponses: t.mock.fn(async () => ({
      searchId: 'search-1',
      responses: [{
        username: 'source-user',
        hasFreeUploadSlot: true,
        queueLength: 0,
        uploadSpeed: 10_000_000,
        files: [{
          filename: 'Artist\\Album\\01 Track.flac',
          size: 1000,
          bitRate: 900,
          bitDepth: 16,
          sampleRate: 44100,
          length: 300,
        }],
      }],
    })),
  };
  const upsertImportCandidateFn = t.mock.fn(async (candidate) => ({
    id: 'candidate-1',
    ...candidate,
  }));
  const replaceImportCandidateFilesFn = t.mock.fn(async (_, files) => files);
  const recordAuditEventFn = t.mock.fn();
  const service = createImportCandidateService({
    pool,
    recordAuditEventFn,
    replaceImportCandidateFilesFn,
    slskdService,
    upsertImportCandidateFn,
  });

  const result = await service.ingestSlskdSearchResponses({
    actorUserId: 'user-1',
    formatPreferences: { preferredFormat: 'flac', minimumQuality: 'any' },
    expectedTrackCount: 1,
    expectedDurationSeconds: 300,
    searchId: 'search-1',
  });

  assert.equal(result.candidateCount, 1);
  const storedCandidate = upsertImportCandidateFn.mock.calls[0].arguments[0];
  assert.ok(typeof storedCandidate.normalizedPayload.compositeScore === 'number');
  assert.ok(storedCandidate.normalizedPayload.compositeScore > 0);
  assert.ok(Array.isArray(storedCandidate.normalizedPayload.scoreBreakdown));
  assert.ok(storedCandidate.normalizedPayload.scoreBreakdown.length > 0);
});

test('createImportCandidateService applies composite scoring without formatPreferences or expected counts', async (t) => {
  const { pool } = createPool(t);
  const slskdService = {
    getSearchResponses: t.mock.fn(async () => ({
      searchId: 'search-1',
      responses: [{
        username: 'source-user',
        files: [{
          filename: 'Artist\\Album\\01 Track.mp3',
          size: 500,
        }],
      }],
    })),
  };
  const upsertImportCandidateFn = t.mock.fn(async (candidate) => ({
    id: 'candidate-1',
    ...candidate,
  }));
  const replaceImportCandidateFilesFn = t.mock.fn(async (_, files) => files);
  const recordAuditEventFn = t.mock.fn();
  const service = createImportCandidateService({
    pool,
    recordAuditEventFn,
    replaceImportCandidateFilesFn,
    slskdService,
    upsertImportCandidateFn,
  });

  await service.ingestSlskdSearchResponses({ searchId: 'search-1' });

  const storedCandidate = upsertImportCandidateFn.mock.calls[0].arguments[0];
  assert.ok(typeof storedCandidate.normalizedPayload.compositeScore === 'number');
});

test('createImportCandidateService uses injectable scoreDownloadResultFn', async (t) => {
  const { pool } = createPool(t);
  const mockScoreFn = t.mock.fn(({ candidate }) => ({
    compositeScore: 42,
    breakdown: [{ name: 'mock', score: 42, weight: 1 }],
  }));
  const slskdService = {
    getSearchResponses: t.mock.fn(async () => ({
      searchId: 'search-1',
      responses: [{
        username: 'source-user',
        files: [{ filename: 'Artist\\Album\\01 Track.flac', size: 100 }],
      }],
    })),
  };
  const upsertImportCandidateFn = t.mock.fn(async (candidate) => ({
    id: 'candidate-1',
    ...candidate,
  }));
  const replaceImportCandidateFilesFn = t.mock.fn(async (_, files) => files);
  const recordAuditEventFn = t.mock.fn();
  const service = createImportCandidateService({
    pool,
    recordAuditEventFn,
    replaceImportCandidateFilesFn,
    scoreDownloadResultFn: mockScoreFn,
    slskdService,
    upsertImportCandidateFn,
  });

  await service.ingestSlskdSearchResponses({ searchId: 'search-1' });

  assert.equal(mockScoreFn.mock.callCount(), 1);
  const storedCandidate = upsertImportCandidateFn.mock.calls[0].arguments[0];
  assert.equal(storedCandidate.normalizedPayload.compositeScore, 42);
});
