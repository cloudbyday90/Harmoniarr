/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createApiError } from '../../api-error.js';
import { recordAuditEvent } from '../../audit.js';
import { getPool } from '../../database.js';
import { startAuthLookup } from '../../auth-lookup-service.js';
import { startSessionWriteTransaction } from '../../session-write-transaction-service.js';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { loadSettings } from '../../settings.js';
import { createProviderJsonRequestService } from './provider-json-request-service.js';
import { createProviderRequestError } from './provider-request-error.js';
import { buildRedirectUri, createBase64UrlRandom, createCodeChallenge, toTokenPayload } from './oauth-helpers.js';
import { createOAuthLinkOwnerService } from './oauth-link-owner-service.js';
import { createOAuthLinkCommandService } from './oauth-link-command-service.js';
import { createOAuthLinkStateService } from './oauth-link-state-service.js';
import { oauthLinkNames, oauthSessionAuthority, oauthBindingHash, oauthCredentialsFingerprint, captureOAuthToken, invalidOAuthState, changedOAuthLink, isOAuthRedirectUri } from './oauth-link-policy.js';

export function createOAuthPKCEService({ authorizeUrl, callbackPath, defaultScopes, encryptedSecretService = createEncryptedSecretService(),
  fetchFn = globalThis.fetch, getNow = () => new Date(), getPoolFn = getPool, loadSettingsFn = loadSettings, providerPrefix: provider,
  providerLabel, recordAuditEventFn = recordAuditEvent, resolveClientCredentials, revokeTokenBeforeClear = null, tokenUrl,
  commandService, stateService, startReadFn = (work, options) => startAuthLookup(work, { ...options, getPoolFn }),
  startTransactionFn = (work, options) => startSessionWriteTransaction(work, { ...options, getPoolFn }) }) {
  oauthLinkNames(provider);
  const readCredentials = async client => resolveClientCredentials({ settings: await loadSettingsFn(client), queryable: client });
  const fingerprint = async client => oauthCredentialsFingerprint(provider, await readCredentials(client));
  const owner = createOAuthLinkOwnerService({ provider, startTransactionFn });
  const commands = commandService ?? createOAuthLinkCommandService({ provider, encryptedSecretService, recordAuditEventFn, owner, readCredentialsFingerprint: fingerprint });
  const states = stateService ?? createOAuthLinkStateService({ provider, encryptedSecretService, startReadFn });
  const credentials = () => startReadFn(readCredentials).result;
  async function exchange(body, requestPolicy = {}, previous) {
    const now = getNow();
    const response = await createProviderJsonRequestService({ provider, fetchFn, requestPolicy: { ...requestPolicy,
      maxResponseBytes: Math.min(requestPolicy.maxResponseBytes ?? 65536, 65536) } }).requestJson({ url: tokenUrl,
      body: new URLSearchParams(body), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, method: 'POST', oauth: true });
    if (!Number.isSafeInteger(response.expires_in ?? 3600) || (response.expires_in ?? 3600) < 1 || (response.expires_in ?? 3600) > 31_536_000) throw createProviderRequestError(provider, 'response_invalid');
    try { return captureOAuthToken(provider, toTokenPayload({ body: { ...response, scope: response.scope ?? previous?.scope,
      token_type: response.token_type ?? previous?.tokenType }, now, previousRefreshToken: previous?.refreshToken })); }
    catch { throw createProviderRequestError(provider, 'response_invalid'); }
  }
  return {
    buildStatus: states.buildStatus,
    async startAuthorization({ session, browserBinding, requestMetadata = {} } = {}) {
      const authority = oauthSessionAuthority(provider, session); oauthBindingHash(provider, browserBinding);
      const { linkRevision } = await commands.prepare(authority);
      const acceptedCredentials = await credentials(), settings = await startReadFn(client => loadSettingsFn(client)).result;
      const credentialFingerprint = oauthCredentialsFingerprint(provider, acceptedCredentials);
      const state = createBase64UrlRandom(24), codeVerifier = createBase64UrlRandom(64);
      const redirectUri = buildRedirectUri({ baseUrlSetting: settings.system?.baseUrl ?? '', callbackPath, requestMetadata });
      if (!redirectUri) throw createApiError(400, `${provider}_oauth_base_url_required`, `Configure system.baseUrl before starting ${providerLabel} OAuth`);
      if (!isOAuthRedirectUri(provider, redirectUri)) throw createApiError(400, `${provider}_oauth_redirect_invalid`, 'Configure an HTTPS application URL or a supported local loopback URL before linking.');
      const authorizationUrl = new URL(authorizeUrl);
      for (const [key, value] of Object.entries(acceptedCredentials.extraAuthParams ?? {})) authorizationUrl.searchParams.set(key, String(value));
      for (const [key, value] of Object.entries({ client_id: acceptedCredentials.clientId, code_challenge: createCodeChallenge(codeVerifier),
        code_challenge_method: 'S256', redirect_uri: redirectUri, response_type: 'code', scope: defaultScopes.join(' '), state })) authorizationUrl.searchParams.set(key, value);
      const { expiresAt } = await commands.createPending({ authority, state, browserBinding, codeVerifier, redirectUri, credentialFingerprint, linkRevision, requestMetadata });
      return { authorizationUrl: authorizationUrl.href, expiresAt, provider, scopes: [...defaultScopes] };
    },
    async completeAuthorization({ code, state, browserBinding, requestMetadata = {} } = {}) {
      if (typeof code !== 'string' || !code || code.length > 4096) throw invalidOAuthState(provider);
      const pending = await states.readPending({ state, browserBinding });
      await commands.admitPending(pending);
      const acceptedCredentials = await credentials();
      if (oauthCredentialsFingerprint(provider, acceptedCredentials) !== pending.credentialFingerprint) throw invalidOAuthState(provider);
      const tokenPayload = await exchange({ ...acceptedCredentials.extraTokenParams, client_id: acceptedCredentials.clientId, code,
        code_verifier: pending.codeVerifier, grant_type: 'authorization_code', redirect_uri: pending.redirectUri });
      return commands.complete({ pending, tokenPayload, requestMetadata });
    },
    async clearAuthorization({ session, requestMetadata = {} } = {}) {
      const { status, revocationToken } = await commands.clear({ authority: oauthSessionAuthority(provider, session), requestMetadata });
      // Local clear has committed; remote grant revocation is separately best effort.
      if (revocationToken && revokeTokenBeforeClear) { try { await revokeTokenBeforeClear(revocationToken); } catch { /* Never restore a locally cleared credential. */ } }
      return { provider, status };
    },
    async resolveAccessToken(_queryable, { requestPolicy = {} } = {}) {
      if (requestPolicy.signal?.aborted) throw createProviderRequestError(provider, 'timeout');
      const snapshot = await states.readToken();
      if (!snapshot) return null;
      const token = snapshot.payload;
      let acceptedCredentials;
      if (snapshot.credentialFingerprint) {
        acceptedCredentials = await credentials();
        if (oauthCredentialsFingerprint(provider, acceptedCredentials) !== snapshot.credentialFingerprint) throw changedOAuthLink(provider);
      }
      if (Date.parse(token.expiresAt) > getNow().getTime() + 60_000) return token.accessToken;
      if (!token.refreshToken) return null;
      acceptedCredentials ??= await credentials();
      const credentialFingerprint = oauthCredentialsFingerprint(provider, acceptedCredentials);
      if (snapshot.credentialFingerprint && snapshot.credentialFingerprint !== credentialFingerprint) throw changedOAuthLink(provider);
      const tokenPayload = await exchange({ ...acceptedCredentials.extraRefreshParams, client_id: acceptedCredentials.clientId,
        grant_type: 'refresh_token', refresh_token: token.refreshToken }, requestPolicy, token);
      if (requestPolicy.signal?.aborted) throw createProviderRequestError(provider, 'timeout');
      return (await commands.refresh({ snapshot, tokenPayload, credentialFingerprint, signal: requestPolicy.signal })).accessToken;
    },
  };
}
