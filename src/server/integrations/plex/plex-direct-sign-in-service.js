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

import { randomUUID } from 'node:crypto';
import { createApiError, loginLinkedUser } from '../../auth.js';
import { recordAuditEvent } from '../../audit.js';
import { getPool } from '../../database.js';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { loadSettings } from '../../settings.js';
import { createPlexHttpClient } from './plex-http-client.js';

const secretType = 'integration_oauth';
const pendingStateTtlMs = 10 * 60 * 1000;
const pendingStatePrefix = 'auth.plex.sign_in.pending.';
const clientIdentifierSecretName = 'auth.plex.sign_in.client_identifier';
const plexAuthBaseUrl = 'https://app.plex.tv/auth#?';
const defaultRedirectTarget = '/app';

function pendingStateSecretName(state) {
  return `${pendingStatePrefix}${state}`;
}

function safeJsonParse(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeRedirectTarget(value) {
  if (typeof value !== 'string') {
    return defaultRedirectTarget;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/api/')) {
    return defaultRedirectTarget;
  }

  return trimmed;
}

function buildForwardUrl(baseUrl, state) {
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    return null;
  }

  const url = new URL('/api/v1/auth/plex/callback', baseUrl);
  url.searchParams.set('state', state);
  return url.toString();
}

function buildPlexAuthAppUrl({ clientIdentifier, pinCode, forwardUrl }) {
  const params = new URLSearchParams();
  params.set('clientID', clientIdentifier);
  params.set('code', pinCode);
  params.set('forwardUrl', forwardUrl);
  params.set('context[device][product]', 'Harmoniarr');
  return `${plexAuthBaseUrl}${params.toString()}`;
}

function normalizeCurrentUserProfile(profile) {
  return {
    email: typeof profile?.email === 'string' && profile.email.trim() ? profile.email.trim().toLowerCase() : null,
    guest: profile?.guest === true,
    home: profile?.home === true,
    id: profile?.id != null ? String(profile.id) : null,
    restricted: profile?.restricted === true,
    thumbUrl: typeof profile?.thumb === 'string' && profile.thumb.trim() ? profile.thumb.trim() : null,
    title: typeof profile?.title === 'string' && profile.title.trim()
      ? profile.title.trim()
      : (typeof profile?.username === 'string' && profile.username.trim() ? profile.username.trim() : 'Plex account'),
    username: typeof profile?.username === 'string' && profile.username.trim()
      ? profile.username.trim().toLowerCase()
      : null,
    uuid: typeof profile?.uuid === 'string' && profile.uuid.trim() ? profile.uuid.trim() : null,
  };
}

async function findLinkedPlexUser({ plexId, plexUuid, queryable = getPool() }) {
  const subjects = [plexUuid, plexId]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  if (subjects.length === 0) {
    return null;
  }

  const result = await queryable.query(
    `
      SELECT *
      FROM app_users
      WHERE auth_provider = 'plex'
        AND auth_subject = ANY($1::text[])
      ORDER BY CASE
        WHEN auth_subject = $2 THEN 0
        WHEN auth_subject = $3 THEN 1
        ELSE 2
      END,
      updated_at DESC
      LIMIT 1
    `,
    [subjects, plexUuid ?? null, plexId ?? null],
  );

  return result.rows[0] ?? null;
}

export function buildPlexLoginRedirectUrl({ code = null, reason = null, redirectTo = null } = {}) {
  const url = new URL('/login', 'http://harmoniarr.local');
  if (reason) {
    url.searchParams.set('reason', reason);
  }
  if (code) {
    url.searchParams.set('code', code);
  }
  if (redirectTo) {
    url.searchParams.set('redirect', normalizeRedirectTarget(redirectTo));
  }

  return `${url.pathname}${url.search}`;
}

export function createPlexDirectSignInService({
  encryptedSecretService = createEncryptedSecretService(),
  getNow = () => new Date(),
  getPoolFn = getPool,
  issueLinkedLogin = loginLinkedUser,
  loadSettingsFn = loadSettings,
  plexHttpClient = createPlexHttpClient(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function resolveClientIdentifier(queryable = getPoolFn()) {
    const existing = await encryptedSecretService.getSecretValue({
      name: clientIdentifierSecretName,
      queryable,
      secretType,
    });

    if (typeof existing === 'string' && existing.trim().length > 0) {
      return existing.trim();
    }

    const clientIdentifier = randomUUID();
    await encryptedSecretService.setSecretValue({
      metadata: { createdAt: getNow().toISOString() },
      name: clientIdentifierSecretName,
      plaintextValue: clientIdentifier,
      queryable,
      secretType,
    });
    return clientIdentifier;
  }

  async function startSignIn({ redirectTo = null, requestMetadata = {} } = {}) {
    const settings = await loadSettingsFn();
    const forwardBaseUrl = settings.system?.baseUrl ?? requestMetadata.origin ?? '';
    const state = randomUUID();
    const forwardUrl = buildForwardUrl(forwardBaseUrl, state);
    if (!forwardUrl) {
      throw createApiError(400, 'plex_sign_in_base_url_required', 'Configure system.baseUrl before starting Plex sign-in');
    }

    const queryable = getPoolFn();
    const clientIdentifier = await resolveClientIdentifier(queryable);
    const pin = await plexHttpClient.createPin({ clientIdentifier });
    const expiresAt = new Date(getNow().getTime() + pendingStateTtlMs).toISOString();
    const pinCode = typeof pin?.code === 'string' ? pin.code.trim() : '';
    const pinId = pin?.id != null ? String(pin.id) : '';
    if (!pinCode || !pinId) {
      throw createApiError(502, 'plex_sign_in_pin_create_failed', 'Plex PIN creation did not return a usable id and code');
    }

    const normalizedRedirectTo = normalizeRedirectTarget(redirectTo);
    await encryptedSecretService.setSecretValue({
      metadata: { expiresAt, pinId, redirectTo: normalizedRedirectTo },
      name: pendingStateSecretName(state),
      plaintextValue: JSON.stringify({
        clientIdentifier,
        expiresAt,
        pinId,
        redirectTo: normalizedRedirectTo,
      }),
      queryable,
      secretType,
    });

    await recordAuditEventFn({
      actorType: 'anonymous',
      details: { expiresAt, redirectTo: normalizedRedirectTo, state },
      entityType: 'auth_flow',
      eventType: 'plex_sign_in_started',
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: 'Plex direct sign-in started',
      userAgent: requestMetadata.userAgent ?? null,
    });

    return {
      authorizationUrl: buildPlexAuthAppUrl({
        clientIdentifier,
        forwardUrl,
        pinCode,
      }),
      expiresAt,
      provider: 'plex',
      redirectTo: normalizedRedirectTo,
    };
  }

  async function completeSignIn({ requestMetadata = {}, state } = {}) {
    if (typeof state !== 'string' || state.trim().length === 0) {
      throw createApiError(400, 'validation_error', 'Plex sign-in callback requires state');
    }

    const queryable = getPoolFn();
    const pendingName = pendingStateSecretName(state.trim());
    const pendingValue = await encryptedSecretService.getSecretValue({
      name: pendingName,
      queryable,
      secretType,
    });
    const pendingState = safeJsonParse(pendingValue);
    if (!pendingState?.pinId || !pendingState?.clientIdentifier) {
      throw createApiError(400, 'plex_sign_in_state_invalid', 'Plex sign-in state is invalid or expired');
    }

    if (new Date(pendingState.expiresAt).getTime() <= getNow().getTime()) {
      await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });
      throw createApiError(400, 'plex_sign_in_state_expired', 'Plex sign-in state expired before completion');
    }

    const pin = await plexHttpClient.readPin({
      clientIdentifier: pendingState.clientIdentifier,
      pinId: pendingState.pinId,
    });
    const authToken = typeof pin?.authToken === 'string' ? pin.authToken.trim() : '';
    if (!authToken) {
      throw createApiError(400, 'plex_sign_in_not_claimed', 'Plex sign-in has not been claimed yet');
    }

    const currentUser = normalizeCurrentUserProfile(await plexHttpClient.fetchCurrentUser({
      accessToken: authToken,
      clientIdentifier: pendingState.clientIdentifier,
    }));

    if (currentUser.restricted) {
      await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });
      throw createApiError(403, 'plex_sign_in_restricted_account', 'Managed or restricted Plex accounts cannot sign in directly');
    }

    const linkedUser = await findLinkedPlexUser({
      plexId: currentUser.id,
      plexUuid: currentUser.uuid,
      queryable,
    });
    if (!linkedUser) {
      await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });
      throw createApiError(403, 'plex_sign_in_not_linked', 'This Plex account is not linked to a direct sign-in capable Harmoniarr user');
    }

    const { issuedSession, user } = await issueLinkedLogin({
      requestMetadata,
      summary: 'Plex direct sign-in succeeded',
      userId: linkedUser.id,
      eventType: 'plex_sign_in_succeeded',
    });

    await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });

    return {
      issuedSession,
      redirectTo: normalizeRedirectTarget(pendingState.redirectTo),
      user,
    };
  }

  return {
    completeSignIn,
    startSignIn,
  };
}
