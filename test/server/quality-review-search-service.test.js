/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceQualityReviewSearchProgress, assertQualityReviewSearchProgress } from '../../src/server/import-candidates/quality-review-search-policy.js';
import { createQualityReviewSearchService } from '../../src/server/import-candidates/quality-review-search-service.js';
import { createQualityReviewSearchWorker } from '../../src/server/import-candidates/quality-review-search-worker.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const context = 'a'.repeat(64);
test('progress retains one anchor/deadline, separates exact EOF and bounds invalidations, steps and malformed state', () => {
  const input = { context, revision: id(1), now: 1000, failedCandidateId: id(2), scan: { candidates: [], exhausted: false, afterId: id(3) } };
  const first = advanceQualityReviewSearchProgress(input); assertQualityReviewSearchProgress(first, 1001);
  assert.equal(first.state, 'incomplete'); assert.equal(first.steps, 1);
  const end = advanceQualityReviewSearchProgress({ ...input, progress: first, now: 2000, scan: { candidates: [], exhausted: true, afterId: id(3) } });
  assert.equal(end.state, 'exhausted'); assert.equal(end.expiresAt, first.expiresAt);
  const reset = advanceQualityReviewSearchProgress({ ...input, progress: first, context: 'b'.repeat(64) }); assert.equal(reset.invalidations, 1);
  assert.throws(() => advanceQualityReviewSearchProgress({ ...input, progress: { ...first, invalidations: 3 }, context: 'b'.repeat(64) }));
  for (const patch of [{ steps: 500 }, { steps: '1' }, { expiresAt: 1000 }, { revision: 'invalid' }, { context: 'bad' }, { anchor: 'bad' }, { state: 'exhausted' }]) {
    assert.throws(() => assertQualityReviewSearchProgress({ ...first, ...patch }, 1000), { code: 'quality_review_search_expired' });
  }
});

function fixture({ exhausted = false, found = false } = {}) {
  const calls = []; const queryable = {}; let saved; let revision = id(1); let scanExhausted = exhausted; let alternative = found;
  const scope = { failedCandidate: { id: id(2), sourceSearchId: 'search' }, release: { metadataReleaseId: id(4) },
    participants: [], wantedReleaseIds: [id(5)], requiredContext: {} };
  const runStore = { now: async () => 1000, findActive: async () => null, canAdmit: async () => true,
    createOperationRun: async input => { calls.push('create'); saved = input.summary; },
    getRunById: async () => ({ status: 'pending', summary: saved, triggeredByUserId: id(6) }),
    withOwnedRun: async (input, execute) => { assert.equal(input.queryable, queryable); return execute({ run: { status: 'running', summary: saved, triggered_by_user_id: id(6) } }); },
    writeLifecycle: async input => { calls.push(input.action); saved = { ...saved, ...input.summary }; return true; } };
  const service = createQualityReviewSearchService({
    scopeService: { withCurrentQualificationScope: async (_input, execute) => execute({ scope, queryable }),
      scanAlternativeWindow: async (_scope, input) => { calls.push(['scan', input.anchor]); return { candidates: alternative ? [{}] : [], exhausted: scanExhausted, afterId: id(3) }; } },
    revisionStore: { readRevision: async () => revision, lockRevisionNowait: async () => { calls.push('fence'); return revision; } },
    runStore, commitIntent: async () => { calls.push('intent'); return { queued: true }; },
    recordCheckRequested: async () => { calls.push('audit-check'); },
    onSearchQueued: async () => { throw new Error('Dispatch deferred after committed intent'); }, onDispatchError: () => { calls.push('deferred'); },
  });
  const request = () => service.request({ appUserId: id(7), metadataReleaseId: id(4), requestMetadata: {},
    intent: { wantedReleaseId: id(5), requestedByUserId: id(6) } });
  return { service, calls, request, runStore, saved: () => saved, mutate: () => { revision = id(8); }, eof: () => { scanExhausted = true; }, found: () => { alternative = true; } };
}
test('small EOF publishes only after its fence; found alternatives refuse without intent or job', async () => {
  const empty = fixture({ exhausted: true }); assert.deepEqual(await empty.request(), { queued: true });
  assert.deepEqual(empty.calls, [['scan', null], 'fence', 'intent']);
  const found = fixture({ found: true }); await assert.rejects(found.request(), { code: 'music_queue_retry_not_available' });
  assert.ok(!found.calls.includes('create')); assert.ok(!found.calls.includes('intent'));
});
test('incomplete checks persist bounded progress, restart at the beginning after revision drift and atomically consume EOF', async () => {
  const f = fixture(); assert.deepEqual(await f.request(), { checkingMatches: true });
  assert.equal(f.saved().progress.state, 'incomplete'); assert.ok(f.calls.includes('audit-check'));
  f.mutate(); await f.service.executeStep({ runId: id(9), expectedLease: {} });
  assert.deepEqual(f.calls.filter(Array.isArray), [['scan', null], ['scan', null]]);
  assert.equal(f.saved().progress.invalidations, 1); assert.ok(f.calls.includes('paused'));
  f.eof(); await f.service.executeStep({ runId: id(9), expectedLease: {} });
  assert.equal(f.saved().progress.state, 'consumed');
  assert.deepEqual(f.calls.slice(-3), ['intent', 'completed', 'deferred']);
  const lost = fixture(); await lost.request(); lost.runStore.withOwnedRun = async () => false;
  await assert.rejects(lost.service.executeStep({ runId: id(9), expectedLease: {} }), { code: 'operation_run_lease_lost' });
  assert.ok(!lost.calls.includes('intent'));
});
test('a busy worker step yields with captured ownership and drains the heartbeat before lease release', async () => {
  const events = []; const lease = { acquisitionId: id(1) };
  const worker = createQualityReviewSearchWorker({ runStore: { acquireLease: async () => lease, renewLease: async () => {},
    markRunStarted: async () => true, markRunPaused: async input => { assert.equal(input.expectedLease, lease); events.push('paused'); },
    releaseLease: async input => { assert.equal(input.expectedLease, lease); events.push('released'); } },
    createHeartbeat: () => ({ start() {}, stopAndDrain: async () => { events.push('drained'); } }),
    executeStep: async () => { throw Object.assign(new Error('Busy'), { code: 'quality_review_search_busy' }); } });
  const accepted = await worker.startWorkerRun({ runId: id(2) }); await accepted.completion; await worker.close();
  assert.deepEqual(events, ['paused', 'drained', 'released']);
});
