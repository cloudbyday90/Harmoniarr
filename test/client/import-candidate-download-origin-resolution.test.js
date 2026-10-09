import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { buildImportCandidateDownloadOriginPresentation } from '../../src/client/lib/import-candidate-download-origin-presentation.js';
import { useImportCandidateDownloadOriginResolution } from '../../src/client/composables/useImportCandidateDownloadOriginResolution.js';
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';

function review(overrides = {}) { return { operationRunId: 'earlier', importCandidateId: 'candidate', canRestore: true, reasonCode: null,
  reviewDigest: 'digest', verifiedFileCount: 10, retiredRequestCount: 1, ...overrides }; }
function result(owner, overrides = {}) { return { downloadOriginResolution: { outcome: 'restored', operationRunId: owner.operationRunId,
  importCandidateId: owner.importCandidateId, verifiedFileCount: 10, retiredRequestCount: 1, replayed: false, ...overrides } }; }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { resolve, promise }; }
function keyStore() { let count = 0; return createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `key-${++count}` }); }

test('only exact server permission with bounded whole-file proof and one unused newer request enables resolution', () => {
  assert.equal(buildImportCandidateDownloadOriginPresentation(review()).canRestore, true);
  for (const value of [false, 'true', undefined]) assert.equal(buildImportCandidateDownloadOriginPresentation(review({ canRestore: value })).canRestore, false);
  for (const verifiedFileCount of [-1, 0, 1.5, 201, Infinity, '10']) assert.equal(buildImportCandidateDownloadOriginPresentation(review({ verifiedFileCount })).canRestore, false);
  for (const retiredRequestCount of [-1, 0, 2, '1']) assert.equal(buildImportCandidateDownloadOriginPresentation(review({ retiredRequestCount })).canRestore, false);
  assert.equal(buildImportCandidateDownloadOriginPresentation(review({ reviewDigest: null })).canRestore, false);
  assert.equal(buildImportCandidateDownloadOriginPresentation(review({ verifiedFileCount: 200 })).canRestore, true);
});

test('review is a deduped read and no command occurs without explicit confirmation', async (t) => {
  const pending = deferred(); let reads = 0; let writes = 0;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: 'earlier', importCandidateId: 'candidate',
    fetchReview: async () => { reads += 1; return pending.promise; }, resolveOrigin: async () => { writes += 1; } });
  t.after(workflow.destroy); const first = workflow.loadReview(); const second = workflow.loadReview();
  pending.resolve({ downloadOriginReview: review() }); await Promise.all([first, second]); assert.equal(reads, 1); assert.equal(writes, 0);
});

test('uncertain resolution retains original digest, displayed counts and command key when reopening its review', async (t) => {
  const writes = []; let reads = 0;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: 'earlier', importCandidateId: 'candidate', retryKeyStore: keyStore(),
    fetchReview: async () => { reads += 1; return { downloadOriginReview: review() }; }, resolveOrigin: async (owner) => {
      writes.push(owner); if (writes.length === 1) throw new Error('private provider binding'); return result(owner, { replayed: true });
    } });
  t.after(workflow.destroy); await workflow.loadReview(); assert.equal(await workflow.restore(), null); assert.equal(workflow.hasUncertainIntent.value, true);
  assert.doesNotMatch(workflow.errorMessage.value, /private|provider binding/u); await workflow.loadReview(); assert.equal(reads, 1);
  assert.equal(workflow.review.value.verifiedFileCount, 10); await workflow.restore(); assert.deepEqual(writes[0], writes[1]);
  assert.deepEqual(Object.keys(writes[0]).sort(), ['idempotencyKey', 'importCandidateId', 'operationRunId', 'reviewDigest']);
  assert.match(workflow.statusMessage.value, /already stopped by this saved choice/u);
});

test('in-progress reservation and server errors keep one intent while definite stale rejection requires fresh review', async (t) => {
  let failure = Object.assign(new Error('private'), { status: 409, code: 'idempotency_key_in_progress' }); const writes = []; let reads = 0;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: 'earlier', importCandidateId: 'candidate', retryKeyStore: keyStore(),
    fetchReview: async () => ({ downloadOriginReview: review({ reviewDigest: `digest-${++reads}` }) }), resolveOrigin: async (owner) => {
      writes.push(owner); if (failure) throw failure; return result(owner);
    } });
  t.after(workflow.destroy); await workflow.loadReview(); await workflow.restore(); assert.equal(workflow.hasUncertainIntent.value, true);
  failure = Object.assign(new Error('private'), { status: 503 }); await workflow.restore(); assert.equal(workflow.hasUncertainIntent.value, true);
  assert.equal(writes[0].idempotencyKey, writes[1].idempotencyKey);
  failure = Object.assign(new Error('private'), { status: 409 }); await workflow.restore(); assert.equal(workflow.hasUncertainIntent.value, false); assert.equal(workflow.review.value, null);
  failure = null; await workflow.loadReview(); await workflow.restore(); assert.notEqual(writes[0].idempotencyKey, writes[3].idempotencyKey);
  assert.notEqual(writes[0].reviewDigest, writes[3].reviewDigest);
});

test('competing confirmation is single-flight and a mismatched success never announces restored ownership', async (t) => {
  const pending = deferred(); let writes = 0;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: 'earlier', importCandidateId: 'candidate',
    fetchReview: async () => ({ downloadOriginReview: review() }), resolveOrigin: async () => { writes += 1; return pending.promise; } });
  t.after(workflow.destroy); await workflow.loadReview(); const first = workflow.restore(); assert.equal(await workflow.restore(), null);
  pending.resolve(result({ operationRunId: 'unrelated', importCandidateId: 'candidate' })); assert.equal(await first, null);
  assert.equal(writes, 1); assert.equal(workflow.hasUncertainIntent.value, true); assert.equal(workflow.statusMessage.value, '');
});

test('route changes keep a prior episode completion out of the next episode command', async (t) => {
  const operationRunId = ref('earlier'); const first = deferred(); const second = deferred();
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId, importCandidateId: 'candidate',
    fetchReview: async (owner) => ({ downloadOriginReview: review({ operationRunId: owner.operationRunId }) }),
    resolveOrigin: (owner) => owner.operationRunId === 'earlier' ? first.promise : second.promise });
  t.after(workflow.destroy); await workflow.loadReview(); const previous = workflow.restore(); operationRunId.value = 'next'; await workflow.loadReview(); const current = workflow.restore();
  first.resolve(result({ operationRunId: 'earlier', importCandidateId: 'candidate' })); assert.equal(await previous, null); assert.equal(workflow.isPending.value, true);
  second.resolve(result({ operationRunId: 'next', importCandidateId: 'candidate' })); await current; assert.equal(workflow.isPending.value, false);
});

test('a refused review cannot issue a command and read failures expose fixed feedback', async (t) => {
  let unavailable = false; let writes = 0;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: 'earlier', importCandidateId: 'candidate',
    fetchReview: async () => { if (unavailable) throw Object.assign(new Error('private /mnt/source provider response'), { status: 503 });
      return { downloadOriginReview: review({ canRestore: false, reasonCode: 'unknown_private_reason' }) }; }, resolveOrigin: async () => { writes += 1; } });
  t.after(workflow.destroy); await workflow.loadReview(); assert.equal(await workflow.restore(), null); assert.equal(writes, 0);
  unavailable = true; await workflow.loadReview(); assert.equal(workflow.review.value, null); assert.match(workflow.errorMessage.value, /could not be checked/u);
  assert.doesNotMatch(workflow.errorMessage.value, /private|mnt|provider response/u);
});

test('a changed review target aborts its pending read and ignores returned evidence for the old episode', async (t) => {
  const operationRunId = ref('earlier'); const pending = deferred(); let signal;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId, importCandidateId: 'candidate',
    fetchReview: async (owner) => { signal = owner.signal; return pending.promise; } });
  t.after(workflow.destroy); const read = workflow.loadReview(); operationRunId.value = 'next'; assert.equal(signal.aborted, true);
  pending.resolve({ downloadOriginReview: review() }); assert.equal(await read, null); assert.equal(workflow.review.value, null);
});

test('disposal aborts an outstanding read and late read data never becomes actionable', async () => {
  const pending = deferred(); let signal;
  const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: 'earlier', importCandidateId: 'candidate',
    fetchReview: async (owner) => { signal = owner.signal; return pending.promise; } });
  const read = workflow.loadReview(); workflow.destroy(); assert.equal(signal.aborted, true); pending.resolve({ downloadOriginReview: review() });
  assert.equal(await read, null); assert.equal(workflow.review.value, null);
});
