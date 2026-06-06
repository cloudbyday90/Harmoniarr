/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createApiError, getRequestMetadata, requireCsrf, requireSession } from '../auth.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute, sanitizePageLimit, sanitizePageOffset } from '../http.js';
import {
  assertImportCandidateVisible,
  buildImportCandidateVisibilityFilter,
} from '../import-candidates/import-candidate-visibility.js';
import {
  canViewImportCandidateDiagnosticFields,
  projectImportCandidateDetailForRead,
  projectImportCandidateListResultForRead,
} from '../import-candidates/import-candidate-read-projection.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies({
  getRequestMetadata,
  requireCsrf,
  requireSession,
});

function normalizeImportCandidateError(error) {
  switch (error?.code) {
    case 'slskd_misconfigured':
      return createApiError(503, error.code, error.message);
    case 'slskd_unauthorized':
      return createApiError(503, error.code, 'slskd authentication failed');
    case 'slskd_unavailable':
      return createApiError(503, error.code, 'slskd is temporarily unavailable');
    case 'slskd_request_failed':
      return createApiError(502, error.code, error.message);
    default:
      return error;
  }
}

function importCandidateRoute(handler) {
  return asyncRoute(async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      throw normalizeImportCandidateError(error);
    }
  });
}

export function registerImportCandidateRoutes(app, {
  buildImportCandidateApplyRunDetail,
  buildImportCandidateApplySummary,
  buildImportCandidateExecutionRunDetail,
  buildImportCandidateExecutionSummary,
  buildImportCandidateMediaInspectionRunDetail,
  buildImportCandidateMediaInspectionSummary,
  buildCandidateReputationSummary = () => ({}),
  buildImportPendingCandidateSummary,
  buildSelectedImportCandidateSummary,
  bulkReviewImportCandidates,
  clearImportCandidateFileDecision,
  enrichCandidatesWithUploaderReputation = async (candidates) => candidates,
  requireAdminSession: requireAdminSessionFn = defaultRequestAuthDependencies.requireAdminSession,
  getRequestMetadata: getRequestMetadataFn = defaultRequestAuthDependencies.getRequestMetadata,
  getImportCandidate,
  holdImportCandidate,
  ingestSlskdSearchResponses,
  limitImportCandidateApplyRun = skipRateLimitMiddleware,
  limitImportCandidateMediaInspectionRun = skipRateLimitMiddleware,
  limitImportCandidateTranscodeRun = skipRateLimitMiddleware,
  limitImportCandidateExecutionReconcile = skipRateLimitMiddleware,
  limitImportCandidateExecutionRun = skipRateLimitMiddleware,
  limitImportCandidateSlskdIngest = skipRateLimitMiddleware,
  limitImportCandidateDecision = skipRateLimitMiddleware,
  listImportCandidates,
  previewImportCandidateApply,
  previewImportCandidate,
  reconcileImportCandidateExecutionState,
  rejectImportCandidate,
  requireCsrf: requireCsrfFn = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession: requireFreshAdminSessionFn = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession: requireSessionFn = defaultRequestAuthDependencies.requireSession,
  reopenImportCandidate,
  setImportCandidateFileAllowLossyDerivativeDecision,
  setImportCandidateFileSkipDecision,
  selectImportCandidate,
  startImportCandidateApplyRun,
  startImportCandidateMediaInspectionRun,
  startImportCandidateTranscodeRun,
  startImportCandidateExecutionRun,
}) {
  function buildReadVisibility(session) {
    return buildImportCandidateVisibilityFilter({
      actorUserId: session?.appUserId ?? null,
      actorUserRole: session?.user?.role ?? null,
    });
  }

  app.get('/api/v1/import-candidates', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const visibility = buildReadVisibility(session);
    const actorUserRole = session?.user?.role ?? null;

    const result = await listImportCandidates({
      folderPath: request.query.folderPath,
      limit: sanitizePageLimit(request.query.limit, { default: 25, max: 100 }),
      offset: sanitizePageOffset(request.query.offset),
      requestedForUserId: visibility.requestedForUserId,
      sourceSearchId: request.query.sourceSearchId,
      status: request.query.status,
      username: request.query.username,
    });

    const canViewDiagnosticFields = canViewImportCandidateDiagnosticFields(actorUserRole);
    const enrichedCandidates = canViewDiagnosticFields
      ? await enrichCandidatesWithUploaderReputation(result.candidates)
      : result.candidates;
    const reputationSummary = canViewDiagnosticFields
      ? buildCandidateReputationSummary(enrichedCandidates)
      : {};
    const projectedResult = projectImportCandidateListResultForRead({
      ...result,
      candidates: enrichedCandidates,
    }, { actorUserRole });

    response.json({
      ok: true,
      importCandidates: {
        ...projectedResult,
        reputationSummary,
      },
    });
  }));

  app.get('/api/v1/import-candidates/execution-summary', importCandidateRoute(async (request, response) => {
    await requireAdminSessionFn(request);

    response.json({
      ok: true,
      importCandidateExecution: await buildImportCandidateExecutionSummary(),
    });
  }));

  app.get('/api/v1/import-candidates/execution-runs/:runId', importCandidateRoute(async (request, response) => {
    await requireAdminSessionFn(request);

    response.json({
      ok: true,
      importCandidateExecutionRun: await buildImportCandidateExecutionRunDetail({
        runId: request.params.runId,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/apply-summary', importCandidateRoute(async (request, response) => {
    await requireAdminSessionFn(request);

    response.json({
      ok: true,
      importCandidateApply: await buildImportCandidateApplySummary(),
    });
  }));

  app.get('/api/v1/import-candidates/apply-runs/:runId', importCandidateRoute(async (request, response) => {
    await requireAdminSessionFn(request);

    response.json({
      ok: true,
      importCandidateApplyRun: await buildImportCandidateApplyRunDetail({
        runId: request.params.runId,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/media-inspection-summary', importCandidateRoute(async (request, response) => {
    await requireAdminSessionFn(request);

    response.json({
      ok: true,
      importCandidateMediaInspection: await buildImportCandidateMediaInspectionSummary(),
    });
  }));

  app.get('/api/v1/import-candidates/media-inspection-runs/:runId', importCandidateRoute(async (request, response) => {
    await requireAdminSessionFn(request);

    response.json({
      ok: true,
      importCandidateMediaInspectionRun: await buildImportCandidateMediaInspectionRunDetail({
        runId: request.params.runId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/execution-runs', limitImportCandidateExecutionRun, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    response.status(202).json({
      ok: true,
      ...await startImportCandidateExecutionRun({
        requestMetadata: getRequestMetadataFn(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/apply-runs', limitImportCandidateApplyRun, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    response.status(202).json({
      ok: true,
      ...await startImportCandidateApplyRun({
        requestMetadata: getRequestMetadataFn(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/media-inspection-runs', limitImportCandidateMediaInspectionRun, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    response.status(202).json({
      ok: true,
      ...await startImportCandidateMediaInspectionRun({
        requestMetadata: getRequestMetadataFn(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/transcode-runs', limitImportCandidateTranscodeRun, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    response.status(202).json({
      ok: true,
      ...await startImportCandidateTranscodeRun({
        requestMetadata: getRequestMetadataFn(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/execution-reconcile', limitImportCandidateExecutionReconcile, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    response.json({
      ok: true,
      reconciliation: await reconcileImportCandidateExecutionState({
        actorUserId: session.appUserId,
        requestMetadata: getRequestMetadataFn(request),
      }),
    });
  }));

  app.get('/api/v1/import-candidates/selected-summary', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);

    response.json({
      ok: true,
      selectedImportCandidates: await buildSelectedImportCandidateSummary({
        actorUserId: session.appUserId,
        actorUserRole: session.user?.role ?? null,
        limit: sanitizePageLimit(request.query.limit, { default: 25, max: 1000 }),
        targetUser: { id: session.appUserId },
      }),
    });
  }));

  app.get('/api/v1/import-candidates/import-pending-summary', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);

    response.json({
      ok: true,
      importPendingCandidates: await buildImportPendingCandidateSummary({
        actorUserId: session.appUserId,
        actorUserRole: session.user?.role ?? null,
        limit: sanitizePageLimit(request.query.limit, { default: 25, max: 1000 }),
        targetUser: { id: session.appUserId },
      }),
    });
  }));

  app.get('/api/v1/import-candidates/:importCandidateId', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const actorUserRole = session?.user?.role ?? null;
    const importCandidate = await getImportCandidate({
      importCandidateId: request.params.importCandidateId,
    });
    assertImportCandidateVisible({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      candidate: importCandidate,
    });

    const [readCandidate] = canViewImportCandidateDiagnosticFields(actorUserRole)
      ? await enrichCandidatesWithUploaderReputation([importCandidate])
      : [importCandidate];

    response.json({
      ok: true,
      importCandidate: projectImportCandidateDetailForRead(readCandidate, { actorUserRole }),
    });
  }));

  app.get('/api/v1/import-candidates/:importCandidateId/preview', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const importCandidate = await getImportCandidate({
      importCandidateId: request.params.importCandidateId,
    });
    assertImportCandidateVisible({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      candidate: importCandidate,
    });

    response.json({
      ok: true,
      importCandidatePreview: await previewImportCandidate({
        importCandidateId: request.params.importCandidateId,
        targetUser: { id: session.appUserId },
      }),
    });
  }));

  app.get('/api/v1/import-candidates/:importCandidateId/apply-preview', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    const importCandidate = await getImportCandidate({
      importCandidateId: request.params.importCandidateId,
    });
    assertImportCandidateVisible({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      candidate: importCandidate,
    });

    response.json({
      ok: true,
      importCandidateApplyPreview: await previewImportCandidateApply({
        importCandidateId: request.params.importCandidateId,
        targetUser: { id: session.appUserId },
      }),
    });
  }));

  function registerFileDecisionRoute(path, decisionHandler, responseKey) {
    app.post(path, limitImportCandidateDecision, importCandidateRoute(async (request, response) => {
      const session = await requireFreshAdminSessionFn(request);
      requireCsrfFn(request, session);

      response.json({
        ok: true,
        [responseKey]: await decisionHandler({
          actorUserId: session.appUserId,
          importCandidateFileId: request.params.importCandidateFileId,
          importCandidateId: request.params.importCandidateId,
          reason: request.body?.reason,
          requestMetadata: getRequestMetadataFn(request),
        }),
      });
    }));
  }

  registerFileDecisionRoute(
    '/api/v1/import-candidates/:importCandidateId/files/:importCandidateFileId/skip',
    setImportCandidateFileSkipDecision,
    'importCandidateFileDecision',
  );
  registerFileDecisionRoute(
    '/api/v1/import-candidates/:importCandidateId/files/:importCandidateFileId/allow-lossy-derivative',
    setImportCandidateFileAllowLossyDerivativeDecision,
    'importCandidateFileDecision',
  );
  registerFileDecisionRoute(
    '/api/v1/import-candidates/:importCandidateId/files/:importCandidateFileId/clear-decision',
    clearImportCandidateFileDecision,
    'importCandidateFileDecision',
  );

  function registerReviewTransition(path, transitionCandidate) {
    app.post(path, limitImportCandidateDecision, importCandidateRoute(async (request, response) => {
      const session = await requireFreshAdminSessionFn(request);
      requireCsrfFn(request, session);

      response.json({
        ok: true,
        review: await transitionCandidate({
          importCandidateId: request.params.importCandidateId,
          reason: request.body?.reason,
          actorUserId: session.appUserId,
          requestMetadata: getRequestMetadataFn(request),
        }),
      });
    }));
  }

  registerReviewTransition('/api/v1/import-candidates/:importCandidateId/select', selectImportCandidate);
  registerReviewTransition('/api/v1/import-candidates/:importCandidateId/hold', holdImportCandidate);
  registerReviewTransition('/api/v1/import-candidates/:importCandidateId/reject', rejectImportCandidate);
  registerReviewTransition('/api/v1/import-candidates/:importCandidateId/reopen', reopenImportCandidate);

  app.post('/api/v1/import-candidates/bulk-review', limitImportCandidateDecision, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    const result = await bulkReviewImportCandidates({
      action: request.body?.action,
      actorUserId: session.appUserId,
      importCandidateIds: request.body?.importCandidateIds,
      reason: request.body?.reason,
      requestMetadata: getRequestMetadataFn(request),
    });

    response.json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/import-candidates/slskd/searches/:searchId', limitImportCandidateSlskdIngest, importCandidateRoute(async (request, response) => {
    const session = await requireFreshAdminSessionFn(request);
    requireCsrfFn(request, session);

    const result = await ingestSlskdSearchResponses({
      searchId: request.params.searchId,
      actorUserId: session.appUserId,
      requestMetadata: getRequestMetadataFn(request),
    });

    response.status(201).json({
      ok: true,
      importCandidates: result,
    });
  }));
}
