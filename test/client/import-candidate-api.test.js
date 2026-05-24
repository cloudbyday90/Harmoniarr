import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allowImportCandidateFileLossyDerivative,
  bulkReviewImportCandidates,
  clearImportCandidateFileDecision,
  fetchImportCandidate,
  fetchImportCandidateApplyPreview,
  fetchImportCandidateApplyRunDetail,
  fetchImportCandidateApplySummary,
  fetchImportCandidateExecutionRunDetail,
  fetchImportCandidateExecutionSummary,
  fetchImportCandidateMediaInspectionRunDetail,
  fetchImportCandidateMediaInspectionSummary,
  fetchImportCandidatePreview,
  fetchImportCandidates,
  fetchImportPendingCandidateSummary,
  fetchSelectedImportCandidateSummary,
  holdImportCandidate,
  reconcileImportCandidateExecutionState,
  rejectImportCandidate,
  reopenImportCandidate,
  selectImportCandidate,
  skipImportCandidateFile,
  startImportCandidateApplyRun,
  startImportCandidateExecutionRun,
  startImportCandidateMediaInspectionRun,
} from '../../src/client/lib/import-candidate-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('import-candidate-api fetchImportCandidates sends query params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchImportCandidates({ status: 'downloading', limit: 10, offset: 20 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('status=downloading'));
  assert.ok(url.includes('limit=10'));
  assert.ok(url.includes('offset=20'));
});

test('import-candidate-api fetchImportCandidates omits params when none provided', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchImportCandidates();

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/import-candidates');
});

test('import-candidate-api fetchImportCandidate sends GET with encoded id', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchImportCandidate('cand/slash');

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('cand%2Fslash'));
});

test('import-candidate-api preview and apply-preview send GET with encoded id', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchImportCandidatePreview('cand-1');
  await fetchImportCandidateApplyPreview('cand-1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/import-candidates/cand-1/preview');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/import-candidates/cand-1/apply-preview');
});

test('import-candidate-api skipImportCandidateFile sends POST with reason', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await skipImportCandidateFile('cand-1', 'file-1', 'corrupt');

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('/cand-1/files/file-1/skip'));
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.reason, 'corrupt');
});

test('import-candidate-api skipImportCandidateFile omits reason when empty', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await skipImportCandidateFile('cand-1', 'file-1', '');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal('reason' in body, false);
});

test('import-candidate-api allowImportCandidateFileLossyDerivative sends POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await allowImportCandidateFileLossyDerivative('cand-1', 'file-1', 'acceptable');

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('/cand-1/files/file-1/allow-lossy-derivative'));
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
});

test('import-candidate-api clearImportCandidateFileDecision sends POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await clearImportCandidateFileDecision('cand-1', 'file-1');

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('/cand-1/files/file-1/clear-decision'));
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
});

test('import-candidate-api summary endpoints send GET', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSelectedImportCandidateSummary({ limit: 5 });
  await fetchImportPendingCandidateSummary();
  await fetchImportCandidateExecutionSummary();
  await fetchImportCandidateApplySummary();
  await fetchImportCandidateMediaInspectionSummary();

  const urls = Array.from({ length: 5 }, (_, i) => globalThis.fetch.mock.calls[i].arguments[0]);
  assert.equal(urls[0], '/api/v1/import-candidates/selected-summary?limit=5');
  assert.equal(urls[1], '/api/v1/import-candidates/import-pending-summary');
  assert.equal(urls[2], '/api/v1/import-candidates/execution-summary');
  assert.equal(urls[3], '/api/v1/import-candidates/apply-summary');
  assert.equal(urls[4], '/api/v1/import-candidates/media-inspection-summary');
});

test('import-candidate-api run detail endpoints encode runId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchImportCandidateExecutionRunDetail('run/1');
  await fetchImportCandidateApplyRunDetail('run/1');
  await fetchImportCandidateMediaInspectionRunDetail('run/1');

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('run%2F1'));
  assert.ok(globalThis.fetch.mock.calls[1].arguments[0].includes('run%2F1'));
  assert.ok(globalThis.fetch.mock.calls[2].arguments[0].includes('run%2F1'));
});

test('import-candidate-api start run endpoints send POST with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic-runs' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await startImportCandidateExecutionRun();
  await startImportCandidateApplyRun();
  await startImportCandidateMediaInspectionRun();

  assert.equal(globalThis.fetch.mock.callCount(), 3);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/import-candidates/execution-runs');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/import-candidates/apply-runs');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/import-candidates/media-inspection-runs');

  for (let i = 0; i < 3; i++) {
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].method, 'POST');
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].headers.get('X-CSRF-Token'), 'csrf-ic-runs');
  }
});

test('import-candidate-api reconcileImportCandidateExecutionState sends POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await reconcileImportCandidateExecutionState();

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/import-candidates/execution-reconcile');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
});

test('import-candidate-api transition endpoints send POST with reason', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await holdImportCandidate('cand-1', 'on hold');
  await selectImportCandidate('cand-1');
  await rejectImportCandidate('cand-1', 'duplicate');
  await reopenImportCandidate('cand-1');

  assert.equal(globalThis.fetch.mock.callCount(), 4);
  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].endsWith('/cand-1/hold'));
  assert.ok(globalThis.fetch.mock.calls[1].arguments[0].endsWith('/cand-1/select'));
  assert.ok(globalThis.fetch.mock.calls[2].arguments[0].endsWith('/cand-1/reject'));
  assert.ok(globalThis.fetch.mock.calls[3].arguments[0].endsWith('/cand-1/reopen'));

  const holdBody = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(holdBody.reason, 'on hold');

  const selectBody = JSON.parse(globalThis.fetch.mock.calls[1].arguments[1].body);
  assert.equal('reason' in selectBody, false);
});

test('import-candidate-api bulkReviewImportCandidates sends POST with body', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ic' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await bulkReviewImportCandidates({ action: 'select', importCandidateIds: ['c-1', 'c-2'], reason: 'batch' });

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/import-candidates/bulk-review');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.action, 'select');
  assert.deepEqual(body.importCandidateIds, ['c-1', 'c-2']);
  assert.equal(body.reason, 'batch');
});
