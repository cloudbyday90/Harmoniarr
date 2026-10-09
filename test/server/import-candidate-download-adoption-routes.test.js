import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApiError, requireAdminSession, requireFreshSession } from '../../src/server/auth.js';
import { createRequestAuthDependencies } from '../../src/server/auth-module.js';
import { createControlPlaneIdempotencyService } from '../../src/server/recovery/control-plane-idempotency-service.js';
import { registerImportCandidateDownloadAdoptionRoutes } from '../../src/server/routes/import-candidate-download-adoption-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function appFixture(overrides = {}) {
  const session = { appUserId: randomUUID(), refreshTokenId: randomUUID(), csrfToken: 'csrf-test', user: { role: 'admin', mustChangePassword: false } };
  const auth = createRequestAuthDependencies({ requireSession: async () => session,
    requireAdminSession: (request) => requireAdminSession(request, async () => session),
    requireFreshAdminSession: (request) => requireAdminSession(request, (freshRequest) => requireFreshSession(freshRequest, async () => session)),
    requireCsrf: (request) => { if (request.headers['x-csrf-token'] !== session.csrfToken) throw createApiError(403, 'csrf_invalid', 'Invalid CSRF token'); },
    getRequestMetadata: () => ({ ipAddress: '127.0.0.1' }) });
  const recordByKey = new Map();
  const commands = createControlPlaneIdempotencyService({
    getRecordByScopeActorAndKey: async ({ idempotencyKey }) => recordByKey.get(idempotencyKey) ?? null,
    createInProgressRecord: async (record) => { const saved = { ...record, id: randomUUID(), state: 'in_progress' }; recordByKey.set(record.idempotencyKey, saved); return saved; },
    completeRecord: async ({ id, response, statusCode, expiresAt }) => { const record = [...recordByKey.values()].find((x) => x.id === id);
      Object.assign(record, { response, statusCode, expiresAt, state: 'completed' }); return record; },
    deleteInProgressRecordById: async ({ id }) => { for (const [key, record] of recordByKey) if (record.id === id) recordByKey.delete(key); },
    deleteExpiredRecordById: async () => {},
  });
  const calls = [];
  const app = createJsonTestApp((http) => registerImportCandidateDownloadAdoptionRoutes(http, { ...auth,
    executeIdempotentMutation: commands.executeIdempotentMutation,
    getDownloadAdoptionReview: async (context) => { calls.push({ kind: 'read', context }); return { downloadAdoptionReview: { canAdopt: false, reasonCode: 'active_download_work' } }; },
    adoptExistingDownloads: async (context) => { calls.push({ kind: 'adopt', context }); return { downloadAdoption: { outcome: 'adopted', adoptedFileCount: 1, replayed: false } }; },
    ...overrides,
  }));
  return { app, session, calls };
}
const path = '/api/v1/import-candidates/execution-runs/00000000-0000-4000-8000-000000000001/items/00000000-0000-4000-8000-000000000002';
const command = () => ({ reviewDigest: 'a'.repeat(64), transferIds: [randomUUID()] });
const headers = { 'content-type': 'application/json', 'x-csrf-token': 'csrf-test', 'idempotency-key': 'same-intent' };

test('review requires administrator access and forwards only server-derived session and path identity', async () => {
  const f = appFixture();
  await withServer(f.app, async (base) => {
    const response = await fetch(`${base}${path}/download-adoption-review?actorUserId=forged`);
    assert.equal(response.status, 200);
    assert.equal(f.calls[0].context.actorUserId, f.session.appUserId);
    assert.equal(f.calls[0].context.refreshTokenId, f.session.refreshTokenId);
    f.session.user.role = 'member';
    const denied = await fetch(`${base}${path}/download-adoption-review`);
    assert.equal(denied.status, 403); assert.equal(f.calls.length, 1);
  });
});

test('adoption requires fresh admin, CSRF, an intent key and the exact digest/ID envelope before service mutation', async () => {
  const f = appFixture();
  await withServer(f.app, async (base) => {
    for (const [requestHeaders, body] of [[{ ...headers, 'x-csrf-token': 'wrong' }, command()],
      [{ ...headers, 'idempotency-key': '' }, command()], [headers, { ...command(), actorUserId: randomUUID() }],
      [headers, { ...command(), requestedFiles: [] }], [headers, { ...command(), transferIds: ['opaque-id'] }]]) {
      const denied = await fetch(`${base}${path}/download-adoption`, { method: 'POST', headers: requestHeaders, body: JSON.stringify(body) });
      assert.ok([400, 403].includes(denied.status));
    }
    f.session.user.mustChangePassword = true;
    const stale = await fetch(`${base}${path}/download-adoption`, { method: 'POST', headers, body: JSON.stringify(command()) });
    assert.equal(stale.status, 403); assert.equal(f.calls.length, 0);
  });
});

test('durable route replay reuses the command result and different payload with the same key refuses', async () => {
  const f = appFixture(); const body = command();
  await withServer(f.app, async (base) => {
    const send = (value) => fetch(`${base}${path}/download-adoption`, { method: 'POST', headers, body: JSON.stringify(value) });
    assert.equal((await send(body)).status, 200);
    const replay = await send(body); assert.equal(replay.status, 200);
    assert.equal((await replay.json()).downloadAdoption.replayed, true); assert.equal(f.calls.length, 1);
    const mismatch = await send(command()); assert.equal(mismatch.status, 409);
    assert.equal((await mismatch.json()).error.code, 'idempotency_key_payload_mismatch');
    assert.equal(f.calls.length, 1);
  });
});

test('provider failures stay bounded and rate limits refuse before provider or mutation service work', async () => {
  const failure = appFixture({ getDownloadAdoptionReview: async () => { throw Object.assign(new Error('private peer/path response'), { code: 'slskd_request_failed' }); } });
  await withServer(failure.app, async (base) => {
    const response = await fetch(`${base}${path}/download-adoption-review`);
    assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /private|peer\/path/u);
  });
  const limit = (_request, _response, next) => next(createApiError(429, 'rate_limited', 'Try again later'));
  const limited = appFixture({ limitDownloadAdoptionReview: limit, limitDownloadAdoptionMutation: limit });
  await withServer(limited.app, async (base) => {
    assert.equal((await fetch(`${base}${path}/download-adoption-review`)).status, 429);
    assert.equal((await fetch(`${base}${path}/download-adoption`, { method: 'POST', headers, body: JSON.stringify(command()) })).status, 429);
    assert.equal(limited.calls.length, 0);
  });
});
