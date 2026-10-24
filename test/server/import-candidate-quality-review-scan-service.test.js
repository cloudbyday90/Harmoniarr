/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createQualityReviewScanService } from '../../src/server/import-candidates/import-candidate-quality-review-scan-service.js';

function fixture({ rows = 500, eligible = () => false } = {}) {
  const calls = []; const candidates = Array.from({ length: rows }, (_, n) => ({ id: String(n + 1).padStart(5, '0') }));
  const scan = createQualityReviewScanService({ isEligible: c => eligible(Number(c.id)), candidateStore: { listCandidatePage: async input => {
    calls.push(input); const matches = candidates.filter(c => !input.afterId || (input.direction === 'previous' ? c.id < input.afterId : c.id > input.afterId));
    return (input.direction === 'previous' ? matches.reverse() : matches).slice(0, 50);
  } } });
  return { scan: options => scan({ failedCandidate: { sourceSearchId: 'search' } }, { limit: 13, ...options }), calls };
}

test('default scans fetch and check no more than two hundred facts in four queries', async () => {
  const f = fixture(); const first = await f.scan();
  assert.equal(first.fetchedCount, 200); assert.equal(first.checkedCount, 200); assert.equal(first.pageReads, 4);
  assert.equal(first.afterId, '00200'); assert.equal(first.firstId, '00001'); assert.equal(first.exhausted, false);
  assert.deepEqual(first.candidates, []); assert.equal(f.calls.length, 4);
  const second = await f.scan({ anchor: first.afterId }); assert.equal(second.afterId, '00400'); assert.equal(second.exhausted, false);
  const third = await f.scan({ anchor: second.afterId }); assert.equal(third.fetchedCount, 100); assert.equal(third.pageReads, 3);
  assert.equal(third.exhausted, true);
});

test('an exact budget boundary needs an explicit later EOF and reverse scans make bounded progress', async () => {
  const f = fixture({ rows: 200 }); const first = await f.scan(); assert.equal(first.exhausted, false);
  const end = await f.scan({ anchor: first.afterId }); assert.equal(end.fetchedCount, 0); assert.equal(end.exhausted, true);
  const reverse = await f.scan({ anchor: '00201', direction: 'previous' });
  assert.equal(reverse.afterId, '00001'); assert.equal(reverse.fetchedCount, 200); assert.equal(reverse.exhausted, false);
  assert.equal((await f.scan({ anchor: reverse.afterId, direction: 'previous' })).exhausted, true);
});

test('eligible lookahead stops evaluations early and guarded checks explicitly retain complete traversal', async () => {
  const dense = fixture({ eligible: () => true }); const page = await dense.scan();
  assert.equal(page.fetchedCount, 50); assert.equal(page.checkedCount, 13); assert.equal(page.candidates.length, 13);
  const sparse = fixture({ eligible: n => n === 301 }); const queryable = {};
  const guarded = await sparse.scan({ limit: 1, maxRows: Infinity, queryable });
  assert.equal(guarded.candidates[0].id, '00301'); assert.equal(guarded.checkedCount, 301); assert.equal(guarded.pageReads, 7);
  assert.ok(sparse.calls.every(input => input.queryable === queryable));
  const empty = fixture({ rows: 500 }); assert.equal((await empty.scan({ limit: 1, maxRows: Infinity })).exhausted, true);
});
