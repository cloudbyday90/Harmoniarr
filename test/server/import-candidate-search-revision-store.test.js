/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateSearchRevisionStore } from '../../src/server/import-candidates/import-candidate-search-revision-store.js';
import { createQualityReviewPageService } from '../../src/server/import-candidates/import-candidate-quality-review-page-service.js';
import { createQualityReviewCursorPolicy } from '../../src/server/import-candidates/import-candidate-quality-review-cursor-policy.js';

test('revision reads retain the owning queryable and never interpolate source IDs or take write locks', async () => {
  const queryable = { query: async (sql, values) => {
    assert.match(sql, /WHERE source_search_id=\$1/u); assert.doesNotMatch(sql, /FOR UPDATE|hostile/u);
    assert.deepEqual(values, ["hostile' source"]); return { rows: [{ revision: 'revision' }] };
  } };
  const store = createImportCandidateSearchRevisionStore({ getPoolFn: () => assert.fail('Owning transaction required') });
  assert.equal(await store.readRevision({ sourceSearchId: "hostile' source", queryable }), 'revision');
  const absent = createImportCandidateSearchRevisionStore({ getPoolFn: () => ({ query: async () => ({ rows: [] }) }) });
  assert.equal(await absent.readRevision({ sourceSearchId: 'missing' }), null);
});

test('missing or changing revisions refuse even first-page exhaustion and stable continuations remain scoped', async () => {
  const scope = { failedCandidate: { id: 'failed', sourceSearchId: 'search' }, participants: [], wantedReleaseIds: [], requiredContext: {} };
  const input = { appUserId: 'owner', wantedReleaseId: 'wanted' };
  let revision = 'before'; let scans = 0; let changeDuringScan = false;
  const page = createQualityReviewPageService({ readScope: async () => scope, cursorPolicy: createQualityReviewCursorPolicy(),
    revisionStore: { readRevision: async () => revision }, scanCandidates: async () => {
      scans++; if (changeDuringScan) revision = 'after';
      return { candidates: [], exhausted: false, firstId: '00000000-0000-4000-8000-000000000001', afterId: '00000000-0000-4000-8000-000000000001' };
    } });
  const first = await page(input); assert.ok(first.matchChoicePage.nextCursor); assert.equal(first.canSearchAgain, false);
  await page({ ...input, matchCursor: first.matchChoicePage.nextCursor }); assert.equal(scans, 2);
  revision = 'committed-change';
  await assert.rejects(page({ ...input, matchCursor: first.matchChoicePage.nextCursor }), { code: 'missing_music_match_page_changed' });
  assert.equal(scans, 2, 'Reject stale continuation before querying candidate pages');
  changeDuringScan = true;
  await assert.rejects(page(input), { code: 'missing_music_match_page_changed' });
  revision = null; const before = scans;
  await assert.rejects(page(input), { code: 'missing_music_match_page_changed' }); assert.equal(scans, before);
});
