import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchProviderStatus } from '../../src/client/lib/provider-api.js';

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
