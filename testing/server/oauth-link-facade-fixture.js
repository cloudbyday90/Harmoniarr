/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';
import { createApiError } from '../../src/server/api-error.js';
import { oauthCredentialsFingerprint, oauthBindingHash, parseOAuthPending, invalidOAuthState } from '../../src/server/integrations/providers/oauth-link-policy.js';

/** Protocol-only double. Actual ownership/cardinality is qualified on PostgreSQL. */
export function createOAuthFacadeFixture(t, createService, provider, overrides = {}) {
  const now = new Date('2026-10-27T12:00:00.000Z'), expiresAt = '2026-10-27T12:10:00.000Z';
  const session = { appUserId: randomUUID(), refreshTokenId: randomUUID(), tokenFamilyId: randomUUID(), refreshToken: 'public-fixture-refresh' };
  const browserBinding = Buffer.alloc(32, 1).toString('base64url'), pending = new Map(); let token = null;
  const settings = { system: { baseUrl: 'https://harmoniarr.example' }, providers: { spotifyClientId: 'spotify-client', youtubeClientId: 'youtube-client' } };
  const credentials = { clientId: settings.providers[provider + 'ClientId'], ...(provider === 'youtube' ? { extraTokenParams: { client_secret: 'youtube-secret' }, extraRefreshParams: { client_secret: 'youtube-secret' } } : {}) };
  const status = () => ({ linked: Boolean(token), tokenExpiresAt: token?.expiresAt ?? null });
  const commandService = {
    prepare: t.mock.fn(async () => ({ linkRevision: randomUUID() })),
    admitPending: t.mock.fn(async () => ({ admitted: true })),
    createPending: t.mock.fn(async input => { pending.set(input.state, { ...input, version: 1, kind: 'provider_oauth', provider,
      browserBindingHash: oauthBindingHash(provider, input.browserBinding), expiresAt }); return { expiresAt }; }),
    complete: t.mock.fn(async input => { pending.delete(input.pending.state); token = input.tokenPayload; return { provider, status: status() }; }),
    clear: t.mock.fn(async () => { const revocationToken = token?.accessToken ?? null; token = null; return { provider, status: status(), revocationToken }; }),
    refresh: t.mock.fn(async input => { token = input.tokenPayload; return { accessToken: token.accessToken }; }),
  };
  const stateService = {
    buildStatus: async () => status(),
    readPending: t.mock.fn(async ({ state, browserBinding: binding }) => {
      const value = pending.get(state); if (!value) throw invalidOAuthState(provider);
      return { ...parseOAuthPending(provider, JSON.stringify(value), binding, now), state,
        proof: { id: randomUUID(), name: `providers.${provider}.oauth.pending.${state}`, encryptedValue: Buffer.from('fixture'), revision: 'revision' } };
    }),
    readToken: t.mock.fn(async () => token ? { payload: { ...token }, credentialFingerprint: oauthCredentialsFingerprint(provider, credentials), proof: {} } : null),
  };
  const fetchFn = t.mock.fn(async () => Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'Bearer', scope: 'read' }));
  const options = { commandService, stateService, fetchFn, startReadFn: work => ({ result: Promise.resolve().then(() => work({})) }),
    getNow: () => now, loadSettingsFn: async () => settings, providerCredentialsService: { resolveYoutubeClientSecret: async () => 'youtube-secret' }, ...overrides };
  const service = createService(options);
  return { service, commandService, stateService, settings, session, browserBinding, fetchFn, pending,
    start: () => service.startAuthorization({ session, browserBinding }),
    complete: dto => service.completeAuthorization({ state: new URL(dto.authorizationUrl).searchParams.get('state'), code: 'fixture-code', browserBinding }),
    setToken: value => { token = value; }, getToken: () => token, failWrite: () => { commandService.complete.mock.mockImplementation(async () => { throw createApiError(503, 'fixture_write_failed', 'Fixture refusal'); }); } };
}
