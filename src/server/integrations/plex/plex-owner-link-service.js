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
import { createApiError } from '../../auth.js';
import { recordAuditEvent } from '../../audit.js';
import { getPool } from '../../database.js';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { loadSettings } from '../../settings.js';
import { createPlexHttpClient } from './plex-http-client.js';

const secretType = 'integration_oauth';
const pendingStateTtlMs = 10 * 60 * 1000;
const tokenSecretName = 'providers.plex.link.token';
const clientIdentifierSecretName = 'providers.plex.link.client_identifier';
const pendingStatePrefix = 'providers.plex.link.pending.';
const plexAuthBaseUrl = 'https://app.plex.tv/auth#?';

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

function buildForwardUrl(baseUrl, state) {
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    return null;
  }

  const url = new URL('/api/v1/providers/plex/link/callback', baseUrl);
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
    id: profile?.id != null ? String(profile.id) : null,
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

export function createPlexOwnerLinkService({
  encryptedSecretService = createEncryptedSecretService(),
  getNow = () => new Date(),
  getPoolFn = getPool,
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
      linkedAt: record?.metadata?.linkedAt ?? null,
      linkedUserEmail: record?.metadata?.linkedUserEmail ?? null,
      linkedUserId: record?.metadata?.linkedUserId ?? null,
      linkedUserTitle: record?.metadata?.linkedUserTitle ?? null,
      linkedUsername: record?.metadata?.linkedUsername ?? null,
      linkedUserUuid: record?.metadata?.linkedUserUuid ?? null,
      thumbUrl: record?.metadata?.thumbUrl ?? null,
      updatedAt: metadata.updatedAt ?? null,
    };
  }

  async function startLink({ actorUserId = null, requestMetadata = {} } = {}) {
    const settings = await loadSettingsFn();
    const forwardBaseUrl = settings.system?.baseUrl ?? requestMetadata.origin ?? '';
    const state = randomUUID();
    const forwardUrl = buildForwardUrl(forwardBaseUrl, state);
    if (!forwardUrl) {
      throw createApiError(400, 'plex_link_base_url_required', 'Configure system.baseUrl before starting Plex account linking');
    }

    const queryable = getPoolFn();
    const clientIdentifier = await resolveClientIdentifier(queryable);
    const pin = await plexHttpClient.createPin({ clientIdentifier });
    const expiresAt = new Date(getNow().getTime() + pendingStateTtlMs).toISOString();
    const pinCode = typeof pin?.code === 'string' ? pin.code.trim() : '';
    const pinId = pin?.id != null ? String(pin.id) : '';
    if (!pinCode || !pinId) {
      throw createApiError(502, 'plex_pin_create_failed', 'Plex PIN creation did not return a usable id and code');
    }

    await encryptedSecretService.setSecretValue({
      metadata: { actorUserId, expiresAt, pinId },
      name: pendingStateSecretName(state),
      plaintextValue: JSON.stringify({
        actorUserId,
        clientIdentifier,
        expiresAt,
        pinId,
      }),
      queryable,
      secretType,
    });

    await recordAuditEventFn({
      actorType: actorUserId ? 'user' : 'system',
      actorUserId,
      details: {
        expiresAt,
        state,
      },
      entityType: 'provider_link',
      eventType: 'plex_owner_link_started',
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: 'Plex owner account linking started',
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
    };
  }

  async function completeLink({ requestMetadata = {}, state } = {}) {
    if (typeof state !== 'string' || state.trim().length === 0) {
      throw createApiError(400, 'validation_error', 'Plex link callback requires state');
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
      throw createApiError(400, 'plex_link_state_invalid', 'Plex link state is invalid or expired');
    }

    if (new Date(pendingState.expiresAt).getTime() <= getNow().getTime()) {
      await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });
      throw createApiError(400, 'plex_link_state_expired', 'Plex link state expired before completion');
    }

    const pin = await plexHttpClient.readPin({
      clientIdentifier: pendingState.clientIdentifier,
      pinId: pendingState.pinId,
    });
    const authToken = typeof pin?.authToken === 'string' ? pin.authToken.trim() : '';
    if (!authToken) {
      throw createApiError(400, 'plex_link_not_claimed', 'Plex account link has not been claimed yet');
    }

    const currentUser = normalizeCurrentUserProfile(await plexHttpClient.fetchCurrentUser({
      accessToken: authToken,
      clientIdentifier: pendingState.clientIdentifier,
    }));

    await encryptedSecretService.setSecretValue({
      metadata: {
        linkedAt: getNow().toISOString(),
        linkedUserEmail: currentUser.email,
        linkedUserId: currentUser.id,
        linkedUserTitle: currentUser.title,
        linkedUsername: currentUser.username,
        linkedUserUuid: currentUser.uuid,
        thumbUrl: currentUser.thumbUrl,
      },
      name: tokenSecretName,
      plaintextValue: JSON.stringify({
        accessToken: authToken,
        clientIdentifier: pendingState.clientIdentifier,
        linkedAt: getNow().toISOString(),
        user: currentUser,
      }),
      queryable,
      secretType,
    });
    await encryptedSecretService.clearSecretValue({ name: pendingName, queryable, secretType });

    await recordAuditEventFn({
      actorType: pendingState.actorUserId ? 'user' : 'system',
      actorUserId: pendingState.actorUserId ?? null,
      details: {
        linkedUserEmail: currentUser.email,
        linkedUserId: currentUser.id,
        linkedUserTitle: currentUser.title,
        linkedUserUuid: currentUser.uuid,
      },
      entityType: 'provider_link',
      eventType: 'plex_owner_link_completed',
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: 'Plex owner account linked',
      userAgent: requestMetadata.userAgent ?? null,
    });

    return {
      provider: 'plex',
      status: await buildStatus(queryable),
    };
  }

  async function clearLink({ actorUserId = null, requestMetadata = {} } = {}) {
    await encryptedSecretService.clearSecretValue({
      name: tokenSecretName,
      secretType,
    });

    await recordAuditEventFn({
      actorType: actorUserId ? 'user' : 'system',
      actorUserId,
      details: {},
      entityType: 'provider_link',
      eventType: 'plex_owner_link_cleared',
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: 'Plex owner account link cleared',
      userAgent: requestMetadata.userAgent ?? null,
    });

    return {
      provider: 'plex',
      status: await buildStatus(),
    };
  }

  async function resolveLinkedAccessToken(queryable = getPoolFn()) {
    const tokenValue = await encryptedSecretService.getSecretValue({
      name: tokenSecretName,
      queryable,
      secretType,
    });
    const tokenPayload = safeJsonParse(tokenValue);
    if (!tokenPayload?.accessToken || !tokenPayload?.clientIdentifier) {
      return null;
    }

    return {
      accessToken: tokenPayload.accessToken,
      clientIdentifier: tokenPayload.clientIdentifier,
      linkedUser: tokenPayload.user ?? null,
    };
  }

  return {
    buildStatus,
    clearLink,
    completeLink,
    resolveLinkedAccessToken,
    startLink,
  };
}
