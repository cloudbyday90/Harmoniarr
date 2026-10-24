/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateQualityReviewCandidateStore } from '../../src/server/import-candidates/import-candidate-quality-review-candidate-store.js';

test('batch facts use a parameterized stable keyset, exclude detail owners and join the supplied transaction', async () => {
  let query;
  const queryable = { query: async (sql, params) => { query = { sql, params }; return { rows: [{ id: 'candidate', status: 'held',
    source_search_id: 'search', file_count: 2, total_size_bytes: '1234', quality_payload: { extensions: ['flac'] },
    username: 'private-peer', raw_payload: { private: true }, folder_path: '/private' }] }; } };
  const store = createImportCandidateQualityReviewCandidateStore({ getPoolFn: () => assert.fail('The transaction owns this read') });
  const rows = await store.listCandidatePage({ sourceSearchId: 'search', afterId: 'cursor', queryable });
  assert.deepEqual(query.params, ['search', 'cursor', 50]); assert.match(query.sql, /ORDER BY id LIMIT \$3 FOR UPDATE/u);
  assert.doesNotMatch(query.sql, /import_candidate_files|raw_payload|folder_path|username|OFFSET/u);
  assert.deepEqual(rows, [{ id: 'candidate', status: 'held', sourceSearchId: 'search', fileCount: 2,
    totalSizeBytes: 1234, normalizedPayload: { extensions: ['flac'] } }]);
});

test('reverse keysets use the same bounded projection with a parameterized exclusive anchor', async () => {
  let query;
  const store = createImportCandidateQualityReviewCandidateStore({ getPoolFn: () => ({ query: async (sql, params) => {
    query = { sql, params }; return { rows: [] };
  } }) });
  await store.listCandidatePage({ sourceSearchId: 'search', afterId: 'anchor', direction: 'previous' });
  assert.match(query.sql, /id<\$2::uuid\) ORDER BY id DESC LIMIT \$3/u);
  assert.deepEqual(query.params, ['search', 'anchor', 50]); assert.doesNotMatch(query.sql, /FOR UPDATE|OFFSET/u);
});
