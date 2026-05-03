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

import { createApiError } from '../../auth.js';
import { recordAuditEvent } from '../../audit.js';
import { getPool } from '../../database.js';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { loadSettings } from '../../settings.js';
import {
  buildRedirectUri,
  buildTokenMetadata,
  createBase64UrlRandom,
  createCodeChallenge,
  createOAuthError,
  readJsonResponse,
  safeJsonParse,
  toTokenPayload,
} from './oauth-helpers.js';

const secretType = 'integration_oauth';
const pendingStateTtlMs = 10 * 60 * 1000;
const tokenRefreshBufferMs = 60 * 1000;

function pendingStateSecretName(prefix, state) {
  return `${prefix}${state}`;
}

export function createOAuthPKCEService({
  authorizeUrl,
  callbackPath,
  clientIdSettingKey: _clientIdSettingKey,
  defaultScopes,
  encryptedSecretService = createEncryptedSecretService(),
  fetchFn = globalThis.fetch,
  getNow = () => new Date(),
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  providerLabel,
  providerPrefix,
  recordAuditEventFn = recordAuditEvent,
  resolveClientCredentials,
  revokeTokenBeforeClear = null,
  tokenUrl,
  tokenExchangeExtraParams: _tokenExchangeExtraParams = () => ({}),
}) {
  const tokenSecretName = `providers.${providerPrefix}.oauth.token`;
  const pendingPrefix = `providers.${providerPrefix}.oauth.pending.`;

  async function exchangeToken(body) {
    const response = await fetchFn(tokenUrl, {
      body: new URLSearchParams(body),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    const responseBody = await readJsonResponse(response);
    if (!response.ok) {
      throw createOAuthError(
        `${providerPrefix}_oauth_token_exchange_failed`,
        responseBody.error_description ?? responseBody.error ?? `Token endpoint returned ${response.status}`,
        { status: response.status },
      );
    }

    return responseBody;
  }

  async function buildStatus(queryable = getPoolFn()) {
    const metadata = await encryptedSecretService.getSecretMetadata({
      name: tokenSecretName,
      queryable,
      secretType,
    });
    const record = await encryptedSecretService.getSecretRecord({
      name: tokenSecretName,
      queryable,
      secretType,
    });

    return {
      linked: metadata.configured,
      scope: record?.metadata?.scope ?? null,
      tokenType: record?.metadata?.tokenType ?? null,
      tokenExpiresAt: record?.metadata?.expiresAt ?? null,
      updatedAt: metadata.updatedAt ?? null,
    };
  }

  async function startAuthorization({ actorUserId = null, requestMetadata = {} } = {}) {
    const settings = await loadSettingsFn();
    const credentials = await resolveClientCredentials({ settings, queryable: getPoolFn() });

    const state = createBase64UrlRandom(24);
    const codeVerifier = createBase64UrlRandom(64);
    const redirectUri = buildRedirectUri({
      baseUrlSetting: settings.system?.baseUrl ?? '',
      callbackPath,
      requestMetadata,
    });
    if (!redirectUri) {
      throw createApiError(400, `${providerPrefix}_oauth_base_url_required`, `Configure system.baseUrl before starting ${providerLabel} OAuth`);
    }

    const expiresAt = new Date(getNow().getTime() + pendingStateTtlMs).toISOString();

    await encryptedSecretService.setSecretValue({
      metadata: { actorUserId, expiresAt, redirectUri },
      name: pendingStateSecretName(pendingPrefix, state),
      plaintextValue: JSON.stringify({ actorUserId, codeVerifier, expiresAt, redirectUri }),
      secretType,
    });

    const authorizationUrl = new URL(authorizeUrl);
    authorizationUrl.searchParams.set('client_id', credentials.clientId);
    authorizationUrl.searchParams.set('code_challenge', createCodeChallenge(codeVerifier));
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', defaultScopes.join(' '));
    authorizationUrl.searchParams.set('state', state);

    const extraAuthParams = credentials.extraAuthParams ?? {};
    for (const [key, value] of Object.entries(extraAuthParams)) {
      authorizationUrl.searchParams.set(key, String(value));
    }

    await recordAuditEventFn({
      actorType: actorUserId ? 'app_user' : 'system',
      actorUserId,
      details: { expiresAt, scopes: defaultScopes },
      entityType: 'provider_oauth',
      eventType: `${providerPrefix}_oauth_started`,
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: `${providerLabel} OAuth authorization started`,
      userAgent: requestMetadata.userAgent ?? null,
    });

    return {
      authorizationUrl: authorizationUrl.toString(),
      expiresAt,
      provider: providerPrefix,
      scopes: defaultScopes,
    };
  }

  async function completeAuthorization({ code, requestMetadata = {}, state } = {}) {
    if (!code || !state) {
      throw createApiError(400, 'validation_error', `${providerLabel} OAuth callback requires code and state`);
    }

    const queryable = getPoolFn();
    const pendingName = pendingStateSecretName(pendingPrefix, state);
    const pendingValue = await encryptedSecretService.getSecretValue({
      name: pendingName,
      queryable,
      secretType,
    });
    const pendingState = safeJsonParse(pendingValue);
    if (!pendingState) {
      throw createApiError(400, `${providerPrefix}_oauth_state_invalid`, `${providerLabel} OAuth state is invalid or expired`);
    }

    const now = getNow();
    if (new Date(pendingState.expiresAt).getTime() <= now.getTime()) {
      await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });
      throw createApiError(400, `${providerPrefix}_oauth_state_expired`, `${providerLabel} OAuth state expired before callback completion`);
    }

    const settings = await loadSettingsFn();
    const credentials = await resolveClientCredentials({ settings, queryable });

    const exchangeBody = {
      client_id: credentials.clientId,
      code,
      code_verifier: pendingState.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: pendingState.redirectUri,
      ...credentials.extraTokenParams ?? {},
    };
    const body = await exchangeToken(exchangeBody);
    const tokenPayload = toTokenPayload({ body, now });

    await encryptedSecretService.setSecretValue({
      metadata: buildTokenMetadata(tokenPayload, {
        linkedAt: now.toISOString(),
        scopes: defaultScopes,
      }),
      name: tokenSecretName,
      plaintextValue: JSON.stringify(tokenPayload),
      queryable,
      secretType,
    });
    await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });

    await recordAuditEventFn({
      actorType: pendingState.actorUserId ? 'app_user' : 'system',
      actorUserId: pendingState.actorUserId ?? null,
      details: {
        scopes: defaultScopes,
        tokenExpiresAt: tokenPayload.expiresAt,
      },
      entityType: 'provider_oauth',
      eventType: `${providerPrefix}_oauth_completed`,
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: `${providerLabel} OAuth authorization completed`,
      userAgent: requestMetadata.userAgent ?? null,
    });

    return {
      provider: providerPrefix,
      status: await buildStatus(queryable),
    };
  }

  async function clearAuthorization({ actorUserId = null, requestMetadata = {} } = {}) {
    if (typeof revokeTokenBeforeClear === 'function') {
      const tokenValue = await encryptedSecretService.getSecretValue({
        name: tokenSecretName,
        queryable: getPoolFn(),
        secretType,
      });
      const tokenPayload = safeJsonParse(tokenValue);
      if (tokenPayload?.accessToken) {
        try {
          await revokeTokenBeforeClear(tokenPayload.accessToken);
        } catch {
          // Revocation is best-effort; proceed with local cleanup even if
          // the provider rejects or is unreachable.
        }
      }
    }

    await encryptedSecretService.clearSecretValue({
      name: tokenSecretName,
      secretType,
    });
    await recordAuditEventFn({
      actorType: actorUserId ? 'app_user' : 'system',
      actorUserId,
      details: {},
      entityType: 'provider_oauth',
      eventType: `${providerPrefix}_oauth_cleared`,
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: `${providerLabel} OAuth authorization cleared`,
      userAgent: requestMetadata.userAgent ?? null,
    });

    return {
      provider: providerPrefix,
      status: await buildStatus(),
    };
  }

  async function resolveAccessToken(queryable = getPoolFn()) {
    const tokenValue = await encryptedSecretService.getSecretValue({
      name: tokenSecretName,
      queryable,
      secretType,
    });
    const tokenPayload = safeJsonParse(tokenValue);
    if (!tokenPayload?.accessToken || !tokenPayload?.refreshToken) {
      return null;
    }

    const now = getNow();
    if (new Date(tokenPayload.expiresAt).getTime() > now.getTime() + tokenRefreshBufferMs) {
      return tokenPayload.accessToken;
    }

    const settings = await loadSettingsFn();
    const credentials = await resolveClientCredentials({ settings, queryable });

    const refreshBody = {
      client_id: credentials.clientId,
      grant_type: 'refresh_token',
      refresh_token: tokenPayload.refreshToken,
      ...credentials.extraRefreshParams ?? {},
    };
    const body = await exchangeToken(refreshBody);
    const refreshedPayload = toTokenPayload({
      body,
      now,
      previousRefreshToken: tokenPayload.refreshToken,
    });

    await encryptedSecretService.setSecretValue({
      metadata: buildTokenMetadata(refreshedPayload, {
        refreshedAt: now.toISOString(),
        scopes: defaultScopes,
      }),
      name: tokenSecretName,
      plaintextValue: JSON.stringify(refreshedPayload),
      queryable,
      secretType,
    });

    return refreshedPayload.accessToken;
  }

  return {
    buildStatus,
    clearAuthorization,
    completeAuthorization,
    resolveAccessToken,
    startAuthorization,
  };
}
