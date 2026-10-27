/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createYouTubeOAuthService } from '../../src/server/integrations/youtube/youtube-oauth-service.js';
import { createOAuthFacadeFixture } from '../../testing/server/oauth-link-facade-fixture.js';
const fixture = (t, options) => createOAuthFacadeFixture(t, createYouTubeOAuthService, 'youtube', options);
test('YouTube start preserves read-only scope, offline consent and incremental authorization', async t => {
  const f = fixture(t), dto = await f.start(), url = new URL(dto.authorizationUrl);
  assert.equal(url.origin, 'https://accounts.google.com'); assert.equal(url.pathname, '/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.readonly');
  for (const [key, value] of Object.entries({ access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', code_challenge_method: 'S256' })) assert.equal(url.searchParams.get(key), value);
});
test('YouTube callback retains server client secret and PKCE verifier in the token request only', async t => {
  const f = fixture(t), dto = await f.start(); await f.complete(dto);
  const [url, request] = f.fetchFn.mock.calls[0].arguments, body = new URLSearchParams(request.body);
  assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(body.get('client_secret'), 'youtube-secret');
  assert.equal(body.get('code_verifier'), f.commandService.createPending.mock.calls[0].arguments[0].codeVerifier);
  assert.ok(!JSON.stringify(dto).includes('youtube-secret'));
});
test('YouTube refresh preserves the old refresh token and sends the configured server secret', async t => {
  const f = fixture(t); f.setToken({ accessToken: 'old', refreshToken: 'original', expiresAt: '2026-10-27T11:00:00.000Z' });
  f.fetchFn.mock.mockImplementation(async () => Response.json({ access_token: 'new', expires_in: 3600 }));
  assert.equal(await f.service.resolveAccessToken(), 'new'); assert.equal(f.getToken().refreshToken, 'original');
  assert.equal(new URLSearchParams(f.fetchFn.mock.calls[0].arguments[1].body).get('client_secret'), 'youtube-secret');
});
test('YouTube clear commits locally before bounded best-effort revocation and never returns the token', async t => {
  const f = fixture(t); f.setToken({ accessToken: 'private-old', refreshToken: 'original', expiresAt: '2026-10-27T13:00:00.000Z' });
  f.fetchFn.mock.mockImplementation(async (url, request) => {
    assert.equal(f.getToken(), null); assert.equal(url, 'https://oauth2.googleapis.com/revoke');
    assert.equal(new URLSearchParams(request.body).get('token'), 'private-old'); assert.equal(request.redirect, 'error'); assert.ok(request.signal instanceof AbortSignal);
    return new Response('', { status: 200 });
  });
  const result = await f.service.clearAuthorization({ session: f.session }); assert.deepEqual(result, { provider: 'youtube', status: { linked: false, tokenExpiresAt: null } });
  assert.equal(f.fetchFn.mock.callCount(), 1); assert.ok(!JSON.stringify(result).includes('private-old'));
});
test('YouTube local clear failure cannot attempt remote revocation', async t => {
  const f = fixture(t); f.commandService.clear.mock.mockImplementation(async () => { throw new Error('local rollback'); });
  await assert.rejects(f.service.clearAuthorization({ session: f.session }), /local rollback/u); assert.equal(f.fetchFn.mock.callCount(), 0);
});
