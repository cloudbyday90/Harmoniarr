import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderJsonRequestService } from '../../src/server/integrations/providers/provider-json-request-service.js';
import { readBoundedJsonResponse } from '../../src/server/integrations/providers/provider-json-response.js';
import { parseProviderRetryAfter } from '../../src/server/integrations/providers/provider-request-error.js';

const secret = 'PRIVATE-SENTINEL-token';
const url = `https://www.googleapis.com/youtube/v3/playlistItems?key=${secret}`;
const serializeError = (error) => JSON.stringify({ ...error, message: error.message });

for (const scenario of [
  { status: 401, reason: 'invalid_token', category: 'credentials_rejected' },
  { status: 403, reason: 'quotaExceeded', category: 'quota_exceeded' },
  { status: 403, reason: 'insufficientPermissions', category: 'access_denied' },
  { status: 403, reason: secret, category: 'access_denied' },
  { status: 404, reason: secret, category: 'resource_unavailable' },
  { status: 500, reason: secret, category: 'unavailable' },
]) {
  test(`provider HTTP ${scenario.status}/${scenario.category} exposes only known diagnostics`, async () => {
    const service = createProviderJsonRequestService({ provider: 'youtube', fetchFn: async () => new Response(JSON.stringify({
      error: { message: secret, errors: [{ reason: scenario.reason }] }, privateData: secret,
    }), { status: scenario.status }) });
    await assert.rejects(service.requestJson({ url }), (error) => {
      assert.equal(error.diagnosticCode, scenario.category);
      assert.equal(serializeError(error).includes(secret), false);
      assert.equal(Object.hasOwn(error.details, 'url'), false);
      return true;
    });
  });
}

test('Spotify account quota reason remains distinct from an unknown rate-limit reason', async () => {
  const service = createProviderJsonRequestService({ provider: 'spotify', fetchFn: async () => new Response(JSON.stringify({
    error: { reason: 'QUOTA_EXCEEDED', message: secret },
  }), { status: 429, headers: { 'retry-after': '123' } }) });
  await assert.rejects(service.requestJson({ url: 'https://api.spotify.com/v1/playlists/id/items' }), (error) => {
    assert.equal(error.diagnosticCode, 'quota_exceeded');
    assert.equal(error.details.reasonCode, 'QUOTA_EXCEEDED');
    assert.equal(error.details.retryAfterSeconds, 123);
    assert.equal(serializeError(error).includes(secret), false);
    return true;
  });
});

test('Google OAuth invalid_grant is an authentication failure rather than an ambiguous request failure', async () => {
  const service = createProviderJsonRequestService({ provider: 'youtube', fetchFn: async () => new Response(JSON.stringify({
    error: 'invalid_grant', error_description: secret,
  }), { status: 400 }) });
  await assert.rejects(service.requestJson({ url: 'https://oauth2.googleapis.com/token', method: 'POST', oauth: true }), (error) => {
    assert.equal(error.diagnosticCode, 'credentials_rejected');
    assert.equal(error.code, 'youtube_oauth_token_exchange_failed');
    assert.equal(serializeError(error).includes(secret), false);
    return true;
  });
});

test('request transport disables redirects and does not call an unapproved origin', async (t) => {
  const fetchFn = t.mock.fn(async () => new Response('{}'));
  const service = createProviderJsonRequestService({ provider: 'youtube', fetchFn });
  await service.requestJson({ url });
  assert.equal(fetchFn.mock.calls[0].arguments[1].redirect, 'error');
  await assert.rejects(service.requestJson({ url: `https://untrusted.example/?key=${secret}` }));
  assert.equal(fetchFn.mock.callCount(), 1);
});

test('network exception messages and forged diagnostic metadata cannot expose request secrets', async () => {
  const service = createProviderJsonRequestService({ provider: 'youtube', fetchFn: async () => {
    throw Object.assign(new Error(`Request failed: ${url}`), { diagnosticCode: secret, details: { status: secret, cause: secret, reasonCode: secret } });
  } });
  await assert.rejects(service.requestJson({ url }), (error) => {
    assert.equal(error.diagnosticCode, 'unavailable');
    assert.equal(serializeError(error).includes(secret), false);
    return true;
  });
});

test('request deadline includes a response body that never completes', async () => {
  const service = createProviderJsonRequestService({ provider: 'youtube', requestTimeoutMs: 10, fetchFn: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
  })) });
  await assert.rejects(service.requestJson({ url }), { diagnosticCode: 'timeout' });
});

test('caller deadline includes a stalled fetch and strips its abort reason', async () => {
  const controller = new AbortController();
  const service = createProviderJsonRequestService({ provider: 'youtube', requestPolicy: { signal: controller.signal }, fetchFn: async () => {
    controller.abort(new Error(secret));
    return new Promise(() => {});
  } });
  await assert.rejects(service.requestJson({ url }), (error) => {
    assert.equal(error.diagnosticCode, 'timeout');
    assert.equal(serializeError(error).includes(secret), false);
    return true;
  });
});

for (const response of [() => new Response(`{"broken":"${secret}`), () => new Response(JSON.stringify({ secret }), { headers: { 'content-length': '9999999' } }),
  () => new Response(JSON.stringify({ secret }))]) {
  test('bounded JSON rejects malformed or oversized content without echoing a body', async () => {
    await assert.rejects(readBoundedJsonResponse(response(), { maxResponseBytes: 10 }), (error) => {
      assert.equal(error.code, 'provider_response_invalid');
      assert.equal(serializeError(error).includes(secret), false);
      return true;
    });
  });
}

test('Retry-After accepts bounded seconds and HTTP dates without accepting partial integers', () => {
  assert.equal(parseProviderRetryAfter('120'), 120);
  assert.equal(parseProviderRetryAfter('1000000'), 86400);
  assert.equal(parseProviderRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT', Date.parse('2015-10-21T07:27:00Z')), 60);
  assert.equal(parseProviderRetryAfter('120secret'), null);
  assert.equal(parseProviderRetryAfter('-1'), null);
});
