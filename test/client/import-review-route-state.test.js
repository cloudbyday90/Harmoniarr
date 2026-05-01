import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImportReviewRouteQuery,
  getImportReviewRouteStateKey,
  normalizeImportReviewRouteState,
} from '../../src/client/lib/import-review-route-state.js';

test('normalizeImportReviewRouteState trims route query values and defaults invalid status to pending', () => {
  assert.deepEqual(normalizeImportReviewRouteState({
    candidate: ' candidate-1 ',
    folderPath: '  Amber ',
    sourceSearchId: ' search-1 ',
    status: 'invalid',
    username: ' source-user ',
  }), {
    candidateId: 'candidate-1',
    folderPath: 'Amber',
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source-user',
  });
});

test('normalizeImportReviewRouteState maps all-status route tokens to an empty status filter', () => {
  assert.deepEqual(normalizeImportReviewRouteState({ status: 'all' }), {
    candidateId: '',
    folderPath: '',
    sourceSearchId: '',
    status: '',
    username: '',
  });
});

test('buildImportReviewRouteQuery omits default pending status and preserves explicit all-status queries', () => {
  assert.deepEqual(buildImportReviewRouteQuery({
    candidateId: 'candidate-1',
    folderPath: 'Amber',
    sourceSearchId: 'search-1',
    status: 'pending',
    username: 'source-user',
  }), {
    candidate: 'candidate-1',
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
      candidateId: ' candidate-1 ',
      folderPath: ' Amber ',
      sourceSearchId: ' search-1 ',
      status: 'all',
      username: ' source-user ',
    }),
    getImportReviewRouteStateKey({
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