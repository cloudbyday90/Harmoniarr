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
import { asyncRoute } from '../http.js';

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
  buildImportCandidateApplySummary,
  buildImportCandidateExecutionSummary,
  buildImportPendingCandidateSummary,
  buildSelectedImportCandidateSummary,
  clearImportCandidateFileDecision,
  getRequestMetadata: getRequestMetadataFn = defaultRequestAuthDependencies.getRequestMetadata,
  getImportCandidate,
  holdImportCandidate,
  ingestSlskdSearchResponses,
  listImportCandidates,
  previewImportCandidateApply,
  previewImportCandidate,
  reconcileImportCandidateExecutionState,
  rejectImportCandidate,
  requireCsrf: requireCsrfFn = defaultRequestAuthDependencies.requireCsrf,
  requireSession: requireSessionFn = defaultRequestAuthDependencies.requireSession,
  reopenImportCandidate,
  setImportCandidateFileSkipDecision,
  selectImportCandidate,
  startImportCandidateApplyRun,
  startImportCandidateExecutionRun,
}) {
  app.get('/api/v1/import-candidates', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importCandidates: await listImportCandidates({
        folderPath: request.query.folderPath,
        limit: request.query.limit,
        offset: request.query.offset,
        sourceSearchId: request.query.sourceSearchId,
        status: request.query.status,
        username: request.query.username,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/execution-summary', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importCandidateExecution: await buildImportCandidateExecutionSummary(),
    });
  }));

  app.get('/api/v1/import-candidates/apply-summary', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importCandidateApply: await buildImportCandidateApplySummary(),
    });
  }));

  app.post('/api/v1/import-candidates/execution-runs', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    requireCsrfFn(request, session);

    response.status(202).json({
      ok: true,
      ...await startImportCandidateExecutionRun({
        requestMetadata: getRequestMetadataFn(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/apply-runs', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
    requireCsrfFn(request, session);

    response.status(202).json({
      ok: true,
      ...await startImportCandidateApplyRun({
        requestMetadata: getRequestMetadataFn(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/import-candidates/execution-reconcile', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
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
    await requireSessionFn(request);

    response.json({
      ok: true,
      selectedImportCandidates: await buildSelectedImportCandidateSummary({
        limit: request.query.limit,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/import-pending-summary', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importPendingCandidates: await buildImportPendingCandidateSummary({
        limit: request.query.limit,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/:importCandidateId', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importCandidate: await getImportCandidate({
        importCandidateId: request.params.importCandidateId,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/:importCandidateId/preview', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importCandidatePreview: await previewImportCandidate({
        importCandidateId: request.params.importCandidateId,
      }),
    });
  }));

  app.get('/api/v1/import-candidates/:importCandidateId/apply-preview', importCandidateRoute(async (request, response) => {
    await requireSessionFn(request);

    response.json({
      ok: true,
      importCandidateApplyPreview: await previewImportCandidateApply({
        importCandidateId: request.params.importCandidateId,
      }),
    });
  }));

  function registerFileDecisionRoute(path, decisionHandler, responseKey) {
    app.post(path, importCandidateRoute(async (request, response) => {
      const session = await requireSessionFn(request);
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
    '/api/v1/import-candidates/:importCandidateId/files/:importCandidateFileId/clear-decision',
    clearImportCandidateFileDecision,
    'importCandidateFileDecision',
  );

  function registerReviewTransition(path, transitionCandidate) {
    app.post(path, importCandidateRoute(async (request, response) => {
      const session = await requireSessionFn(request);
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

  app.post('/api/v1/import-candidates/slskd/searches/:searchId', importCandidateRoute(async (request, response) => {
    const session = await requireSessionFn(request);
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
