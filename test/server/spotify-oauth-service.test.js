/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createSpotifyOAuthService } from '../../src/server/integrations/spotify/spotify-oauth-service.js';
import { createOAuthFacadeFixture } from '../../testing/server/oauth-link-facade-fixture.js';
const fixture = (t, options) => createOAuthFacadeFixture(t, createSpotifyOAuthService, 'spotify', options);
test('Spotify start preserves scopes, S256 and exact redirect while keeping verifier and authority private', async t => {
  const f = fixture(t), dto = await f.start(), url = new URL(dto.authorizationUrl);
  assert.equal(url.origin, 'https://accounts.spotify.com'); assert.equal(url.pathname, '/authorize');
  assert.equal(url.searchParams.get('scope'), 'playlist-read-private playlist-read-collaborative');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  const accepted = f.commandService.createPending.mock.calls[0].arguments[0];
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(accepted.codeVerifier).digest('base64url'));
  assert.equal(url.searchParams.get('redirect_uri'), 'https://harmoniarr.example/api/v1/providers/spotify/oauth/callback');
  for (const secret of [accepted.codeVerifier, accepted.authority.tokenHash, f.browserBinding]) assert.ok(!JSON.stringify(dto).includes(secret));
});
test('Spotify callback exchanges the exact stored redirect and verifier with no client secret', async t => {
  const f = fixture(t), dto = await f.start(), accepted = f.commandService.createPending.mock.calls[0].arguments[0];
  f.settings.system.baseUrl = 'https://new.example'; await f.complete(dto);
  const [url, request] = f.fetchFn.mock.calls[0].arguments, body = new URLSearchParams(request.body);
  assert.equal(url, 'https://accounts.spotify.com/api/token'); assert.equal(request.redirect, 'error');
  assert.equal(body.get('code_verifier'), accepted.codeVerifier); assert.equal(body.get('redirect_uri'), accepted.redirectUri);
  assert.equal(body.get('client_id'), 'spotify-client'); assert.equal(body.get('code'), 'fixture-code'); assert.equal(body.has('client_secret'), false);
  assert.equal(f.commandService.complete.mock.callCount(), 1);
});
test('Spotify refresh preserves omitted refresh token and granted scope', async t => {
  const f = fixture(t); f.setToken({ accessToken: 'old', refreshToken: 'original-refresh', expiresAt: '2026-10-27T11:00:00.000Z', tokenType: 'Bearer', scope: 'old-scope' });
  f.fetchFn.mock.mockImplementation(async () => Response.json({ access_token: 'new', expires_in: 3600 }));
  assert.equal(await f.service.resolveAccessToken({}), 'new');
  assert.equal(f.getToken().refreshToken, 'original-refresh'); assert.equal(f.getToken().scope, 'old-scope');
  assert.equal(new URLSearchParams(f.fetchFn.mock.calls[0].arguments[1].body).get('grant_type'), 'refresh_token');
});
test('Spotify OAuth provider failure stays private and cannot publish a token', async t => {
  const f = fixture(t); f.setToken({ accessToken: 'old', refreshToken: 'PRIVATE-REFRESH', expiresAt: '2020-01-01T00:00:00.000Z' });
  const beforeRequest = t.mock.fn(async () => {});
  f.fetchFn.mock.mockImplementation(async () => Response.json({ error: 'invalid_grant', error_description: 'PRIVATE-REFRESH' }, { status: 400 }));
  await assert.rejects(f.service.resolveAccessToken({}, { requestPolicy: { beforeRequest } }), error => error.diagnosticCode === 'credentials_rejected' && !JSON.stringify({ ...error, message: error.message }).includes('PRIVATE-REFRESH'));
  assert.equal(beforeRequest.mock.callCount(), 1);
  assert.equal(f.commandService.refresh.mock.callCount(), 0); assert.equal(f.getToken().accessToken, 'old');
});
test('an aborted access check never reads or refreshes Spotify credentials', async t => {
  const f = fixture(t); await assert.rejects(f.service.resolveAccessToken({}, { requestPolicy: { signal: AbortSignal.abort() } }), { diagnosticCode: 'timeout' });
  assert.equal(f.stateService.readToken.mock.callCount(), 0); assert.equal(f.fetchFn.mock.callCount(), 0);
});
