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
import { readLinkedPlexLoginUser } from '../../linked-login-service.js';
import { createPlexCallbackStateService } from './plex-callback-state-service.js';
import { normalizePlexRedirect as normalizeRedirectTarget, hashPlexBrowserBinding } from './plex-callback-policy.js';
import { loadSettings } from '../../settings.js';
import { createPlexHttpClient } from './plex-http-client.js';

const plexAuthBaseUrl = 'https://app.plex.tv/auth#?';
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
  callbackStateService = createPlexCallbackStateService(),
  issueLinkedLogin = loginLinkedUser,
  findLinkedUserFn = readLinkedPlexLoginUser,
  loadSettingsFn = loadSettings,
  plexHttpClient = createPlexHttpClient(),
} = {}) {
  async function startSignIn({ redirectTo = null, requestMetadata = {}, browserBinding } = {}) {
    hashPlexBrowserBinding(browserBinding);
    const settings = await loadSettingsFn();
    const forwardBaseUrl = settings.system?.baseUrl ?? requestMetadata.origin ?? '';
    const state = randomUUID();
    const forwardUrl = buildForwardUrl(forwardBaseUrl, state);
    if (!forwardUrl) {
      throw createApiError(400, 'plex_sign_in_base_url_required', 'Configure system.baseUrl before starting Plex sign-in');
    }

    const clientIdentifier = await callbackStateService.resolveClientIdentifier();
    const pin = await plexHttpClient.createPin({ clientIdentifier });
    const pinCode = typeof pin?.code === 'string' ? pin.code.trim() : '';
    const pinId = pin?.id != null ? String(pin.id) : '';
    if (!pinCode || !pinId || pinCode.length > 256 || pinId.length > 256) {
      throw createApiError(502, 'plex_sign_in_pin_create_failed', 'Plex PIN creation did not return a usable id and code');
    }

    const normalizedRedirectTo = normalizeRedirectTarget(redirectTo);
    const expiresAt = await callbackStateService.create({ state, browserBinding, clientIdentifier, pinId,
      redirectTo: normalizedRedirectTo, requestMetadata });

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

  async function completeSignIn({ requestMetadata = {}, state, browserBinding } = {}) {
    const pendingState = await callbackStateService.read({ state, browserBinding });
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
      throw createApiError(403, 'plex_sign_in_restricted_account', 'Managed or restricted Plex accounts cannot sign in directly');
    }

    const linkedUser = await findLinkedUserFn({
      plexId: currentUser.id,
      plexUuid: currentUser.uuid,
    });
    if (!linkedUser) {
      throw createApiError(403, 'plex_sign_in_not_linked', 'This Plex account is not linked to a direct sign-in capable Harmoniarr user');
    }

    const { issuedSession, user } = await issueLinkedLogin({
      requestMetadata,
      userId: linkedUser.id,
      provider: 'plex',
      subject: linkedUser.auth_subject,
      callbackState: pendingState.proof,
    });

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
