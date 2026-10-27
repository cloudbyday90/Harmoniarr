/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { createSpotifyOAuthService } from '../../src/server/integrations/spotify/spotify-oauth-service.js';
import { createOAuthFacadeFixture } from '../../testing/server/oauth-link-facade-fixture.js';
import { oauthSessionAuthority, oauthBindingHash, parseOAuthPending, captureOAuthProof, oauthLinkNames, isOAuthRedirectUri } from '../../src/server/integrations/providers/oauth-link-policy.js';
import { readOAuthBrowserBinding, oauthBrowserCookieName } from '../../src/server/oauth-browser-binding.js';
const fixture = (t, options) => createOAuthFacadeFixture(t, createSpotifyOAuthService, 'spotify', options);
test('OAuth start requires exact session identity and browser binding before database or provider work', async t => {
  const f = fixture(t); await assert.rejects(f.service.startAuthorization({ browserBinding: f.browserBinding }), { code: 'spotify_oauth_authorization_changed' });
  await assert.rejects(f.service.startAuthorization({ session: f.session }), { code: 'spotify_oauth_state_invalid' });
  assert.equal(f.commandService.prepare.mock.callCount(), 0); assert.equal(f.fetchFn.mock.callCount(), 0);
});
test('OAuth start captures authority by value before the first await', async t => {
  const f = fixture(t), expected = oauthSessionAuthority('spotify', f.session), pending = f.start(); f.session.appUserId = randomUUID(); f.session.refreshToken = 'changed'; await pending;
  assert.deepEqual(f.commandService.prepare.mock.calls[0].arguments, [expected]);
  assert.deepEqual(f.commandService.createPending.mock.calls[0].arguments[0].authority, expected);
});
test('OAuth state or browser refusal precedes token exchange', async t => {
  const f = fixture(t), dto = await f.start();
  await assert.rejects(f.service.completeAuthorization({ state: new URL(dto.authorizationUrl).searchParams.get('state'), code: 'code', browserBinding: Buffer.alloc(32, 2).toString('base64url') }), { code: 'spotify_oauth_state_invalid' });
  assert.equal(f.fetchFn.mock.callCount(), 0); assert.equal(f.commandService.complete.mock.callCount(), 0);
});
test('OAuth callback refuses changed client configuration before exchanging a code', async t => {
  const f = fixture(t), dto = await f.start(); f.settings.providers.spotifyClientId = 'replacement-client';
  await assert.rejects(f.complete(dto), { code: 'spotify_oauth_state_invalid' }); assert.equal(f.fetchFn.mock.callCount(), 0);
});
test('OAuth write failure never exposes the exchanged credential as success', async t => {
  const f = fixture(t), dto = await f.start(); f.failWrite();
  await assert.rejects(f.complete(dto), { status: 503 }); assert.equal(f.getToken(), null); assert.equal(f.fetchFn.mock.callCount(), 1);
});
test('OAuth callback rejects malformed token responses before publication', async t => {
  for (const body of [{ access_token: [] }, { access_token: 'x', refresh_token: {} }, { access_token: 'x', expires_in: Number.MAX_SAFE_INTEGER }, { access_token: 'x', scope: 'x'.repeat(2049) }]) {
    const f = fixture(t), dto = await f.start(); f.fetchFn.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(f.complete(dto), { diagnosticCode: 'response_invalid' }); assert.equal(f.commandService.complete.mock.callCount(), 0);
  }
});
test('OAuth cancelled refresh cannot publish a late provider response', async t => {
  const controller = new AbortController(), f = fixture(t); f.setToken({ accessToken: 'old', refreshToken: 'refresh', expiresAt: '2020-01-01T00:00:00Z' });
  f.fetchFn.mock.mockImplementation(async () => { controller.abort(); return Response.json({ access_token: 'new', expires_in: 3600 }); });
  await assert.rejects(f.service.resolveAccessToken(null, { requestPolicy: { signal: controller.signal } }), { diagnosticCode: 'timeout' });
  assert.equal(f.commandService.refresh.mock.callCount(), 0); assert.equal(f.getToken().accessToken, 'old');
});
test('OAuth policy requires provider purpose, current expiry, browser binding and exact authority', async t => {
  const f = fixture(t), dto = await f.start(), state = new URL(dto.authorizationUrl).searchParams.get('state'), value = f.pending.get(state);
  const parse = candidate => parseOAuthPending('spotify', JSON.stringify(candidate), f.browserBinding, '2026-10-27T12:00:00.000Z');
  assert.equal(parse(value).codeVerifier, value.codeVerifier);
  for (const delta of [{ version: 0 }, { kind: 'owner_link' }, { provider: 'youtube' }, { codeVerifier: '' }, { browserBindingHash: oauthBindingHash('youtube', f.browserBinding) }, { authority: {} }, { expiresAt: '2000-01-01T00:00:00.000Z' }]) assert.throws(() => parse({ ...value, ...delta }), { code: 'spotify_oauth_state_invalid' });
  assert.equal(value.authority.tokenHash, createHash('sha256').update(f.session.refreshToken).digest('hex'));
});
test('OAuth proof copies ciphertext and refuses another provider namespace', () => {
  const value = { id: randomUUID(), name: 'providers.spotify.oauth.pending.' + 'a'.repeat(32), encryptedValue: Buffer.from('cipher'), revision: '2026-10-27 12:00:00.000001+00' };
  const proof = captureOAuthProof('spotify', value); value.encryptedValue.fill(0); assert.equal(proof.encryptedValue.toString(), 'cipher');
  assert.throws(() => captureOAuthProof('youtube', value), { code: 'youtube_oauth_state_invalid' }); assert.throws(() => oauthLinkNames('other'), TypeError);
});
test('OAuth cookies are provider-scoped host cookies and duplicates fail closed', () => {
  const value = Buffer.alloc(32, 1).toString('base64url'), request = cookie => ({ headers: { cookie }, deploymentSecurityPolicy: { secureCookies: false } });
  assert.equal(oauthBrowserCookieName('spotify', true), '__Host-harmoniarr_spotify_binding');
  assert.equal(readOAuthBrowserBinding(request('harmoniarr_spotify_binding=' + value), 'spotify'), value);
  assert.equal(readOAuthBrowserBinding(request('harmoniarr_spotify_binding=' + value), 'youtube'), null);
  assert.equal(readOAuthBrowserBinding(request(`harmoniarr_spotify_binding=${value}; harmoniarr_spotify_binding=${value}`), 'spotify'), null);
});

test('OAuth redirects require HTTPS or provider-supported loopback without embedded credentials', async t => {
  for (const origin of ['http://public.example', 'https://user:private@public.example']) {
    const f = fixture(t); f.settings.system.baseUrl = origin;
    await assert.rejects(f.start(), { code: 'spotify_oauth_redirect_invalid' }); assert.equal(f.commandService.createPending.mock.callCount(), 0); assert.equal(f.fetchFn.mock.callCount(), 0);
  }
  assert.equal(isOAuthRedirectUri('spotify', 'http://127.0.0.1:3000/callback'), true);
  assert.equal(isOAuthRedirectUri('spotify', 'http://localhost:3000/callback'), false);
  assert.equal(isOAuthRedirectUri('youtube', 'http://localhost:3000/callback'), true);
  assert.equal(isOAuthRedirectUri('spotify', 'https://app.example/callback?unexpected=value'), false);
});
