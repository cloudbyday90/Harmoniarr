import assert from 'node:assert/strict';
import test from 'node:test';
import { getExternalEmptySearchPolicy, EXTERNAL_EMPTY_SEARCH_COOLDOWN_MS } from '../../src/shared/external-empty-search-policy.js';
import { canRecoverExternalSearchRun } from '../../src/shared/external-request-search-recovery-policy.js';

const at = '2026-10-20T00:00:00.000Z';
test('empty-search policy has an inclusive six-hour boundary and a durable two-command budget', () => {
  assert.equal(getExternalEmptySearchPolicy({ now: at }), null);
  const state = { lastEmptySearchAt: at, emptySearchRecoveryCount: 0 };
  const deadline = Date.parse(at) + EXTERNAL_EMPTY_SEARCH_COOLDOWN_MS;
  assert.deepEqual(getExternalEmptySearchPolicy({ ...state, now: deadline - 1 }), {
    remainingSearches: 2, nextSearchAfter: '2026-10-20T06:00:00.000Z', blockedReason: 'cooldown',
  });
  assert.equal(getExternalEmptySearchPolicy({ ...state, now: deadline }).blockedReason, null);
  assert.equal(getExternalEmptySearchPolicy({ ...state, emptySearchRecoveryCount: 1, now: deadline }).remainingSearches, 1);
  assert.equal(getExternalEmptySearchPolicy({ ...state, emptySearchRecoveryCount: 2, now: deadline + 1 }).blockedReason, 'exhausted');
  for (const invalid of [{ now: 'invalid' }, { emptySearchRecoveryCount: -1 }, { lastEmptySearchAt: 'invalid' }]) {
    assert.throws(() => getExternalEmptySearchPolicy({ ...state, now: deadline, ...invalid }), TypeError);
  }
});

test('zero accepted candidates alone cannot authorize a new provider search', () => {
  const run = { operationType: 'library_external_request_discovery', status: 'failed',
    summary: { failureCode: 'external_request_discovery_no_candidates', candidateCount: 0 } };
  assert.equal(canRecoverExternalSearchRun(run), false);
  run.summary.searchOutcome = 'published_empty';
  assert.equal(canRecoverExternalSearchRun(run), true);
  for (const change of [{ candidateCount: 1 }, { candidateCount: '0' }, { externalSearchSuperseded: true }]) {
    assert.equal(canRecoverExternalSearchRun({ ...run, summary: { ...run.summary, ...change } }), false);
  }
  assert.equal(canRecoverExternalSearchRun({ ...run, status: 'cancelled' }), false);
});
