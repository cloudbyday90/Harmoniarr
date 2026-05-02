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
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { createOAuthPKCEService } from '../providers/oauth-pkce-service.js';
import { createProviderCredentialsService } from '../providers/provider-credentials-service.js';
import { getPool } from '../../database.js';
import { loadSettings } from '../../settings.js';
import { recordAuditEvent } from '../../audit.js';

const googleAuthorizeUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
const googleTokenUrl = 'https://oauth2.googleapis.com/token';
const googleRevokeUrl = 'https://oauth2.googleapis.com/revoke';
const defaultScopes = ['https://www.googleapis.com/auth/youtube.readonly'];

async function revokeGoogleToken(accessToken, fetchFn = globalThis.fetch) {
  await fetchFn(googleRevokeUrl, {
    body: new URLSearchParams({ token: accessToken }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
}

export function createYouTubeOAuthService({
  encryptedSecretService = createEncryptedSecretService(),
  fetchFn = globalThis.fetch,
  getNow = () => new Date(),
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  providerCredentialsService = createProviderCredentialsService(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function resolveClientCredentials({ settings, queryable }) {
    const clientId = settings.providers?.youtubeClientId;
    if (!clientId) {
      throw createApiError(400, 'youtube_client_id_required', 'Configure providers.youtubeClientId before starting YouTube OAuth');
    }

    const clientSecret = await providerCredentialsService.resolveYoutubeClientSecret(queryable);
    if (!clientSecret) {
      throw createApiError(400, 'youtube_client_secret_required', 'Configure providers.youtubeClientSecret before starting YouTube OAuth');
    }

    return {
      clientId,
      extraAuthParams: {
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: 'consent',
      },
      extraRefreshParams: { client_secret: clientSecret },
      extraTokenParams: { client_secret: clientSecret },
    };
  }

  return createOAuthPKCEService({
    authorizeUrl: googleAuthorizeUrl,
    callbackPath: '/api/v1/providers/youtube/oauth/callback',
    clientIdSettingKey: 'youtubeClientId',
    defaultScopes,
    encryptedSecretService,
    fetchFn,
    getNow,
    getPoolFn,
    loadSettingsFn,
    providerLabel: 'YouTube',
    providerPrefix: 'youtube',
    recordAuditEventFn,
    resolveClientCredentials,
    revokeTokenBeforeClear: async (accessToken) => {
      await revokeGoogleToken(accessToken, fetchFn);
    },
    tokenUrl: googleTokenUrl,
  });
}
