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
import { loadSettings } from '../../settings.js';
import { recordAuditEvent } from '../../audit.js';
import { getPool } from '../../database.js';

const spotifyAccountsBaseUrl = 'https://accounts.spotify.com';
const defaultScopes = ['playlist-read-private', 'playlist-read-collaborative'];

export function createSpotifyOAuthService({
  encryptedSecretService = createEncryptedSecretService(),
  fetchFn = globalThis.fetch,
  getNow = () => new Date(),
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  return createOAuthPKCEService({
    authorizeUrl: `${spotifyAccountsBaseUrl}/authorize`,
    callbackPath: '/api/v1/providers/spotify/oauth/callback',
    clientIdSettingKey: 'spotifyClientId',
    defaultScopes,
    encryptedSecretService,
    fetchFn,
    getNow,
    getPoolFn,
    loadSettingsFn,
    providerLabel: 'Spotify',
    providerPrefix: 'spotify',
    recordAuditEventFn,
    resolveClientCredentials: async ({ settings }) => {
      const clientId = settings.providers?.spotifyClientId;
      if (!clientId) {
        throw createApiError(400, 'spotify_client_id_required', 'Configure providers.spotifyClientId before starting Spotify OAuth');
      }

      return { clientId };
    },
    tokenUrl: `${spotifyAccountsBaseUrl}/api/token`,
  });
}
