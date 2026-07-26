import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImportReviewApplyRunLocation,
  buildImportReviewExecutionRunLocation,
  buildImportReviewMediaInspectionRunLocation,
  buildImportReviewRouteQuery,
  getImportReviewRouteStateKey,
  normalizeImportReviewRouteState,
} from '../../src/client/lib/import-review-route-state.js';

test('normalizeImportReviewRouteState trims route query values and defaults invalid status to pending', () => {
  assert.deepEqual(normalizeImportReviewRouteState({
    candidateFile: ' file-1 ',
    candidate: ' candidate-1 ',
    folderPath: '  Amber ',
    sourceSearchId: ' search-1 ',
    status: 'invalid',
    username: ' source-user ',
  }), {
    applyRunId: '',
    candidateFileId: 'file-1',
    candidateId: 'candidate-1',
    executionRunId: '',
    mediaInspectionRunId: '',
    folderPath: 'Amber',
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source-user',
  });
});

test('normalizeImportReviewRouteState maps all-status route tokens to an empty status filter', () => {
  assert.deepEqual(normalizeImportReviewRouteState({ status: 'all' }), {
    applyRunId: '',
    candidateFileId: '',
    candidateId: '',
    executionRunId: '',
    mediaInspectionRunId: '',
    folderPath: '',
    sourceSearchId: '',
    status: '',
    username: '',
  });
});

test('normalizeImportReviewRouteState accepts internal candidateId state keys', () => {
  assert.deepEqual(normalizeImportReviewRouteState({
    candidateFileId: ' file-99 ',
    candidateId: ' candidate-99 ',
  }), {
    applyRunId: '',
    candidateFileId: 'file-99',
    candidateId: 'candidate-99',
    executionRunId: '',
    mediaInspectionRunId: '',
    folderPath: '',
    sourceSearchId: '',
    status: 'pending',
    username: '',
  });
});

test('buildImportReviewRouteQuery omits default pending status and preserves explicit all-status queries', () => {
  assert.deepEqual(buildImportReviewRouteQuery({
    applyRunId: 'apply-run-2',
    candidateFileId: 'file-3',
    candidateId: 'candidate-1',
    executionRunId: 'execution-run-1',
    mediaInspectionRunId: 'inspection-run-1',
    folderPath: 'Amber',
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source-user',
  }), {
    applyRunId: 'apply-run-2',
    candidateFile: 'file-3',
    candidate: 'candidate-1',
    executionRunId: 'execution-run-1',
    mediaInspectionRunId: 'inspection-run-1',
    folderPath: 'Amber',
    sourceSearchId: 'search-1',
    username: 'source-user',
  });

  assert.deepEqual(buildImportReviewRouteQuery({
    status: '',
  }), {
    status: 'all',
  });
});

test('getImportReviewRouteStateKey matches equivalent route states after normalization', () => {
  assert.equal(
    getImportReviewRouteStateKey({
      candidateFileId: ' file-1 ',
      candidateId: ' candidate-1 ',
      folderPath: ' Amber ',
      sourceSearchId: ' search-1 ',
      status: 'all',
      username: ' source-user ',
    }),
    getImportReviewRouteStateKey({
      candidateFileId: 'file-1',
      candidateId: 'candidate-1',
      folderPath: 'Amber',
      sourceSearchId: 'search-1',
      status: '',
      username: 'source-user',
    }),
  );
});

test('normalizeImportReviewRouteState preserves downloading and import-pending statuses', () => {
  assert.equal(normalizeImportReviewRouteState({ status: 'downloading' }).status, 'downloading');
  assert.equal(normalizeImportReviewRouteState({ status: 'import_pending' }).status, 'import_pending');
});

test('import review route helpers build execution and apply run drill-down locations', () => {
  assert.deepEqual(buildImportReviewExecutionRunLocation('execution-run-22'), {
    hash: '#import-execution-run-panel',
    name: 'activity-diagnostics-matches',
    query: {
      executionRunId: 'execution-run-22',
    },
  });

  assert.deepEqual(buildImportReviewApplyRunLocation('apply-run-9'), {
    hash: '#import-apply-run-panel',
    name: 'activity-diagnostics-matches',
    query: {
      applyRunId: 'apply-run-9',
    },
  });

  assert.deepEqual(buildImportReviewMediaInspectionRunLocation('inspection-run-4'), {
    hash: '#import-media-inspection-run-panel',
    name: 'activity-diagnostics-matches',
    query: {
      mediaInspectionRunId: 'inspection-run-4',
    },
  });
});
