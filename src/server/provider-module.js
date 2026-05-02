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

import { createAppleMusicStatusService } from './integrations/apple-music/apple-music-status-service.js';
import { createSpotifyOAuthService } from './integrations/spotify/spotify-oauth-service.js';
import { createYouTubeOAuthService } from './integrations/youtube/youtube-oauth-service.js';

export function createProviderModule({
  appleMusicStatusService = createAppleMusicStatusService(),
  spotifyOAuthService = createSpotifyOAuthService(),
  youtubeOAuthService = createYouTubeOAuthService(),
} = {}) {
  return {
    appleMusicStatusService,
    spotifyOAuthService,
    youtubeOAuthService,
    routeDependencies: {
      buildAppleMusicStatus: appleMusicStatusService.buildStatus,
      buildSpotifyOAuthStatus: spotifyOAuthService.buildStatus,
      buildYoutubeOAuthStatus: youtubeOAuthService.buildStatus,
      clearSpotifyAuthorization: spotifyOAuthService.clearAuthorization,
      clearYoutubeAuthorization: youtubeOAuthService.clearAuthorization,
      completeSpotifyAuthorization: spotifyOAuthService.completeAuthorization,
      completeYoutubeAuthorization: youtubeOAuthService.completeAuthorization,
      startSpotifyAuthorization: spotifyOAuthService.startAuthorization,
      startYoutubeAuthorization: youtubeOAuthService.startAuthorization,
    },
  };
}
