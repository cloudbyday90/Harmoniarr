import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { buildImportCandidateDownloadAdoptionPresentation } from '../../src/client/lib/import-candidate-download-adoption-presentation.js';
import { useImportCandidateDownloadAdoption } from '../../src/client/composables/useImportCandidateDownloadAdoption.js';
import { createRetryIdempotencyKeyStore } from '../../src/client/lib/retry-idempotency-key-store.js';

const transferId = '10000000-0000-4000-8000-000000000001';
function review(overrides = {}) {
  return { operationRunId: 'run', importCandidateId: 'candidate', reviewDigest: 'digest', canAdopt: true,
    requestedFileCount: 1, files: [{ label: 'Track.mp3', size: 1000, choices: [{ id: transferId, stateLabel: 'In progress' }] }], ...overrides };
}
function result(owner) { return { downloadAdoption: { outcome: 'adopted', operationRunId: owner.operationRunId, importCandidateId: owner.importCandidateId, adoptedFileCount: 1, replayed: false } }; }
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { resolve, promise }; }
function keyStore() { let count = 0; return createRetryIdempotencyKeyStore({ createIdempotencyKey: () => `key-${++count}` }); }

test('only one complete unique verified choice per saved file enables operator adoption', () => {
  assert.equal(buildImportCandidateDownloadAdoptionPresentation(review()).canAdopt, true);
  for (const change of [ { canAdopt: false }, { reviewDigest: null }, { requestedFileCount: 2 },
    { files: [{ label: 'Track', size: 0, choices: [{ id: transferId }] }] },
    { files: [{ label: 'Track', size: 1000, choices: [{ id: transferId }, { id: transferId }] }] },
    { requestedFileCount: 2, files: Array(2).fill(review().files[0]) },
    { requestedFileCount: 201, files: Array(201).fill(review().files[0]) } ]) {
    assert.equal(buildImportCandidateDownloadAdoptionPresentation(review(change)).canAdopt, false);
  }
  const excessive = Array.from({ length: 201 }, (_, index) => ({ label: `${index}.flac`, size: 1000,
    choices: [{ id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}` }] }));
  assert.equal(buildImportCandidateDownloadAdoptionPresentation(review({ requestedFileCount: 200, files: excessive })).canAdopt, false, 'extra evidence must not be silently truncated into an actionable whole set');
  assert.match(buildImportCandidateDownloadAdoptionPresentation(review({ canAdopt: false, reasonCode: 'active_download_work' })).explanation, /worker is still active/u);
  assert.match(buildImportCandidateDownloadAdoptionPresentation(review({ canAdopt: false, reasonCode: 'immutable_download_evidence_missing' })).explanation, /saved file and source evidence/u);
  assert.match(buildImportCandidateDownloadAdoptionPresentation(review({ canAdopt: false, reasonCode: 'download_episode_not_current' })).explanation, /newer download request/u);
  assert.match(buildImportCandidateDownloadAdoptionPresentation(review({ canAdopt: false, reasonCode: 'download_policy_not_current' })).explanation, /saved requirements changed/u);
});

test('preview is deduped and does not issue an adoption command', async (t) => {
  const pending = deferred(); let reads = 0; let writes = 0;
  const workflow = useImportCandidateDownloadAdoption({ operationRunId: 'run', importCandidateId: 'candidate',
    fetchReview: async () => { reads += 1; return pending.promise; }, adoptDownloads: async () => { writes += 1; } });
  t.after(workflow.destroy);
  const first = workflow.loadReview(); const second = workflow.loadReview();
  pending.resolve({ downloadAdoptionReview: review() }); await Promise.all([first, second]);
  assert.equal(reads, 1); assert.equal(writes, 0); assert.equal(workflow.review.value.reviewDigest, 'digest');
});

test('uncertain command retry preserves the exact digest, complete transfer set and durable intent key', async (t) => {
  const writes = []; let reads = 0;
  const workflow = useImportCandidateDownloadAdoption({ operationRunId: 'run', importCandidateId: 'candidate', retryKeyStore: keyStore(),
    fetchReview: async () => { reads += 1; return { downloadAdoptionReview: review() }; },
    adoptDownloads: async (owner) => { writes.push(owner); if (writes.length === 1) throw new Error('private provider path'); return result(owner); } });
  t.after(workflow.destroy);
  await workflow.loadReview(); assert.equal(await workflow.adopt(), null);
  assert.equal(workflow.hasUncertainIntent.value, true); assert.doesNotMatch(workflow.errorMessage.value, /private/u);
  await workflow.loadReview(); assert.equal(reads, 1, 'retry review reopens the saved choice');
  await workflow.adopt();
  assert.deepEqual(writes[0], writes[1]); assert.equal(writes[0].reviewDigest, 'digest'); assert.deepEqual(writes[0].transferIds, [transferId]);
  assert.equal(workflow.hasUncertainIntent.value, false); assert.equal(workflow.review.value, null);
});

test('an in-progress durable reservation retains the same reviewed choice instead of creating another intent', async (t) => {
  const writes = [];
  const workflow = useImportCandidateDownloadAdoption({ operationRunId: 'run', importCandidateId: 'candidate', retryKeyStore: keyStore(),
    fetchReview: async () => ({ downloadAdoptionReview: review() }), adoptDownloads: async (owner) => {
      writes.push(owner); if (writes.length === 1) throw Object.assign(new Error('private reservation'), { status: 409, code: 'idempotency_key_in_progress' });
      return result(owner);
    } });
  t.after(workflow.destroy); await workflow.loadReview(); await workflow.adopt();
  assert.equal(workflow.hasUncertainIntent.value, true); assert.match(workflow.errorMessage.value, /same choice again/u);
  await workflow.loadReview(); await workflow.adopt(); assert.deepEqual(writes[0], writes[1]);
});

test('a success response for another episode remains uncertain and never announces linked downloads', async (t) => {
  const workflow = useImportCandidateDownloadAdoption({ operationRunId: 'run', importCandidateId: 'candidate',
    fetchReview: async () => ({ downloadAdoptionReview: review() }), adoptDownloads: async () => result({ operationRunId: 'other', importCandidateId: 'candidate' }) });
  t.after(workflow.destroy); await workflow.loadReview(); assert.equal(await workflow.adopt(), null);
  assert.equal(workflow.hasUncertainIntent.value, true); assert.equal(workflow.statusMessage.value, '');
  assert.doesNotMatch(workflow.errorMessage.value, /other/u);
});

test('definitive stale review requires a fresh preview and a new confirmed intent', async (t) => {
  let reads = 0; const writes = [];
  const workflow = useImportCandidateDownloadAdoption({ operationRunId: 'run', importCandidateId: 'candidate', retryKeyStore: keyStore(),
    fetchReview: async () => ({ downloadAdoptionReview: review({ reviewDigest: `digest-${++reads}` }) }),
    adoptDownloads: async (owner) => { writes.push(owner); if (writes.length === 1) throw Object.assign(new Error('private SQL'), { status: 409 }); return result(owner); } });
  t.after(workflow.destroy);
  await workflow.loadReview(); await workflow.adopt();
  assert.equal(workflow.hasUncertainIntent.value, false); assert.equal(workflow.review.value, null);
  await workflow.loadReview(); await workflow.adopt();
  assert.notEqual(writes[0].idempotencyKey, writes[1].idempotencyKey); assert.notEqual(writes[0].reviewDigest, writes[1].reviewDigest);
});

test('route identity changes abort preview and keep old mutation completion out of a new pending command', async (t) => {
  const operationRunId = ref('run'); const first = deferred(); const second = deferred();
  const workflow = useImportCandidateDownloadAdoption({ operationRunId, importCandidateId: 'candidate', retryKeyStore: keyStore(),
    fetchReview: async (owner) => ({ downloadAdoptionReview: review({ operationRunId: owner.operationRunId }) }),
    adoptDownloads: (owner) => owner.operationRunId === 'run' ? first.promise : second.promise });
  t.after(workflow.destroy);
  await workflow.loadReview(); const oldCommand = workflow.adopt();
  operationRunId.value = 'newer'; await workflow.loadReview(); const newCommand = workflow.adopt();
  first.resolve(result({ operationRunId: 'run', importCandidateId: 'candidate' })); assert.equal(await oldCommand, null);
  assert.equal(workflow.isPending.value, true);
  second.resolve(result({ operationRunId: 'newer', importCandidateId: 'candidate' })); await newCommand;
  assert.equal(workflow.isPending.value, false);
});

test('preview cleanup and mismatched response scope never create actionable review data', async (t) => {
  const operationRunId = ref('run'); const pending = deferred(); let signal;
  const workflow = useImportCandidateDownloadAdoption({ operationRunId, importCandidateId: 'candidate',
    fetchReview: async (options) => { signal = options.signal; return pending.promise; } });
  t.after(workflow.destroy);
  const read = workflow.loadReview(); operationRunId.value = 'newer'; assert.equal(signal.aborted, true);
  pending.resolve({ downloadAdoptionReview: review() }); assert.equal(await read, null); assert.equal(workflow.review.value, null);
});
