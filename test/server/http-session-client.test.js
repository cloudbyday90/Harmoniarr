import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

suite('HTTP session test client', () => {
  test('persists cookies and csrf tokens across requests', async () => {
    const app = createJsonTestApp((router) => {
      router.post('/login', (_request, response) => {
        response
          .set('set-cookie', ['sid=abc123; Path=/; HttpOnly'])
          .status(200)
          .json({
            csrfToken: 'csrf-login',
            ok: true,
          });
      });

      router.post('/mutate', (request, response) => {
        response.status(200).json({
          cookie: request.get('cookie') ?? null,
          csrf: request.get('x-csrf-token') ?? null,
          ok: true,
        });
      });
    });

    await withServer(app, async (baseUrl) => {
      const client = createSessionHttpClient(baseUrl);

      const loginResponse = await client.requestJson('/login', {
        method: 'POST',
      });
      assert.equal(loginResponse.payload.ok, true);
      assert.equal(client.getCsrfToken(), 'csrf-login');
      assert.equal(client.getCookieHeader(), 'sid=abc123');

      const mutateResponse = await client.requestJson('/mutate', {
        method: 'POST',
      });
      assert.equal(mutateResponse.payload.ok, true);
      assert.equal(mutateResponse.payload.cookie, 'sid=abc123');
      assert.equal(mutateResponse.payload.csrf, 'csrf-login');
    });
  });

  test('fails fast when a request exceeds the configured timeout', async () => {
    const app = createJsonTestApp((router) => {
      router.get('/slow', async (_request, response) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });
        response.status(200).json({ ok: true });
      });
    });

    await withServer(app, async (baseUrl) => {
      const client = createSessionHttpClient(baseUrl, {
        requestTimeoutMs: 10,
      });

      await assert.rejects(
        () => client.requestJson('/slow'),
        /GET \/slow timed out after 10ms/,
      );
    });
  });
});
