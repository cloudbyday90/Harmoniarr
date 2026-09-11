/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExternalCollectionPreparationProgress } from '../../src/server/library/library-external-request-collection-progress.js';
import { createLibraryExternalRequestCollectionProgressStore } from '../../src/server/library/library-external-request-collection-progress-store.js';

function progressRow(overrides = {}) {
  return {
    revision: '4', status: 'preparing', pages_completed: 1, items_seen: 3, leaves_captured: 2,
    work_total: 4, work_completed: 1, work_pending: 3, work_failed: 0, work_processing: 0, work_unsupported: 0,
    page_total: 2, page_completed: 1, page_pending: 1, page_failed: 0, terminal_pages: 0,
    operations_queued: 0, operations_running: 1, ...overrides,
  };
}

test('preparation projects persisted work separately from running batches and omits private evidence', () => {
  const result = projectExternalCollectionPreparationProgress(progressRow({ evidence: { token: 'private-provider-evidence' } }));
  assert.deepEqual(result, {
    revision: 4,
    work: { total: 4, completed: 1, pending: 3, failed: 0, processing: 0, unsupported: 0 },
    operations: { queued: 0, running: 1 },
    pages: { completed: 1, pending: 1, failed: 0, total: null, traversalComplete: false },
    entriesSeen: 3, leavesCaptured: 2,
  });
  assert.ok(!JSON.stringify(result).includes('private-provider'), 'Progress contains only allowlisted aggregate fields.');
});

test('a known page total requires completed container rows and a terminal continuation response', () => {
  const exhausted = progressRow({ page_total: 1, page_completed: 1, page_pending: 0, terminal_pages: 1 });
  assert.deepEqual(projectExternalCollectionPreparationProgress(exhausted).pages,
    { completed: 1, pending: 0, failed: 0, total: 1, traversalComplete: true });
  for (const overrides of [
    { terminal_pages: 0 },
    { page_total: 0, page_completed: 0, pages_completed: 0, terminal_pages: 0 },
    { page_total: 2, page_completed: 1, page_pending: 0, page_failed: 1 },
    { status: 'blocked' },
    { page_total: 2, page_completed: 2, pages_completed: 1 },
  ]) {
    const result = projectExternalCollectionPreparationProgress({ ...exhausted, ...overrides });
    assert.equal(result.pages.total, null);
    assert.equal(result.pages.traversalComplete, false);
  }
});

test('blocked and completed collections never advertise eligible running preparation batches', () => {
  for (const status of ['blocked', 'ready', 'reviewed']) {
    const result = projectExternalCollectionPreparationProgress(progressRow({ status, operations_queued: 1 }));
    assert.deepEqual(result.operations, { queued: 0, running: 0 });
  }
  assert.equal(projectExternalCollectionPreparationProgress(null), null);
  assert.equal(projectExternalCollectionPreparationProgress(progressRow({ status: 'cancelled' })), null);
  assert.equal(projectExternalCollectionPreparationProgress(progressRow({ work_failed: -1 })), null);
});

test('progress reads use the supplied transaction and bind request, recipient, revision and preparation operation types', async () => {
  let parameters;
  const queryable = { query: async (_sql, values) => { parameters = values; return { rows: [progressRow()] }; } };
  const store = createLibraryExternalRequestCollectionProgressStore({ getPoolFn: () => { throw new Error('Unexpected pool read'); } });
  await store.getPreparationProgress({ mediaRequestId: 'request', requestedForUserId: 'recipient', revision: 4, queryable });
  assert.deepEqual(parameters, ['request', 'recipient', 4,
    ['library_external_intake_planning', 'library_external_intake_execution'], ['playlist_page', 'artist']]);
});
