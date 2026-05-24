import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchOperationHistory,
  fetchOperationRunDetail,
  requestOperationRunCancellation,
  requestOperationRunRetry,
  triggerArtworkCleanup,
  triggerImportApply,
  triggerImportExecution,
  triggerImportMediaInspection,
  triggerImportTranscode,
  triggerLibraryDiscovery,
  triggerLibraryOrganize,
  triggerLibraryScan,
  triggerNotificationFanout,
} from '../../src/client/lib/operations-api.js';

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

test('operations-api fetchOperationHistory sends GET without params when no limit', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchOperationHistory();

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/operations/history');
});

test('operations-api fetchOperationHistory sends limit query param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchOperationHistory({ limit: 20 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('limit=20'));
});

test('operations-api fetchOperationRunDetail sends GET with encoded runId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchOperationRunDetail('run/1');

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('run%2F1'));
});

test('operations-api fetchOperationRunDetail sends auditLimit query param', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchOperationRunDetail('run-1', { auditLimit: 50 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('auditLimit=50'));
});

test('operations-api requestOperationRunCancellation sends POST with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ops' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await requestOperationRunCancellation('run-1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/operations/runs/run-1/cancel');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].headers.get('X-CSRF-Token'), 'csrf-ops');
});

test('operations-api requestOperationRunRetry sends POST with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-ops' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await requestOperationRunRetry('run-1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/operations/runs/run-1/retry');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
});

test('operations-api trigger functions send POST with CSRF to correct endpoints', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-trigger' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await triggerArtworkCleanup();
  await triggerImportApply();
  await triggerImportExecution();
  await triggerImportMediaInspection();
  await triggerImportTranscode();
  await triggerLibraryDiscovery();
  await triggerLibraryOrganize();
  await triggerLibraryScan();
  await triggerNotificationFanout();

  assert.equal(globalThis.fetch.mock.callCount(), 9);

  const urls = Array.from({ length: 9 }, (_, i) => globalThis.fetch.mock.calls[i].arguments[0]);
  assert.equal(urls[0], '/api/v1/artwork/cleanup-runs');
  assert.equal(urls[1], '/api/v1/import-candidates/apply-runs');
  assert.equal(urls[2], '/api/v1/import-candidates/execution-runs');
  assert.equal(urls[3], '/api/v1/import-candidates/media-inspection-runs');
  assert.equal(urls[4], '/api/v1/import-candidates/transcode-runs');
  assert.equal(urls[5], '/api/v1/library/discovery-runs');
  assert.equal(urls[6], '/api/v1/library/organize-runs');
  assert.equal(urls[7], '/api/v1/library/scan-runs');
  assert.equal(urls[8], '/api/v1/system/operator-notification-fanout-runs');

  for (let i = 0; i < 9; i++) {
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].method, 'POST');
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].headers.get('X-CSRF-Token'), 'csrf-trigger');
  }
});
