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

import { getPool } from '../../database.js';
import { loadSettings } from '../../settings.js';
import { createAppleMusicClient } from '../apple-music/apple-music-client.js';
import { createSpotifyClient } from '../spotify/spotify-client.js';
import { createSpotifyOAuthService } from '../spotify/spotify-oauth-service.js';
import { createYouTubeClient } from '../youtube/youtube-client.js';
import { createYouTubeOAuthService } from '../youtube/youtube-oauth-service.js';
import { createProviderCredentialsService } from './provider-credentials-service.js';

export function createProviderClientResolverService({
  createAppleMusicClientFn = createAppleMusicClient,
  createSpotifyClientFn = createSpotifyClient,
  createYouTubeClientFn = createYouTubeClient,
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  providerCredentialsService = createProviderCredentialsService(),
  spotifyOAuthService = createSpotifyOAuthService(),
  youtubeOAuthService = createYouTubeOAuthService({ providerCredentialsService }),
} = {}) {
  async function resolveProviderClient({ provider, requestPolicy = null, settings: suppliedSettings = null } = {}) {
    const settings = suppliedSettings ?? await loadSettingsFn();
    const providerSettings = settings.providers ?? {};
    const settingPrefix = { spotify: 'spotify', youtube: 'youtube', apple_music: 'appleMusic' }[provider];
    if (!settingPrefix) throw new Error('Unsupported provider');
    const result = { client: null, enabled: Boolean(providerSettings[`${settingPrefix}Enabled`]), configured: false, authMode: 'none' };
    if (!result.enabled) return result;
    const queryable = getPoolFn();
    const options = { requestTimeoutMs: providerSettings.requestTimeoutMs, ...(requestPolicy ? { requestPolicy } : {}) };
    try {
      if (provider === 'spotify' || provider === 'youtube') {
        result.authMode = 'oauth_user';
        const oauthService = provider === 'spotify' ? spotifyOAuthService : youtubeOAuthService;
        const token = await oauthService.resolveAccessToken(queryable, requestPolicy ? { requestPolicy } : {});
        if (token) {
          const createClient = provider === 'spotify' ? createSpotifyClientFn : createYouTubeClientFn;
          result.client = createClient({ ...options, accessTokenProvider: async () => token });
        } else if (provider === 'spotify') {
          result.authMode = 'client_credentials';
          const clientSecret = await providerCredentialsService.resolveSpotifyClientSecret(queryable);
          if (providerSettings.spotifyClientId && clientSecret) result.client = createSpotifyClientFn({ ...options, clientId: providerSettings.spotifyClientId, clientSecret });
        } else {
          result.authMode = 'api_key';
          const apiKey = await providerCredentialsService.resolveYoutubeApiKey(queryable);
          if (apiKey) result.client = createYouTubeClientFn({ ...options, apiKey });
        }
      } else {
        result.authMode = 'developer_token';
        const privateKey = await providerCredentialsService.resolveAppleMusicPrivateKey(queryable);
        if (providerSettings.appleMusicTeamId && providerSettings.appleMusicKeyId && privateKey) result.client = createAppleMusicClientFn({
          ...options, keyId: providerSettings.appleMusicKeyId, privateKey, teamId: providerSettings.appleMusicTeamId,
        });
      }
      result.configured = Boolean(result.client);
      if (!result.configured) result.authMode = 'none';
      return result;
    } catch (error) {
      error.providerAuthMode = result.authMode;
      throw error;
    }
  }

  async function resolveProviderClients() {
    const settings = await loadSettingsFn();
    const providerSettings = settings.providers ?? {};
    const clients = { settings: {
      appleMusicStorefront: providerSettings.appleMusicStorefront ?? 'us',
      playlistExpansionPolicy: providerSettings.playlistExpansionPolicy ?? 'bounded',
    } };
    for (const provider of ['spotify', 'youtube', 'apple_music']) {
      const result = await resolveProviderClient({ provider, settings });
      if (result.client) clients[provider === 'apple_music' ? 'appleMusic' : provider] = result.client;
    }
    return clients;
  }

  return { resolveProviderClient, resolveProviderClients };
}
