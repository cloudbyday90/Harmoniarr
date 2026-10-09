import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createApiError, createRequireCsrf, csrfProtectionModes, requireAdminSession,
  requireFreshAdminSession, requireFreshSession } from '../../src/server/auth.js';
import { hashToken } from '../../src/server/security.js';
import { createControlPlaneIdempotencyService } from '../../src/server/recovery/control-plane-idempotency-service.js';
import { createRequestRateLimiterService } from '../../src/server/request-rate-limiter.js';
import { registerImportCandidateDownloadOriginRoutes } from '../../src/server/routes/import-candidate-download-origin-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

const operationRunId = '00000000-0000-4000-8000-000000000001';
const importCandidateId = '00000000-0000-4000-8000-000000000002';
const prefix = `/api/v1/import-candidates/execution-runs/${operationRunId}/items/${importCandidateId}`;
const digest = 'a'.repeat(64);
const headers = { 'content-type': 'application/json', 'x-csrf-token': 'origin-csrf', 'idempotency-key': 'origin-intent' };

function outcome() {
  return { downloadOriginResolution: { outcome: 'restored', operationRunId, importCandidateId,
    verifiedFileCount: 2, retiredRequestCount: 1, replayed: false } };
}

function fixture(overrides = {}) {
  const state = { session: { appUserId: randomUUID(), refreshTokenId: randomUUID(), csrfToken: 'origin-csrf',
    csrfTokenHash: hashToken('origin-csrf'), user: { role: 'admin', mustChangePassword: false } } };
  const calls = { reads: [], resolutions: [], commandPayloads: [] };
  const records = new Map();
  const scopeKey = ({ actorUserId, operationScope, idempotencyKey }) => JSON.stringify([actorUserId, operationScope, idempotencyKey]);
  const commandOwner = createControlPlaneIdempotencyService({
    getRecordByScopeActorAndKey: async (input) => records.get(scopeKey(input)) ?? null,
    createInProgressRecord: async (record) => {
      const key = scopeKey(record);
      if (records.has(key)) return null;
      const saved = { ...record, id: randomUUID(), state: 'in_progress' };
      records.set(key, saved); return saved;
    },
    completeRecord: async ({ id, response, statusCode, expiresAt }) => {
      const saved = [...records.values()].find((record) => record.id === id);
      Object.assign(saved, { response, statusCode, expiresAt, state: 'completed' }); return saved;
    },
    deleteInProgressRecordById: async ({ id }) => { for (const [key, record] of records) if (record.id === id) records.delete(key); },
    deleteExpiredRecordById: async ({ id }) => { for (const [key, record] of records) if (record.id === id) records.delete(key); },
  });
  const lookupSession = async () => {
    if (!state.session) throw createApiError(401, 'auth_required', 'Authentication is required');
    return state.session;
  };
  const app = createJsonTestApp((http) => registerImportCandidateDownloadOriginRoutes(http, {
    requireAdminSession: (request) => requireAdminSession(request, lookupSession),
    requireFreshAdminSession: (request) => requireFreshAdminSession(request, requireAdminSession,
      (freshRequest) => requireFreshSession(freshRequest, lookupSession)),
    requireCsrf: createRequireCsrf({ mode: csrfProtectionModes.required }),
    executeIdempotentMutation: async (input) => { calls.commandPayloads.push({ actorUserId: input.actorUserId,
      operationScope: input.operationScope, requestPayload: input.requestPayload }); return commandOwner.executeIdempotentMutation(input); },
    getDownloadOriginReview: async (input) => {
      calls.reads.push(input);
      return { downloadOriginReview: { operationRunId, importCandidateId, canRestore: true, reasonCode: null,
        reviewDigest: digest, verifiedFileCount: 2, retiredRequestCount: 1 } };
    },
    resolveDownloadOrigin: async (input) => { calls.resolutions.push(input); return outcome(); },
    ...overrides,
  }));
  return { app, state, calls, records };
}

function post(base, body = { reviewDigest: digest }, requestHeaders = headers) {
  return fetch(`${base}${prefix}/download-origin-resolution`, { method: 'POST', headers: requestHeaders, body: JSON.stringify(body) });
}

test('origin review requires admin and remains read-only while ignoring caller-forged actor and newer-run context', async () => {
  const f = fixture();
  await withServer(f.app, async (base) => {
    const response = await fetch(`${base}${prefix}/download-origin-review?actorUserId=forged&newerRunId=forged`, { headers: { 'idempotency-key': 'irrelevant-read-key' } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).downloadOriginReview, { operationRunId, importCandidateId, canRestore: true,
      reasonCode: null, reviewDigest: digest, verifiedFileCount: 2, retiredRequestCount: 1 });
    assert.deepEqual(f.calls.reads[0], { operationRunId, importCandidateId, actorUserId: f.state.session.appUserId,
      refreshTokenId: f.state.session.refreshTokenId });
    assert.equal(f.calls.resolutions.length, 0); assert.equal(f.calls.commandPayloads.length, 0); assert.equal(f.records.size, 0);
    f.state.session.user.role = 'requester';
    const forbidden = await fetch(`${base}${prefix}/download-origin-review`);
    assert.equal(forbidden.status, 403); assert.equal((await forbidden.json()).error.code, 'admin_required');
    f.state.session = null;
    const anonymous = await fetch(`${base}${prefix}/download-origin-review`);
    assert.equal(anonymous.status, 401); assert.equal(f.calls.reads.length, 1);
  });
});

test('resolution runs real admin and fresh-session guards before accepting a command', async () => {
  const f = fixture();
  await withServer(f.app, async (base) => {
    f.state.session.user.role = 'requester';
    const role = await post(base); assert.equal(role.status, 403); assert.equal((await role.json()).error.code, 'admin_required');
    f.state.session.user.role = 'admin'; f.state.session.user.mustChangePassword = true;
    const fresh = await post(base); assert.equal(fresh.status, 403); assert.equal((await fresh.json()).error.code, 'reauth_required');
    f.state.session = null;
    assert.equal((await post(base)).status, 401);
    assert.equal(f.calls.resolutions.length, 0); assert.equal(f.calls.commandPayloads.length, 0);
  });
});

test('resolution uses the real required CSRF guard including the session-bound token hash', async () => {
  const f = fixture();
  await withServer(f.app, async (base) => {
    const missing = { ...headers }; delete missing['x-csrf-token'];
    const absent = await post(base, { reviewDigest: digest }, missing);
    assert.equal(absent.status, 403); assert.equal((await absent.json()).error.code, 'csrf_required');
    const wrong = await post(base, { reviewDigest: digest }, { ...headers, 'x-csrf-token': 'other' });
    assert.equal(wrong.status, 403); assert.equal((await wrong.json()).error.code, 'csrf_invalid');
    f.state.session.csrfTokenHash = hashToken('different-server-token');
    const mismatchedHash = await post(base);
    assert.equal(mismatchedHash.status, 403); assert.equal((await mismatchedHash.json()).error.code, 'csrf_invalid');
    assert.equal(f.calls.resolutions.length, 0); assert.equal(f.records.size, 0);
  });
});

test('only reviewDigest is accepted and caller-forged R2, source, policy and transfer fields never reach the service', async () => {
  const f = fixture();
  await withServer(f.app, async (base) => {
    for (const extra of ['newerRunId', 'sourceRunId', 'sourceAttemptId', 'currentOriginId', 'actorUserId',
      'requestedFiles', 'sourceObservation', 'providerBinding', 'qualityContext', 'transferIds', 'retiredRequestCount']) {
      const response = await post(base, { reviewDigest: digest, [extra]: randomUUID() });
      assert.equal(response.status, 400, extra); assert.equal((await response.json()).error.code, 'validation_error', extra);
    }
    for (const body of [{}, [], { reviewDigest: 'too-short' }, { reviewDigest: 42 }]) {
      const response = await post(base, body); assert.equal(response.status, 400);
    }
    assert.equal(f.calls.resolutions.length, 0); assert.equal(f.calls.commandPayloads.length, 0); assert.equal(f.records.size, 0);
  });
});

test('resolution requires a bounded intent key before mutation and supports normalized same-key digest replay', async () => {
  const f = fixture();
  await withServer(f.app, async (base) => {
    const missing = { ...headers }; delete missing['idempotency-key'];
    for (const requestHeaders of [missing, { ...headers, 'idempotency-key': '   ' }]) {
      const response = await post(base, { reviewDigest: digest }, requestHeaders);
      assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'idempotency_key_required');
    }
    const tooLong = await post(base, { reviewDigest: digest }, { ...headers, 'idempotency-key': 'x'.repeat(256) });
    assert.equal(tooLong.status, 400); assert.equal((await tooLong.json()).error.code, 'idempotency_key_invalid');
    assert.equal(f.calls.resolutions.length, 0);
    const first = await post(base, { reviewDigest: digest.toUpperCase() }, { ...headers, 'idempotency-key': ' origin-intent ' });
    assert.equal(first.status, 200); assert.equal((await first.json()).downloadOriginResolution.replayed, false);
    assert.deepEqual(f.calls.resolutions[0].command, { reviewDigest: digest });
    assert.deepEqual(f.calls.commandPayloads.at(-1), { actorUserId: f.state.session.appUserId,
      operationScope: 'import-candidates.download-origin-resolution', requestPayload: { operationRunId, importCandidateId, reviewDigest: digest } });
    const replay = await post(base);
    assert.equal(replay.status, 200); assert.equal((await replay.json()).downloadOriginResolution.replayed, true);
    assert.equal(f.calls.resolutions.length, 1); assert.equal(f.records.size, 1);
    const changed = await post(base, { reviewDigest: 'b'.repeat(64) });
    assert.equal(changed.status, 409); assert.equal((await changed.json()).error.code, 'idempotency_key_payload_mismatch');
    assert.equal(f.calls.resolutions.length, 1);
  });
});

test('cached resolution is reauthorized and intent records are scoped to the actual authenticated actor', async () => {
  const f = fixture();
  await withServer(f.app, async (base) => {
    assert.equal((await post(base)).status, 200);
    f.state.session.user.role = 'requester';
    assert.equal((await post(base)).status, 403);
    assert.equal(f.calls.resolutions.length, 1);
    f.state.session.user.role = 'admin'; f.state.session.user.mustChangePassword = true;
    assert.equal((await post(base)).status, 403);
    f.state.session.user.mustChangePassword = false;
    f.state.session.appUserId = randomUUID(); f.state.session.refreshTokenId = randomUUID();
    const otherActor = await post(base);
    assert.equal(otherActor.status, 200); assert.equal((await otherActor.json()).downloadOriginResolution.replayed, false);
    assert.equal(f.calls.resolutions.length, 2); assert.equal(f.records.size, 2);
    assert.notEqual(f.calls.resolutions[0].actorUserId, f.calls.resolutions[1].actorUserId);
  });
});

test('an in-progress same-intent retry never starts a second resolution service call', async () => {
  let notifyStarted; let release;
  const started = new Promise((resolve) => { notifyStarted = resolve; });
  const pending = new Promise((resolve) => { release = resolve; });
  let serviceCalls = 0;
  const f = fixture({ resolveDownloadOrigin: async () => { serviceCalls += 1; notifyStarted(); await pending; return outcome(); } });
  await withServer(f.app, async (base) => {
    const first = post(base);
    await started;
    try {
      const retry = await post(base);
      assert.equal(retry.status, 409); assert.equal((await retry.json()).error.code, 'idempotency_key_in_progress');
      assert.equal(serviceCalls, 1);
    } finally { release(); }
    assert.equal((await first).status, 200);
    const completed = await post(base);
    assert.equal(completed.status, 200); assert.equal((await completed.json()).downloadOriginResolution.replayed, true);
    assert.equal(serviceCalls, 1);
  });
});

test('provider errors from read and mutation become bounded 503 responses without private provider details', async () => {
  for (const code of ['slskd_unauthorized', 'slskd_request_failed', 'slskd_unavailable']) {
    const fail = async () => { throw Object.assign(new Error('private peer C:\\downloads\\track key=provider-secret'), { code }); };
    const f = fixture({ getDownloadOriginReview: fail, resolveDownloadOrigin: fail });
    await withServer(f.app, async (base) => {
      for (const response of [await fetch(`${base}${prefix}/download-origin-review`), await post(base)]) {
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.deepEqual(body.error, { code: 'download_origin_provider_unavailable', message: 'Downloader evidence is unavailable. Try the review again.' });
        assert.doesNotMatch(JSON.stringify(body), /private|downloads|provider-secret|peer/u);
      }
      assert.equal(f.records.size, 0, 'A refused service call releases the incomplete command reservation');
    });
  }
});

test('actual read and mutation rate-limit middleware refuses before service work and supplies retry headers', async () => {
  const limiter = createRequestRateLimiterService({ now: () => 1000 });
  const f = fixture({
    limitDownloadOriginReview: limiter.createMiddleware({ bucketName: 'origin-review', limit: 1, windowMs: 60_000 }),
    limitDownloadOriginMutation: limiter.createMiddleware({ bucketName: 'origin-mutation', limit: 1, windowMs: 60_000 }),
  });
  await withServer(f.app, async (base) => {
    assert.equal((await fetch(`${base}${prefix}/download-origin-review`)).status, 200);
    const readLimit = await fetch(`${base}${prefix}/download-origin-review`);
    assert.equal(readLimit.status, 429); assert.equal(readLimit.headers.get('retry-after'), '60');
    assert.equal(readLimit.headers.get('ratelimit-remaining'), '0'); assert.equal(f.calls.reads.length, 1);
    assert.equal((await post(base)).status, 200);
    const writeLimit = await post(base);
    assert.equal(writeLimit.status, 429); assert.equal(writeLimit.headers.get('retry-after'), '60');
    assert.equal(f.calls.resolutions.length, 1); assert.equal(f.calls.commandPayloads.length, 1);
  });
});
