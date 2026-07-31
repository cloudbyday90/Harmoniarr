import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerImportCandidateRoutes } from '../../src/server/routes/import-candidate-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createImportCandidateRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerImportCandidateRoutes(app, {
      buildImportCandidateApplySummary: async () => ({
        activeRun: null,
        checkedAt: '2026-04-30T21:00:00.000Z',
        currentRun: null,
        latestRun: null,
        summary: {
          status: 'not_started',
          message: 'No import apply run has been recorded yet.',
        },
      }),
      buildImportCandidateExecutionSummary: async () => ({
        activeRun: null,
        checkedAt: '2026-04-30T20:30:00.000Z',
        currentRun: null,
        latestRun: null,
        summary: {
          status: 'not_started',
          message: 'No import execution planning run has been recorded yet.',
        },
      }),
      buildImportCandidateMediaInspectionRunDetail: async ({ runId }) => ({
        checkedAt: '2026-04-30T20:40:00.000Z',
        run: {
          blockedCandidateCount: 0,
          currentStep: 'Inspection complete',
          errorMessage: null,
          finishedAt: '2026-04-30T20:39:00.000Z',
          id: runId,
          inspectedCandidateCount: 1,
          inspectedFileCount: 3,
          inspectionUnavailableCount: 0,
          requestedCandidateCount: 1,
          startedAt: '2026-04-30T20:38:00.000Z',
          status: 'completed',
          warningCount: 0,
        },
      }),
      buildImportCandidateMediaInspectionSummary: async () => ({
        activeRun: null,
        checkedAt: '2026-04-30T20:40:00.000Z',
        currentRun: null,
        latestRun: null,
        recentRuns: [],
        summary: {
          status: 'not_started',
          message: 'No import media inspection run has been recorded yet.',
        },
      }),
      buildImportPendingCandidateSummary: async () => ({
        checkedAt: '2026-04-30T20:45:00.000Z',
        counts: {
          blocked: 0,
          ready: 1,
          readyWithWarnings: 0,
          totalImportPending: 1,
        },
        importPendingCandidates: [{
          id: 'candidate-1',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          importPendingAt: '2026-04-30T20:40:00.000Z',
          importStatus: {
            code: 'ready',
            message: 'Completed download paths are resolved and ready for import review.',
          },
          planning: {
            blockerCount: 0,
            canPreview: true,
            libraryFolderPath: '/data/music/Autechre/Amber',
            primaryBlocker: null,
            primaryWarning: null,
            resolutionStrategy: 'downloads_root_relative',
            sourceFolderPath: '/data/downloads/Autechre/Amber',
            stagingFolderPath: '/data/staging/import-candidates/candidate-1/Autechre/Amber',
            warningCount: 0,
          },
          sourceProvider: 'slskd',
          sourceSearchId: 'search-1',
          fileCount: 1,
          lockedFileCount: 0,
          totalSizeBytes: 1024,
        }],
        pagination: {
          limit: 25,
          offset: 0,
          total: 1,
        },
        summary: {
          status: 'ready',
          message: '1 completed download candidate is ready for import review.',
        },
      }),
      buildSelectedImportCandidateSummary: async () => ({
        checkedAt: '2026-04-30T20:00:00.000Z',
        counts: {
          blocked: 0,
          ready: 1,
          readyWithWarnings: 0,
          totalSelected: 1,
        },
        pagination: {
          limit: 25,
          offset: 0,
          total: 1,
        },
        selectedCandidates: [{
          id: 'candidate-1',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          executionStatus: {
            code: 'ready',
            message: 'Planning data is resolved and ready for the next execution slice.',
          },
          planning: {
            blockerCount: 0,
            canPreview: true,
            libraryFolderPath: '/data/music/Autechre/Amber',
            primaryBlocker: null,
            primaryWarning: null,
            resolutionStrategy: 'downloads_root_relative',
            sourceFolderPath: '/data/downloads/Autechre/Amber',
            stagingFolderPath: '/data/staging/import-candidates/candidate-1/Autechre/Amber',
            warningCount: 0,
          },
          selectedAt: '2026-04-30T20:00:00.000Z',
          sourceProvider: 'slskd',
          sourceSearchId: 'search-1',
          fileCount: 1,
          lockedFileCount: 0,
          totalSizeBytes: 1024,
        }],
        summary: {
          status: 'ready',
          message: '1 selected candidate is ready for the next execution slice.',
        },
      }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      getImportCandidate: async ({ importCandidateId }) => ({
        id: importCandidateId,
        username: 'source-user',
        folderPath: 'Autechre\\Amber',
        status: 'pending',
        files: [{
          id: 'file-1',
          filename: '01 Foil.flac',
        }],
      }),
      holdImportCandidate: async ({ importCandidateId, actorUserId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'held',
        },
        event: {
          eventType: 'import_candidate_held',
          previousStatus: 'pending',
          newStatus: 'held',
          reason,
        },
        source: {
          actorUserId,
          requestMetadata,
        },
      }),
      ingestSlskdSearchResponses: async ({ searchId, actorUserId, requestMetadata }) => ({
        sourceProvider: 'slskd',
        sourceSearchId: searchId,
        candidateCount: 1,
        fileCount: 1,
        source: {
          actorUserId,
          requestMetadata,
        },
        candidates: [{
          id: 'candidate-1',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          status: 'pending',
          fileCount: 1,
          files: [{
            id: 'file-1',
            filename: '01 Foil.flac',
          }],
        }],
      }),
      listImportCandidates: async ({ folderPath, limit, offset, sourceSearchId, status, username }) => ({
        candidates: [{
          id: 'candidate-1',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          status: 'pending',
        }],
        filters: {
          folderPath,
          sourceSearchId,
          status,
          username,
        },
        pagination: {
          limit,
          offset,
          total: 1,
        },
      }),
      clearImportCandidateFileDecision: async ({ actorUserId, importCandidateFileId, importCandidateId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'import_pending',
        },
        clearedDecision: {
          decisionType: 'skip',
          importCandidateFileId,
        },
        file: {
          id: importCandidateFileId,
        },
        source: {
          actorUserId,
          requestMetadata,
          reason,
        },
      }),
      setImportCandidateFileAllowLossyDerivativeDecision: async ({ actorUserId, importCandidateFileId, importCandidateId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'import_pending',
        },
        decision: {
          decisionType: 'allow_lossy_derivative',
          importCandidateFileId,
        },
        file: {
          id: importCandidateFileId,
        },
        source: {
          actorUserId,
          requestMetadata,
          reason,
        },
      }),
      previewImportCandidate: async ({ importCandidateId }) => ({
        candidate: {
          id: importCandidateId,
          status: 'selected',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          fileCount: 1,
        },
        source: {
          downloadsRoot: '/data/downloads',
          rawFolderPath: 'Autechre\\Amber',
          relativeFolderPath: 'Autechre/Amber',
          resolutionStrategy: 'downloads_root_relative',
          resolvedFolderPath: '/data/downloads/Autechre/Amber',
        },
        staging: {
          root: '/data/staging',
          previewFolderPath: '/data/staging/import-candidates/candidate-1/Autechre/Amber',
        },
        library: {
          root: '/data/music',
          rootFolderPolicy: 'single_root',
          previewFolderPath: '/data/music/Autechre/Amber',
        },
        naming: {
          strategy: 'mirror_candidate_path',
          filePreviews: [{
            fileId: 'file-1',
            filename: '01 Foil.flac',
            sourcePath: '/data/downloads/Autechre/Amber/01 Foil.flac',
            stagingPath: '/data/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
            libraryPath: '/data/music/Autechre/Amber/01 Foil.flac',
          }],
        },
        validation: {
          canPreview: true,
          blockers: [],
          warnings: [{
            code: 'path_mapping_assumption',
            message: 'Preview currently assumes Harmoniarr reads candidate paths from the configured downloads root until explicit slskd path mappings are added.',
          }],
        },
      }),
      previewImportCandidateApply: async ({ importCandidateId }) => ({
        counts: {
          collisionCount: 1,
          missingSourceCount: 0,
          readyCount: 0,
          stagingPresentCount: 1,
          totalFiles: 1,
        },
        files: [{
          fileId: 'file-1',
          filename: '01 Foil.flac',
          libraryTarget: {
            exists: true,
            path: '/data/music/Autechre/Amber/01 Foil.flac',
            type: 'file',
          },
          sourceFile: {
            exists: true,
            path: '/data/downloads/Autechre/Amber/01 Foil.flac',
            type: 'file',
          },
          stagingTarget: {
            exists: true,
            path: '/data/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
            type: 'file',
          },
          status: {
            code: 'collision',
            message: 'The target library path already exists and would require an operator decision before import apply.',
          },
        }],
        preview: {
          candidate: { id: importCandidateId },
        },
        summary: {
          status: 'blocked',
          message: '1 target file already exists in the library and requires collision review before import apply.',
        },
      }),
      reconcileImportCandidateExecutionState: async ({ actorUserId, requestMetadata }) => ({
        currentRunId: 'run-1',
        summary: {
          transitioned: 1,
        },
        source: {
          actorUserId,
          requestMetadata,
        },
        transitions: [{
          fromStatus: 'downloading',
          importCandidateId: 'candidate-1',
          liveTransferStatus: 'completed',
          toStatus: 'import_pending',
        }],
      }),
      setImportCandidateFileSkipDecision: async ({ actorUserId, importCandidateFileId, importCandidateId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'import_pending',
        },
        decision: {
          decisionType: 'skip',
          importCandidateFileId,
        },
        file: {
          id: importCandidateFileId,
        },
        source: {
          actorUserId,
          requestMetadata,
          reason,
        },
      }),
      selectImportCandidate: async ({ importCandidateId, actorUserId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'selected',
        },
        event: {
          eventType: 'import_candidate_selected',
          previousStatus: 'pending',
          newStatus: 'selected',
          reason,
        },
        source: {
          actorUserId,
          requestMetadata,
        },
      }),
      rejectImportCandidate: async ({ importCandidateId, actorUserId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'rejected',
        },
        event: {
          eventType: 'import_candidate_rejected',
          previousStatus: 'held',
          newStatus: 'rejected',
          reason,
        },
        source: {
          actorUserId,
          requestMetadata,
        },
      }),
      buildImportCandidateApplyRunDetail: async ({ runId }) => ({
        checkedAt: '2026-04-30T21:10:00.000Z',
        run: {
          completedFileCount: 1,
          errorMessage: null,
          failedFileCount: 0,
          finishedAt: '2026-04-30T21:09:00.000Z',
          id: runId,
          skippedFileCount: 0,
          startedAt: '2026-04-30T21:08:00.000Z',
          status: 'completed',
          totalFileCount: 1,
        },
      }),
      buildImportCandidateExecutionRunDetail: async ({ runId }) => ({
        checkedAt: '2026-04-30T20:35:00.000Z',
        run: {
          errorMessage: null,
          finishedAt: '2026-04-30T20:34:00.000Z',
          id: runId,
          plannedCandidateCount: 1,
          skippedCandidateCount: 0,
          startedAt: '2026-04-30T20:33:00.000Z',
          status: 'completed',
          transferredCandidateCount: 1,
        },
      }),
      bulkReviewImportCandidates: async ({ action, actorUserId, importCandidateIds, reason, requestMetadata }) => ({
        results: importCandidateIds.map((id) => ({
          importCandidateId: id,
          ok: true,
          previousStatus: 'pending',
          newStatus: action === 'select' ? 'selected' : action,
        })),
        summary: {
          action,
          failed: 0,
          succeeded: importCandidateIds.length,
          total: importCandidateIds.length,
        },
      }),
      limitImportCandidateApplyRun: (_request, _response, next) => next(),
      limitImportCandidateDecision: (_request, _response, next) => next(),
      limitImportCandidateMediaInspectionRun: (_request, _response, next) => next(),
      limitImportCandidateTranscodeRun: (_request, _response, next) => next(),
      limitImportCandidateExecutionReconcile: (_request, _response, next) => next(),
      limitImportCandidateExecutionRun: (_request, _response, next) => next(),
      limitImportCandidateSlskdIngest: (_request, _response, next) => next(),
      requireAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      requireSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token', user: { role: 'admin' } }),
      reopenImportCandidate: async ({ importCandidateId, actorUserId, reason, requestMetadata }) => ({
        candidate: {
          id: importCandidateId,
          status: 'pending',
        },
        event: {
          eventType: 'import_candidate_reopened',
          previousStatus: 'rejected',
          newStatus: 'pending',
          reason,
        },
        source: {
          actorUserId,
          requestMetadata,
        },
      }),
      startImportCandidateApplyRun: async ({ triggeredByUserId, requestMetadata }) => ({
        accepted: true,
        run: {
          id: 'apply-run-1',
          status: 'pending',
        },
        source: {
          triggeredByUserId,
          requestMetadata,
        },
      }),
      startImportCandidateMediaInspectionRun: async ({ triggeredByUserId, requestMetadata }) => ({
        accepted: true,
        run: {
          id: 'inspection-run-1',
          status: 'pending',
        },
        source: {
          triggeredByUserId,
          requestMetadata,
        },
      }),
      startImportCandidateTranscodeRun: async ({ triggeredByUserId, requestMetadata }) => ({
        accepted: true,
        run: {
          id: 'transcode-run-1',
          status: 'pending',
        },
        source: {
          triggeredByUserId,
          requestMetadata,
        },
      }),
      startImportCandidateExecutionRun: async ({ triggeredByUserId, requestMetadata }) => ({
        accepted: true,
        run: {
          id: 'run-1',
          status: 'pending',
        },
        source: {
          triggeredByUserId,
          requestMetadata,
        },
      }),
      ...overrides,
    });
  });
}

test('import candidate list route returns filtered review queue results', async (t) => {
  const listImportCandidates = t.mock.fn(async ({ folderPath, limit, offset, requestedForUserId, sourceSearchId, status, username }) => ({
    candidates: [{
      id: 'candidate-1',
      username: 'source-user',
      folderPath: 'Autechre\\Amber',
      status: 'pending',
    }],
    filters: {
      folderPath,
      requestedForUserId,
      sourceSearchId,
      status,
      username,
    },
    pagination: {
      limit,
      offset,
      total: 1,
    },
  }));
  const requireSession = t.mock.fn(async () => ({ appUserId: 'user-8', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    listImportCandidates,
    requireSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates?status=pending&sourceSearchId=search-1&username=source&folderPath=Amber&limit=10&offset=5`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.deepEqual(listImportCandidates.mock.calls[0].arguments, [{
      folderPath: 'Amber',
      limit: 10,
      offset: 5,
      requestedForUserId: null,
      sourceSearchId: 'search-1',
      status: 'pending',
      username: 'source',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      importCandidates: {
        candidates: [{
          id: 'candidate-1',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          status: 'pending',
        }],
        filters: {
          folderPath: 'Amber',
          requestedForUserId: null,
          sourceSearchId: 'search-1',
          status: 'pending',
          username: 'source',
        },
        pagination: {
          limit: 10,
          offset: 5,
          total: 1,
        },
        reputationSummary: {},
      },
    });
  });
});

test('import candidate list route scopes non-admin reads to delegated target ownership', async (t) => {
  const listImportCandidates = t.mock.fn(async () => ({
    candidates: [{
      id: 'candidate-owned',
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
      sourceResponseKey: 'source-response-1',
      username: 'source-user',
      folderPath: 'Autechre\\Amber',
      candidateType: 'media_request',
      status: 'selected',
      fileCount: 2,
      lockedFileCount: 0,
      totalSizeBytes: 2048,
      rawPayload: { username: 'source-user' },
      normalizedPayload: {
        extensions: ['FLAC', 'flac', 'mp3'],
        requestOwnership: {
          sourceRequestedByUserId: 'admin-1',
          sourceRequestedForUserId: 'user-target',
        },
      },
      selectionReason: 'best_scored_candidate',
      discoveredAt: '2026-05-04T13:00:00.000Z',
      createdAt: '2026-05-04T13:01:00.000Z',
      updatedAt: '2026-05-04T13:02:00.000Z',
    }],
    filters: {
      folderPath: undefined,
      requestedForUserId: 'user-target',
      sourceSearchId: undefined,
      status: 'selected',
      username: undefined,
    },
    pagination: {
      limit: 25,
      offset: 0,
      total: 1,
    },
  }));
  const enrichCandidatesWithUploaderReputation = t.mock.fn(async (candidates) => candidates.map((candidate) => ({
    ...candidate,
    uploaderReputation: { username: candidate.username },
  })));
  const app = createImportCandidateRouteTestApp({
    enrichCandidatesWithUploaderReputation,
    listImportCandidates,
    requireSession: async () => ({ appUserId: 'user-target', csrfToken: 'csrf-token', user: { role: 'user' } }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates?status=selected`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(listImportCandidates.mock.calls[0].arguments, [{
      folderPath: undefined,
      limit: 25,
      offset: 0,
      requestedForUserId: 'user-target',
      sourceSearchId: undefined,
      status: 'selected',
      username: undefined,
    }]);
    assert.equal(enrichCandidatesWithUploaderReputation.mock.callCount(), 0);
    assert.deepEqual(payload, {
      ok: true,
      importCandidates: {
        candidates: [{
          sourceKey: 'source-1',
          sourceLabel: 'Source 1',
          sourceProvider: 'slskd',
          status: 'selected',
          fileCount: 2,
          totalSizeBytes: 2048,
          formats: ['flac', 'mp3'],
          discoveredAt: '2026-05-04T13:00:00.000Z',
          updatedAt: '2026-05-04T13:02:00.000Z',
        }],
        filters: {
          status: 'selected',
        },
        pagination: {
          limit: 25,
          offset: 0,
          total: 1,
        },
        reputationSummary: {},
      },
    });
    const responseJson = JSON.stringify(payload);
    assert.equal(responseJson.includes('candidate-owned'), false);
    assert.equal(responseJson.includes('source-user'), false);
    assert.equal(responseJson.includes('Autechre'), false);
    assert.equal(responseJson.includes('sourceRequestedForUserId'), false);
  });
});

test('import candidate detail route returns candidate files', async (t) => {
  const getImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
    username: 'source-user',
    folderPath: 'Autechre\\Amber',
    status: 'pending',
    files: [{
      id: 'file-1',
      filename: '01 Foil.flac',
    }],
  }));
  const app = createImportCandidateRouteTestApp({ getImportCandidate });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getImportCandidate.mock.calls[0].arguments, [{
      importCandidateId: 'candidate-1',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      importCandidate: {
        id: 'candidate-1',
        username: 'source-user',
        folderPath: 'Autechre\\Amber',
        status: 'pending',
        files: [{
          id: 'file-1',
          filename: '01 Foil.flac',
        }],
      },
    });
  });
});

test('import candidate detail route returns requester-safe detail for owned non-admin candidates', async (t) => {
  const getImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
    sourceProvider: 'slskd',
    sourceSearchId: 'search-1',
    sourceResponseKey: 'source-response-1',
    username: 'source-user',
    folderPath: 'Autechre\\Amber',
    candidateType: 'media_request',
    status: 'downloading',
    fileCount: 1,
    lockedFileCount: 0,
    totalSizeBytes: 1024,
    rawPayload: { username: 'source-user' },
    normalizedPayload: {
      extensions: ['flac'],
      requestOwnership: {
        sourceMediaRequestId: 'media-request-1',
        sourceRequestKind: 'release',
        sourceRequestedByUserId: 'admin-1',
        sourceRequestedForUserId: 'user-target',
        sourceType: 'media_request',
      },
    },
    selectionReason: 'best_scored_candidate',
    discoveredAt: '2026-05-04T13:00:00.000Z',
    createdAt: '2026-05-04T13:01:00.000Z',
    updatedAt: '2026-05-04T13:02:00.000Z',
    files: [{
      id: 'file-1',
      filename: '01 Foil.flac',
      folderPath: 'Autechre\\Amber',
      rawPayload: { filename: '01 Foil.flac' },
    }],
  }));
  const enrichCandidatesWithUploaderReputation = t.mock.fn(async (candidates) => candidates.map((candidate) => ({
    ...candidate,
    uploaderReputation: { username: candidate.username },
  })));
  const app = createImportCandidateRouteTestApp({
    enrichCandidatesWithUploaderReputation,
    getImportCandidate,
    requireSession: async () => ({ appUserId: 'user-target', csrfToken: 'csrf-token', user: { role: 'user' } }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(enrichCandidatesWithUploaderReputation.mock.callCount(), 0);
    assert.deepEqual(payload, {
      ok: true,
      importCandidate: {
        sourceKey: 'source',
        sourceLabel: 'Source',
        sourceProvider: 'slskd',
        status: 'downloading',
        fileCount: 1,
        totalSizeBytes: 1024,
        formats: ['flac'],
        discoveredAt: '2026-05-04T13:00:00.000Z',
        updatedAt: '2026-05-04T13:02:00.000Z',
      },
    });
    const responseJson = JSON.stringify(payload);
    assert.equal(responseJson.includes('candidate-1'), false);
    assert.equal(responseJson.includes('source-user'), false);
    assert.equal(responseJson.includes('Autechre'), false);
    assert.equal(responseJson.includes('01 Foil.flac'), false);
    assert.equal(responseJson.includes('sourceRequestedForUserId'), false);
  });
});

test('import candidate detail route fails closed when the session user does not own the delegated target', async (t) => {
  const getImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
    normalizedPayload: {
      requestOwnership: {
        sourceRequestedByUserId: 'admin-1',
        sourceRequestedForUserId: 'user-target',
      },
    },
  }));
  const app = createImportCandidateRouteTestApp({
    getImportCandidate,
    requireSession: async () => ({ appUserId: 'other-user', csrfToken: 'csrf-token', user: { role: 'user' } }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error.code, 'import_candidate_not_found');
  });
});

test('import candidate selected summary route returns operator-facing execution readiness', async (t) => {
  const buildSelectedImportCandidateSummary = t.mock.fn(async ({ limit }) => ({
    checkedAt: '2026-04-30T20:00:00.000Z',
    counts: {
      blocked: 1,
      ready: 0,
      readyWithWarnings: 0,
      totalSelected: 1,
    },
    pagination: {
      limit: Number.parseInt(limit, 10),
      offset: 0,
      total: 1,
    },
    selectedCandidates: [{
      id: 'candidate-1',
      executionStatus: {
        code: 'blocked',
        message: 'Explicit path mapping is still required.',
      },
      planning: {
        blockerCount: 1,
        warningCount: 0,
      },
    }],
    summary: {
      status: 'blocked',
      message: '1 selected candidate is blocked and needs operator attention before execution behavior lands.',
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildSelectedImportCandidateSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/selected-summary?limit=10`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildSelectedImportCandidateSummary.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      actorUserRole: 'admin',
      limit: 10,
      targetUser: { id: 'user-1' },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.selectedImportCandidates.counts.blocked, 1);
    assert.equal(payload.selectedImportCandidates.selectedCandidates[0].executionStatus.code, 'blocked');
  });
});

test('import candidate import-pending summary route returns completed-download import readiness', async (t) => {
  const buildImportPendingCandidateSummary = t.mock.fn(async ({ limit }) => ({
    checkedAt: '2026-04-30T20:45:00.000Z',
    counts: {
      blocked: 0,
      ready: 1,
      readyWithWarnings: 0,
      totalImportPending: 1,
    },
    importPendingCandidates: [{
      id: 'candidate-1',
      importStatus: {
        code: 'ready',
        message: 'Completed download paths are resolved and ready for import review.',
      },
    }],
    pagination: {
      limit: Number.parseInt(limit, 10),
      offset: 0,
      total: 1,
    },
    summary: {
      status: 'ready',
      message: '1 completed download candidate is ready for import review.',
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportPendingCandidateSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/import-pending-summary?limit=10`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildImportPendingCandidateSummary.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      actorUserRole: 'admin',
      limit: 10,
      targetUser: { id: 'user-1' },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.importPendingCandidates.counts.totalImportPending, 1);
    assert.equal(payload.importPendingCandidates.importPendingCandidates[0].importStatus.code, 'ready');
  });
});

test('release-scoped add diagnostics require an administrator and forward only the owned release context', async (t) => {
  const buildReleaseAddDiagnostics = t.mock.fn(async ({ wantedReleaseId }) => ({
    latestOutcome: {
      diagnosticCandidateId: 'candidate-1',
      presentation: { code: 'media_verification' },
    },
    outcomes: [],
    release: {
      artistName: 'Forest Frank',
      id: wantedReleaseId,
      releaseTitle: 'Child of God',
    },
    summary: { status: 'warning' },
  }));
  const app = createImportCandidateRouteTestApp({ buildReleaseAddDiagnostics });
  const wantedReleaseId = '8f28e363-3187-48c1-bd48-0b1b613f6c9d';

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/release-add-diagnostics?wantedReleaseId=${wantedReleaseId}&limit=100`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildReleaseAddDiagnostics.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      limit: 25,
      wantedReleaseId,
    }]);
    assert.equal(payload.releaseAddDiagnostics.release.releaseTitle, 'Child of God');
    assert.equal(payload.releaseAddDiagnostics.latestOutcome.diagnosticCandidateId, 'candidate-1');
  });
});

test('release-scoped add diagnostics reject non-administrators', async () => {
  const app = createImportCandidateRouteTestApp({
    requireAdminSession: async () => {
      throw createApiError(403, 'admin_required', 'Administrator access is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/release-add-diagnostics?wantedReleaseId=8f28e363-3187-48c1-bd48-0b1b613f6c9d`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'admin_required');
  });
});

test('import candidate execution summary route returns latest durable planning state', async (t) => {
  const buildImportCandidateExecutionSummary = t.mock.fn(async () => ({
    activeRun: null,
    checkedAt: '2026-04-30T20:30:00.000Z',
    currentRun: {
      id: 'run-1',
      status: 'completed',
      items: [{ id: 'item-1', itemStatus: 'ready' }],
    },
    latestRun: {
      id: 'run-1',
      status: 'completed',
    },
    summary: {
      status: 'ready',
      message: '1 planned import candidate is ready for the next execution slice.',
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportCandidateExecutionSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(buildImportCandidateExecutionSummary.mock.callCount(), 1);
    assert.equal(payload.importCandidateExecution.currentRun.id, 'run-1');
    assert.equal(payload.importCandidateExecution.summary.status, 'ready');
  });
});

test('import candidate execution summary route requires administrator access', async () => {
  const app = createImportCandidateRouteTestApp({
    requireAdminSession: async () => {
      throw createApiError(403, 'admin_required', 'Administrator access is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'admin_required');
  });
});

test('import candidate apply summary route returns latest durable apply state', async (t) => {
  const buildImportCandidateApplySummary = t.mock.fn(async () => ({
    activeRun: null,
    checkedAt: '2026-04-30T21:00:00.000Z',
    currentRun: {
      id: 'apply-run-1',
      items: [{ id: 'item-1', itemStatus: 'applied' }],
      status: 'completed',
    },
    latestRun: {
      id: 'apply-run-1',
      status: 'completed',
    },
    summary: {
      message: '1 candidate was applied into the library.',
      status: 'ready',
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportCandidateApplySummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/apply-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(buildImportCandidateApplySummary.mock.callCount(), 1);
    assert.equal(payload.importCandidateApply.currentRun.id, 'apply-run-1');
    assert.equal(payload.importCandidateApply.summary.status, 'ready');
  });
});

test('import candidate media inspection summary route returns latest durable inspection state', async (t) => {
  const buildImportCandidateMediaInspectionSummary = t.mock.fn(async () => ({
    activeRun: null,
    checkedAt: '2026-04-30T20:40:00.000Z',
    currentRun: {
      id: 'inspection-run-1',
      status: 'completed',
      warningCount: 1,
    },
    latestRun: {
      id: 'inspection-run-1',
      status: 'completed',
    },
    recentRuns: [{
      id: 'inspection-run-1',
      status: 'completed',
    }],
    summary: {
      message: '1 media inspection warning was recorded.',
      status: 'attention',
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportCandidateMediaInspectionSummary });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/media-inspection-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(buildImportCandidateMediaInspectionSummary.mock.callCount(), 1);
    assert.equal(payload.importCandidateMediaInspection.currentRun.id, 'inspection-run-1');
    assert.equal(payload.importCandidateMediaInspection.summary.status, 'attention');
  });
});

test('import candidate media inspection run detail route returns a historical run', async (t) => {
  const buildImportCandidateMediaInspectionRunDetail = t.mock.fn(async ({ runId }) => ({
    checkedAt: '2026-04-30T20:40:00.000Z',
    run: {
      blockedCandidateCount: 1,
      currentStep: 'Inspection complete',
      errorMessage: null,
      finishedAt: '2026-04-30T20:39:00.000Z',
      id: runId,
      inspectedCandidateCount: 1,
      inspectionDiagnostics: [{
        candidateId: 'candidate-1',
        code: 'media_inspection_probe_failed',
        fileId: 'file-1',
        filename: 'alpha.flac',
        folderPath: '/private/staging/Boards of Canada/Geogaddi',
        message: 'Probe failed',
        username: 'remote-peer',
      }],
      inspectedFileCount: 3,
      inspectionUnavailableCount: 0,
      requestedCandidateCount: 2,
      startedAt: '2026-04-30T20:38:00.000Z',
      status: 'completed',
      warningCount: 0,
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportCandidateMediaInspectionRunDetail });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/media-inspection-runs/inspection-run-4`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildImportCandidateMediaInspectionRunDetail.mock.calls[0].arguments, [{
      runId: 'inspection-run-4',
    }]);
    assert.equal(payload.importCandidateMediaInspectionRun.run.id, 'inspection-run-4');
    assert.deepEqual(payload.importCandidateMediaInspectionRun.run.inspectionDiagnostics, [{
      candidateId: 'candidate-1',
      code: 'media_inspection_probe_failed',
      fileId: 'file-1',
      filename: 'alpha.flac',
      folderPath: '/private/staging/Boards of Canada/Geogaddi',
      message: 'Probe failed',
      username: 'remote-peer',
    }]);
  });
});

test('import candidate execution start route enforces csrf and returns accepted run state', async (t) => {
  const startImportCandidateExecutionRun = t.mock.fn(async ({ triggeredByUserId, requestMetadata }) => ({
    accepted: true,
    run: {
      id: 'run-1',
      status: 'pending',
    },
    source: {
      triggeredByUserId,
      requestMetadata,
    },
  }));
  const requireCsrf = t.mock.fn();
  const app = createImportCandidateRouteTestApp({ requireCsrf, startImportCandidateExecutionRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.20',
        'user-agent': 'HarmoniarrExecutionTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startImportCandidateExecutionRun.mock.callCount(), 1);
    assert.deepEqual(startImportCandidateExecutionRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '203.0.113.20',
        userAgent: 'HarmoniarrExecutionTest/1.0',
      },
      triggeredByUserId: 'user-1',
    }]);
    assert.equal(payload.accepted, true);
    assert.equal(payload.run.id, 'run-1');
  });
});

test('import candidate apply start route enforces csrf and returns accepted run state', async (t) => {
  const startImportCandidateApplyRun = t.mock.fn(async ({ triggeredByUserId, requestMetadata }) => ({
    accepted: true,
    run: {
      id: 'apply-run-1',
      status: 'pending',
    },
    source: {
      triggeredByUserId,
      requestMetadata,
    },
  }));
  const requireCsrf = t.mock.fn();
  const app = createImportCandidateRouteTestApp({ requireCsrf, startImportCandidateApplyRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/apply-runs`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.30',
        'user-agent': 'HarmoniarrApplyTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startImportCandidateApplyRun.mock.callCount(), 1);
    assert.deepEqual(startImportCandidateApplyRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '203.0.113.30',
        userAgent: 'HarmoniarrApplyTest/1.0',
      },
      triggeredByUserId: 'user-1',
    }]);
    assert.equal(payload.accepted, true);
    assert.equal(payload.run.id, 'apply-run-1');
  });
});

test('import candidate media-inspection start route enforces csrf and returns accepted run state', async (t) => {
  const startImportCandidateMediaInspectionRun = t.mock.fn(async ({ triggeredByUserId, requestMetadata }) => ({
    accepted: true,
    run: {
      id: 'inspection-run-1',
      status: 'pending',
    },
    source: {
      triggeredByUserId,
      requestMetadata,
    },
  }));
  const requireCsrf = t.mock.fn();
  const app = createImportCandidateRouteTestApp({ requireCsrf, startImportCandidateMediaInspectionRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/media-inspection-runs`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.31',
        'user-agent': 'HarmoniarrMediaInspectionTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startImportCandidateMediaInspectionRun.mock.callCount(), 1);
    assert.deepEqual(startImportCandidateMediaInspectionRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '203.0.113.31',
        userAgent: 'HarmoniarrMediaInspectionTest/1.0',
      },
      triggeredByUserId: 'user-1',
    }]);
    assert.equal(payload.accepted, true);
    assert.equal(payload.run.id, 'inspection-run-1');
  });
});

test('import candidate transcode start route enforces csrf and returns accepted run state', async (t) => {
  const startImportCandidateTranscodeRun = t.mock.fn(async ({ triggeredByUserId, requestMetadata }) => ({
    accepted: true,
    run: {
      id: 'transcode-run-1',
      status: 'pending',
    },
    source: {
      triggeredByUserId,
      requestMetadata,
    },
  }));
  const requireCsrf = t.mock.fn();
  const app = createImportCandidateRouteTestApp({ requireCsrf, startImportCandidateTranscodeRun });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/transcode-runs`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.32',
        'user-agent': 'HarmoniarrTranscodeTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(startImportCandidateTranscodeRun.mock.callCount(), 1);
    assert.deepEqual(startImportCandidateTranscodeRun.mock.calls[0].arguments, [{
      requestMetadata: {
        ipAddress: '203.0.113.32',
        userAgent: 'HarmoniarrTranscodeTest/1.0',
      },
      triggeredByUserId: 'user-1',
    }]);
    assert.equal(payload.accepted, true);
    assert.equal(payload.run.id, 'transcode-run-1');
  });
});

test('import candidate execution reconcile route enforces csrf and returns persisted transitions', async (t) => {
  const reconcileImportCandidateExecutionState = t.mock.fn(async ({ actorUserId, requestMetadata }) => ({
    currentRunId: 'run-1',
    summary: {
      transitioned: 1,
    },
    source: {
      actorUserId,
      requestMetadata,
    },
    transitions: [{
      fromStatus: 'downloading',
      importCandidateId: 'candidate-1',
      liveTransferStatus: 'completed',
      toStatus: 'import_pending',
    }],
  }));
  const requireCsrf = t.mock.fn();
  const app = createImportCandidateRouteTestApp({ requireCsrf, reconcileImportCandidateExecutionState });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-reconcile`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.21',
        'user-agent': 'HarmoniarrExecutionTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(reconcileImportCandidateExecutionState.mock.callCount(), 1);
    assert.deepEqual(reconcileImportCandidateExecutionState.mock.calls[0].arguments, [{
      actorUserId: 'user-1',
      requestMetadata: {
        ipAddress: '203.0.113.21',
        userAgent: 'HarmoniarrExecutionTest/1.0',
      },
    }]);
    assert.equal(payload.reconciliation.summary.transitioned, 1);
  });
});

test('import candidate preview route returns read-only planning preview data', async (t) => {
  const previewImportCandidate = t.mock.fn(async ({ importCandidateId, targetUser }) => ({
    candidate: {
      id: importCandidateId,
      status: 'selected',
      username: 'source-user',
      folderPath: 'Autechre\\Amber',
      fileCount: 1,
    },
    source: {
      downloadsRoot: '/data/downloads',
      rawFolderPath: 'Autechre\\Amber',
      relativeFolderPath: 'Autechre/Amber',
      resolutionStrategy: 'downloads_root_relative',
      resolvedFolderPath: '/data/downloads/Autechre/Amber',
    },
    staging: {
      root: '/data/staging',
      previewFolderPath: '/data/staging/import-candidates/candidate-1/Autechre/Amber',
    },
    library: {
      root: '/data/music',
      rootFolderPolicy: 'per_user_subdirectory',
      previewFolderPath: `/data/music/users/${targetUser.id}/Autechre/Amber`,
      targetUser,
    },
    naming: {
      strategy: 'mirror_candidate_path',
      filePreviews: [{
        fileId: 'file-1',
        filename: '01 Foil.flac',
        sourcePath: '/data/downloads/Autechre/Amber/01 Foil.flac',
        stagingPath: '/data/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
        libraryPath: `/data/music/users/${targetUser.id}/Autechre/Amber/01 Foil.flac`,
      }],
    },
    validation: {
      canPreview: true,
      blockers: [],
      warnings: [],
    },
  }));
  const app = createImportCandidateRouteTestApp({ previewImportCandidate });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/preview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(previewImportCandidate.mock.calls[0].arguments, [{
      importCandidateId: 'candidate-1',
      targetUser: { id: 'user-1' },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidatePreview.candidate.id, 'candidate-1');
    assert.equal(payload.importCandidatePreview.source.resolvedFolderPath, '/data/downloads/Autechre/Amber');
    assert.equal(payload.importCandidatePreview.naming.filePreviews[0].libraryPath, '/data/music/users/user-1/Autechre/Amber/01 Foil.flac');
  });
});

test('import candidate preview route requires admin access before candidate lookup', async (t) => {
  const getImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({
    id: importCandidateId,
    normalizedPayload: {
      requestOwnership: {
        sourceRequestedByUserId: 'admin-1',
        sourceRequestedForUserId: 'user-target',
      },
    },
  }));
  const previewImportCandidate = t.mock.fn(async () => ({ ok: true }));
  const app = createImportCandidateRouteTestApp({
    getImportCandidate,
    previewImportCandidate,
    requireAdminSession: async () => {
      throw createApiError(403, 'admin_required', 'Administrator access is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/preview`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'admin_required');
    assert.equal(getImportCandidate.mock.callCount(), 0);
    assert.equal(previewImportCandidate.mock.callCount(), 0);
  });
});

test('import candidate apply preview route returns file-level import apply safety data', async (t) => {
  const previewImportCandidateApply = t.mock.fn(async ({ importCandidateId, targetUser }) => ({
    counts: {
      collisionCount: 1,
      missingSourceCount: 0,
      readyCount: 0,
      stagingPresentCount: 1,
      totalFiles: 1,
    },
    files: [{
      fileId: 'file-1',
      status: {
        code: 'collision',
        message: 'The target library path already exists and would require an operator decision before import apply.',
      },
    }],
    preview: {
      candidate: { id: importCandidateId },
      library: {
        targetUser,
      },
    },
    summary: {
      status: 'blocked',
      message: '1 target file already exists in the library and requires collision review before import apply.',
    },
  }));
  const app = createImportCandidateRouteTestApp({ previewImportCandidateApply });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/apply-preview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(previewImportCandidateApply.mock.calls[0].arguments, [{
      importCandidateId: 'candidate-1',
      targetUser: { id: 'user-1' },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidateApplyPreview.summary.status, 'blocked');
    assert.equal(payload.importCandidateApplyPreview.files[0].status.code, 'collision');
  });
});

test('import candidate apply preview route requires admin access before planning', async (t) => {
  const previewImportCandidateApply = t.mock.fn(async () => ({ ok: true }));
  const app = createImportCandidateRouteTestApp({
    previewImportCandidateApply,
    requireAdminSession: async () => {
      throw createApiError(403, 'admin_required', 'Administrator access is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/apply-preview`);
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error.code, 'admin_required');
    assert.equal(previewImportCandidateApply.mock.callCount(), 0);
  });
});

test('import candidate file skip route enforces csrf and persists the decision', async (t) => {
  const setImportCandidateFileSkipDecision = t.mock.fn(async ({ actorUserId, importCandidateFileId, importCandidateId, reason, requestMetadata }) => ({
    candidate: {
      id: importCandidateId,
      status: 'import_pending',
    },
    decision: {
      decisionType: 'skip',
      importCandidateFileId,
    },
    source: {
      actorUserId,
      requestMetadata,
      reason,
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-11', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    requireCsrf,
    requireFreshAdminSession,
    setImportCandidateFileSkipDecision,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/files/file-1/skip`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.24',
        'user-agent': 'HarmoniarrReviewRouteTest/1.0',
      },
      body: JSON.stringify({ reason: 'Keep the existing library file' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
  assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(setImportCandidateFileSkipDecision.mock.calls[0].arguments, [{
      actorUserId: 'user-11',
      importCandidateFileId: 'file-1',
      importCandidateId: 'candidate-1',
      reason: 'Keep the existing library file',
      requestMetadata: {
        ipAddress: '198.51.100.24',
        userAgent: 'HarmoniarrReviewRouteTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidateFileDecision.decision.decisionType, 'skip');
  });
});

test('import candidate file decision clear route enforces csrf and clears the decision', async (t) => {
  const clearImportCandidateFileDecision = t.mock.fn(async ({ actorUserId, importCandidateFileId, importCandidateId, reason, requestMetadata }) => ({
    candidate: {
      id: importCandidateId,
      status: 'import_pending',
    },
    clearedDecision: {
      decisionType: 'skip',
      importCandidateFileId,
    },
    source: {
      actorUserId,
      requestMetadata,
      reason,
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-12', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    clearImportCandidateFileDecision,
    requireCsrf,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/files/file-1/clear-decision`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.25',
        'user-agent': 'HarmoniarrReviewRouteTest/1.0',
      },
      body: JSON.stringify({ reason: 'Retry the file on the next apply run' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
  assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(clearImportCandidateFileDecision.mock.calls[0].arguments, [{
      actorUserId: 'user-12',
      importCandidateFileId: 'file-1',
      importCandidateId: 'candidate-1',
      reason: 'Retry the file on the next apply run',
      requestMetadata: {
        ipAddress: '198.51.100.25',
        userAgent: 'HarmoniarrReviewRouteTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidateFileDecision.clearedDecision.decisionType, 'skip');
  });
});

test('import candidate allow-lossy-derivative route enforces csrf and persists the decision', async (t) => {
  const setImportCandidateFileAllowLossyDerivativeDecision = t.mock.fn(async ({ actorUserId, importCandidateFileId, importCandidateId, reason, requestMetadata }) => ({
    candidate: {
      id: importCandidateId,
      status: 'import_pending',
    },
    decision: {
      decisionType: 'allow_lossy_derivative',
      importCandidateFileId,
    },
    source: {
      actorUserId,
      requestMetadata,
      reason,
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-13', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    requireCsrf,
    requireFreshAdminSession,
    setImportCandidateFileAllowLossyDerivativeDecision,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/files/file-1/allow-lossy-derivative`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.26',
        'user-agent': 'HarmoniarrReviewRouteTest/1.0',
      },
      body: JSON.stringify({ reason: 'Allow lossy derivative for this import' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(setImportCandidateFileAllowLossyDerivativeDecision.mock.calls[0].arguments, [{
      actorUserId: 'user-13',
      importCandidateFileId: 'file-1',
      importCandidateId: 'candidate-1',
      reason: 'Allow lossy derivative for this import',
      requestMetadata: {
        ipAddress: '198.51.100.26',
        userAgent: 'HarmoniarrReviewRouteTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidateFileDecision.decision.decisionType, 'allow_lossy_derivative');
  });
});

test('import candidate detail route preserves shared not-found errors', async () => {
  const app = createImportCandidateRouteTestApp({
    getImportCandidate: async () => {
      const error = new Error('Import candidate not found');
      error.status = 404;
      error.code = 'import_candidate_not_found';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/missing-candidate`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'import_candidate_not_found',
        message: 'Import candidate not found',
      },
    });
  });
});

test('import candidate hold route enforces csrf and returns transition evidence', async (t) => {
  const holdImportCandidate = t.mock.fn(async ({ importCandidateId, actorUserId, reason, requestMetadata }) => ({
    candidate: {
      id: importCandidateId,
      status: 'held',
    },
    event: {
      eventType: 'import_candidate_held',
      previousStatus: 'pending',
      newStatus: 'held',
      reason,
    },
    source: {
      actorUserId,
      requestMetadata,
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-10', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    holdImportCandidate,
    requireCsrf,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/hold`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.23',
        'user-agent': 'HarmoniarrReviewRouteTest/1.0',
      },
      body: JSON.stringify({ reason: 'Needs review' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
  assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.calls[0].arguments[0].headers['x-csrf-token'], 'csrf-token');
    assert.deepEqual(holdImportCandidate.mock.calls[0].arguments, [{
      importCandidateId: 'candidate-1',
      reason: 'Needs review',
      actorUserId: 'user-10',
      requestMetadata: {
        ipAddress: '198.51.100.23',
        userAgent: 'HarmoniarrReviewRouteTest/1.0',
      },
    }]);
    assert.deepEqual(payload, {
      ok: true,
      review: {
        candidate: {
          id: 'candidate-1',
          status: 'held',
        },
        event: {
          eventType: 'import_candidate_held',
          previousStatus: 'pending',
          newStatus: 'held',
          reason: 'Needs review',
        },
        source: {
          actorUserId: 'user-10',
          requestMetadata: {
            ipAddress: '198.51.100.23',
            userAgent: 'HarmoniarrReviewRouteTest/1.0',
          },
        },
      },
    });
  });
});

test('import candidate select reject and reopen routes delegate to shared transition services', async (t) => {
  const selectImportCandidate = t.mock.fn(async ({ importCandidateId, reason }) => ({
    candidate: { id: importCandidateId, status: 'selected' },
    event: { eventType: 'import_candidate_selected', reason },
  }));
  const rejectImportCandidate = t.mock.fn(async ({ importCandidateId, reason }) => ({
    candidate: { id: importCandidateId, status: 'rejected' },
    event: { eventType: 'import_candidate_rejected', reason },
  }));
  const reopenImportCandidate = t.mock.fn(async ({ importCandidateId, reason }) => ({
    candidate: { id: importCandidateId, status: 'pending' },
    event: { eventType: 'import_candidate_reopened', reason },
  }));
  const app = createImportCandidateRouteTestApp({
    selectImportCandidate,
    rejectImportCandidate,
    reopenImportCandidate,
  });

  await withServer(app, async (baseUrl) => {
    const selectResponse = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/select`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ reason: 'Download this release' }),
    });
    const rejectResponse = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/reject`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ reason: 'Wrong album' }),
    });
    const reopenResponse = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/reopen`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ reason: 'Retry review' }),
    });

    assert.equal(selectResponse.status, 200);
    assert.equal(rejectResponse.status, 200);
    assert.equal(reopenResponse.status, 200);
    assert.equal(selectImportCandidate.mock.calls[0].arguments[0].reason, 'Download this release');
    assert.equal(rejectImportCandidate.mock.calls[0].arguments[0].reason, 'Wrong album');
    assert.equal(reopenImportCandidate.mock.calls[0].arguments[0].reason, 'Retry review');
  });
});

test('import candidate review routes preserve stale transition conflicts', async () => {
  const app = createImportCandidateRouteTestApp({
    holdImportCandidate: async () => {
      const error = new Error('Import candidate cannot transition from rejected to held');
      error.status = 409;
      error.code = 'import_candidate_status_conflict';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/candidate-1/hold`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ reason: 'Needs review' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'import_candidate_status_conflict',
        message: 'Import candidate cannot transition from rejected to held',
      },
    });
  });
});

test('import candidate slskd ingestion route enforces csrf and returns stored candidates', async (t) => {
  const ingestSlskdSearchResponses = t.mock.fn(async ({ searchId, actorUserId, requestMetadata }) => ({
    sourceProvider: 'slskd',
    sourceSearchId: searchId,
    candidateCount: 1,
    fileCount: 1,
    source: {
      actorUserId,
      requestMetadata,
    },
    candidates: [{
      id: 'candidate-1',
      username: 'source-user',
      folderPath: 'Autechre\\Amber',
      status: 'pending',
      fileCount: 1,
      files: [{
        id: 'file-1',
        filename: '01 Foil.flac',
      }],
    }],
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-9', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    ingestSlskdSearchResponses,
    requireCsrf,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/slskd/searches/search-1`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        'x-forwarded-for': '198.51.100.22',
        'user-agent': 'HarmoniarrImportCandidateTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.calls[0].arguments[0].headers['x-csrf-token'], 'csrf-token');
    assert.deepEqual(requireCsrf.mock.calls[0].arguments[1], {
      appUserId: 'user-9',
      csrfToken: 'csrf-token',
      user: {
        role: 'admin',
      },
    });
    assert.deepEqual(ingestSlskdSearchResponses.mock.calls[0].arguments, [{
      searchId: 'search-1',
      actorUserId: 'user-9',
      requestMetadata: {
        ipAddress: '198.51.100.22',
        userAgent: 'HarmoniarrImportCandidateTest/1.0',
      },
    }]);
    assert.deepEqual(payload, {
      ok: true,
      importCandidates: {
        sourceProvider: 'slskd',
        sourceSearchId: 'search-1',
        candidateCount: 1,
        fileCount: 1,
        source: {
          actorUserId: 'user-9',
          requestMetadata: {
            ipAddress: '198.51.100.22',
            userAgent: 'HarmoniarrImportCandidateTest/1.0',
          },
        },
        candidates: [{
          id: 'candidate-1',
          username: 'source-user',
          folderPath: 'Autechre\\Amber',
          status: 'pending',
          fileCount: 1,
          files: [{
            id: 'file-1',
            filename: '01 Foil.flac',
          }],
        }],
      },
    });
  });
});

test('import candidate execution start route preserves forced re-auth failures from the injected admin guard', async () => {
  const app = createImportCandidateRouteTestApp({
    requireFreshAdminSession: async () => {
      throw Object.assign(new Error('Re-authentication is required before continuing'), {
        status: 403,
        code: 'reauth_required',
      });
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'reauth_required',
        message: 'Re-authentication is required before continuing',
      },
    });
  });
});

test('import candidate execution start route preserves injected rate limit failures before run creation', async (t) => {
  const startImportCandidateExecutionRun = t.mock.fn(async () => ({ accepted: true }));
  const app = createImportCandidateRouteTestApp({
    limitImportCandidateExecutionRun: (_request, _response, next) => {
      next(createApiError(429, 'rate_limited', 'Too many requests. Try again later.'));
    },
    startImportCandidateExecutionRun,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    assert.equal(response.status, 429);
    assert.equal(startImportCandidateExecutionRun.mock.callCount(), 0);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'rate_limited',
        message: 'Too many requests. Try again later.',
      },
    });
  });
});

test('import candidate slskd ingestion route normalizes provider failures', async () => {
  const app = createImportCandidateRouteTestApp({
    ingestSlskdSearchResponses: async () => {
      const error = new Error('slskd search responses request failed with status 503');
      error.code = 'slskd_unavailable';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/slskd/searches/search-1`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unavailable',
        message: 'slskd is temporarily unavailable',
      },
    });
  });
});

test('import candidate execution run detail route returns a historical run', async (t) => {
  const buildImportCandidateExecutionRunDetail = t.mock.fn(async ({ runId }) => ({
    checkedAt: '2026-04-30T20:35:00.000Z',
    run: {
      errorMessage: null,
      finishedAt: '2026-04-30T20:34:00.000Z',
      id: runId,
      plannedCandidateCount: 2,
      skippedCandidateCount: 0,
      startedAt: '2026-04-30T20:33:00.000Z',
      status: 'completed',
      transferredCandidateCount: 2,
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportCandidateExecutionRunDetail });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs/run-42`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildImportCandidateExecutionRunDetail.mock.calls[0].arguments, [{ runId: 'run-42' }]);
    assert.deepEqual(payload, {
      ok: true,
      importCandidateExecutionRun: {
        checkedAt: '2026-04-30T20:35:00.000Z',
        run: {
          errorMessage: null,
          finishedAt: '2026-04-30T20:34:00.000Z',
          id: 'run-42',
          plannedCandidateCount: 2,
          skippedCandidateCount: 0,
          startedAt: '2026-04-30T20:33:00.000Z',
          status: 'completed',
          transferredCandidateCount: 2,
        },
      },
    });
  });
});

test('import candidate apply run detail route returns a historical run', async (t) => {
  const buildImportCandidateApplyRunDetail = t.mock.fn(async ({ runId }) => ({
    checkedAt: '2026-04-30T21:10:00.000Z',
    run: {
      completedFileCount: 3,
      errorMessage: null,
      failedFileCount: 1,
      finishedAt: '2026-04-30T21:09:00.000Z',
      id: runId,
      skippedFileCount: 0,
      startedAt: '2026-04-30T21:08:00.000Z',
      status: 'completed',
      totalFileCount: 4,
    },
  }));
  const app = createImportCandidateRouteTestApp({ buildImportCandidateApplyRunDetail });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/apply-runs/apply-run-7`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(buildImportCandidateApplyRunDetail.mock.calls[0].arguments, [{ runId: 'apply-run-7' }]);
    assert.deepEqual(payload, {
      ok: true,
      importCandidateApplyRun: {
        checkedAt: '2026-04-30T21:10:00.000Z',
        run: {
          completedFileCount: 3,
          errorMessage: null,
          failedFileCount: 1,
          finishedAt: '2026-04-30T21:09:00.000Z',
          id: 'apply-run-7',
          skippedFileCount: 0,
          startedAt: '2026-04-30T21:08:00.000Z',
          status: 'completed',
          totalFileCount: 4,
        },
      },
    });
  });
});

test('import candidate bulk review route enforces csrf and returns aggregate results', async (t) => {
  const bulkReviewImportCandidates = t.mock.fn(async ({ action, actorUserId, importCandidateIds, reason, requestMetadata }) => ({
    results: [
      { importCandidateId: 'c-1', ok: true, previousStatus: 'pending', newStatus: 'selected' },
      { importCandidateId: 'c-2', ok: true, previousStatus: 'pending', newStatus: 'selected' },
      { importCandidateId: 'c-3', ok: false, error: { code: 'import_candidate_status_conflict', message: 'Candidate c-3 cannot transition from rejected to selected' }, previousStatus: 'rejected' },
    ],
    summary: { action, failed: 1, succeeded: 2, total: 3 },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-token', user: { role: 'admin' } }));
  const app = createImportCandidateRouteTestApp({
    bulkReviewImportCandidates,
    requireCsrf,
    requireFreshAdminSession,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/bulk-review`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
        'user-agent': 'HarmoniarrBulkReviewTest/1.0',
      },
      body: JSON.stringify({
        action: 'select',
        importCandidateIds: ['c-1', 'c-2', 'c-3'],
        reason: 'Batch approve',
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(bulkReviewImportCandidates.mock.calls[0].arguments, [{
      action: 'select',
      actorUserId: 'admin-1',
      importCandidateIds: ['c-1', 'c-2', 'c-3'],
      reason: 'Batch approve',
      requestMetadata: {
        ipAddress: '127.0.0.1',
        userAgent: 'HarmoniarrBulkReviewTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.summary.succeeded, 2);
    assert.equal(payload.summary.failed, 1);
    assert.equal(payload.summary.total, 3);
    assert.equal(payload.results.length, 3);
  });
});

test('import candidate slskd ingestion route normalizes misconfigured provider failures', async () => {
  const app = createImportCandidateRouteTestApp({
    ingestSlskdSearchResponses: async () => {
      const error = new Error('slskd is not configured: SLSKD_API_KEY is missing');
      error.code = 'slskd_misconfigured';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/slskd/searches/search-1`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_misconfigured',
        message: 'slskd is not configured: SLSKD_API_KEY is missing',
      },
    });
  });
});

test('import candidate slskd ingestion route normalizes unauthorized provider failures', async () => {
  const app = createImportCandidateRouteTestApp({
    ingestSlskdSearchResponses: async () => {
      const error = new Error('slskd rejected credentials');
      error.code = 'slskd_unauthorized';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/slskd/searches/search-1`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unauthorized',
        message: 'slskd authentication failed',
      },
    });
  });
});

test('import candidate execution summary route normalizes slskd unavailable errors from transfer snapshot', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionSummary: async () => {
      const error = new Error('slskd transfer snapshot failed: service unavailable');
      error.code = 'slskd_unavailable';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unavailable',
        message: 'slskd is temporarily unavailable',
      },
    });
  });
});

test('import candidate execution summary route normalizes slskd misconfigured errors from transfer snapshot', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionSummary: async () => {
      const error = new Error('slskd is not configured: SLSKD_API_KEY is missing');
      error.code = 'slskd_misconfigured';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_misconfigured',
        message: 'slskd is not configured: SLSKD_API_KEY is missing',
      },
    });
  });
});

test('import candidate execution summary route normalizes slskd unauthorized errors from transfer snapshot', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionSummary: async () => {
      const error = new Error('slskd rejected credentials');
      error.code = 'slskd_unauthorized';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unauthorized',
        message: 'slskd authentication failed',
      },
    });
  });
});

test('import candidate execution summary route normalizes slskd request-failed errors to 502', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionSummary: async () => {
      const error = new Error('slskd returned an invalid response for downloads');
      error.code = 'slskd_request_failed';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_request_failed',
        message: 'slskd returned an invalid response for downloads',
      },
    });
  });
});

test('import candidate execution run detail route normalizes slskd unavailable errors from transfer snapshot', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionRunDetail: async () => {
      const error = new Error('slskd transfer snapshot failed: service unavailable');
      error.code = 'slskd_unavailable';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs/run-99`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unavailable',
        message: 'slskd is temporarily unavailable',
      },
    });
  });
});

test('import candidate execution run detail route normalizes slskd request-failed errors to 502', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionRunDetail: async () => {
      const error = new Error('slskd download request malformed');
      error.code = 'slskd_request_failed';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs/run-99`);
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_request_failed',
        message: 'slskd download request malformed',
      },
    });
  });
});

test('import candidate slskd ingestion route normalizes request-failed provider errors to 502', async () => {
  const app = createImportCandidateRouteTestApp({
    ingestSlskdSearchResponses: async () => {
      const error = new Error('slskd returned an invalid response for search results');
      error.code = 'slskd_request_failed';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/slskd/searches/search-1`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_request_failed',
        message: 'slskd returned an invalid response for search results',
      },
    });
  });
});

test('import candidate execution summary route returns 200 with partial data when slskd is unavailable', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionSummary: async () => ({
      activeRun: { id: 'run-1', status: 'running' },
      checkedAt: '2026-05-15T10:00:00.000Z',
      currentRun: {
        id: 'run-1',
        items: [{
          id: 'item-1',
          itemStatus: 'queued',
          liveTransferSummary: { status: 'not_found', message: 'No live transfers found.' },
          liveTransfers: [],
          persistedTransferObservation: {
            lastReconciledAt: '2026-05-15T09:58:00.000Z',
            lastSeenAt: '2026-05-15T09:58:00.000Z',
            summary: { message: 'Active', status: 'active', total: 1 },
            transfers: [],
          },
          statusMessage: 'Enqueued.',
        }],
        status: 'running',
        transferSnapshotUnavailable: true,
      },
      latestRun: { id: 'run-1', status: 'running' },
      recentRuns: [],
      summary: { message: 'Running', status: 'running' },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidateExecution.currentRun.transferSnapshotUnavailable, true);
    assert.equal(payload.importCandidateExecution.currentRun.items.length, 1);
  });
});

test('import candidate execution run detail route returns 200 with partial data when slskd is unavailable', async () => {
  const app = createImportCandidateRouteTestApp({
    buildImportCandidateExecutionRunDetail: async () => ({
      checkedAt: '2026-05-15T10:00:00.000Z',
      run: {
        id: 'run-42',
        items: [{
          id: 'item-42',
          itemStatus: 'queued',
          liveTransferSummary: { status: 'not_found', message: 'No live transfers found.' },
          liveTransfers: [],
          persistedTransferObservation: {
            lastReconciledAt: '2026-05-15T09:55:00.000Z',
            lastSeenAt: '2026-05-15T09:55:00.000Z',
            summary: { message: 'Queued', status: 'queued', total: 1 },
            transfers: [],
          },
          statusMessage: 'Enqueued.',
        }],
        status: 'running',
        transferSnapshotUnavailable: true,
      },
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/import-candidates/execution-runs/run-42`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.importCandidateExecutionRun.run.transferSnapshotUnavailable, true);
    assert.equal(payload.importCandidateExecutionRun.run.items.length, 1);
  });
});
