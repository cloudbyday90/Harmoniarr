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
  async function resolveProviderClients() {
    const settings = await loadSettingsFn();
    const providerSettings = settings.providers ?? {};
    const queryable = getPoolFn();
    const clients = {
      settings: {
        appleMusicStorefront: providerSettings.appleMusicStorefront ?? 'us',
        playlistExpansionPolicy: providerSettings.playlistExpansionPolicy ?? 'bounded',
      },
    };

    if (providerSettings.spotifyEnabled) {
      const spotifyAccessToken = await spotifyOAuthService.resolveAccessToken(queryable);
      if (spotifyAccessToken) {
        clients.spotify = createSpotifyClientFn({
          accessTokenProvider: async () => spotifyAccessToken,
          requestTimeoutMs: providerSettings.requestTimeoutMs,
        });
      } else {
        const clientSecret = await providerCredentialsService.resolveSpotifyClientSecret(queryable);
        if (providerSettings.spotifyClientId && clientSecret) {
          clients.spotify = createSpotifyClientFn({
            clientId: providerSettings.spotifyClientId,
            clientSecret,
            requestTimeoutMs: providerSettings.requestTimeoutMs,
          });
        }
      }
    }

    if (providerSettings.youtubeEnabled) {
      const youtubeAccessToken = await youtubeOAuthService.resolveAccessToken(queryable);
      if (youtubeAccessToken) {
        clients.youtube = createYouTubeClientFn({
          accessTokenProvider: async () => youtubeAccessToken,
          requestTimeoutMs: providerSettings.requestTimeoutMs,
        });
      } else {
        const apiKey = await providerCredentialsService.resolveYoutubeApiKey(queryable);
        if (apiKey) {
          clients.youtube = createYouTubeClientFn({
            apiKey,
            requestTimeoutMs: providerSettings.requestTimeoutMs,
          });
        }
      }
    }

    if (providerSettings.appleMusicEnabled) {
      const privateKey = await providerCredentialsService.resolveAppleMusicPrivateKey(queryable);
      if (providerSettings.appleMusicTeamId && providerSettings.appleMusicKeyId && privateKey) {
        clients.appleMusic = createAppleMusicClientFn({
          keyId: providerSettings.appleMusicKeyId,
          privateKey,
          requestTimeoutMs: providerSettings.requestTimeoutMs,
          teamId: providerSettings.appleMusicTeamId,
        });
      }
    }

    return clients;
  }

  return {
    resolveProviderClients,
  };
}
