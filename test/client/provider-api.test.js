import assert from 'node:assert/strict';
import test from 'node:test';
import { checkProviderCollectionAccess, fetchProviderStatus } from '../../src/client/lib/provider-api.js';

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

test('provider-api fetchProviderStatus sends GET to providers status endpoint', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchProviderStatus();

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/providers/status');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'GET');
});

test('provider collection access check posts only the supplied source with CSRF and cancellation', async (t) => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  t.after(() => {
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
  });
  globalThis.document = { cookie: 'harmoniarr_csrf=check-csrf' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());
  const controller = new AbortController();
  const sourceUrl = 'https://open.spotify.com/playlist/fixture';

  await checkProviderCollectionAccess({ sourceUrl, apiKey: 'unused-secret' }, { signal: controller.signal });

  const [path, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(path, '/api/v1/providers/collection-access-check');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'check-csrf');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.signal, controller.signal);
  assert.ok(options.body === JSON.stringify({ sourceUrl }), 'The check sends only the source URL.');
});
