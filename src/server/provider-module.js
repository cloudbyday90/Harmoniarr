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
import { createPlexHttpClient } from './integrations/plex/plex-http-client.js';
import { createPlexOwnerLinkService } from './integrations/plex/plex-owner-link-service.js';
import { createSpotifyOAuthService } from './integrations/spotify/spotify-oauth-service.js';
import { createYouTubeOAuthService } from './integrations/youtube/youtube-oauth-service.js';
import { createProviderHttpService } from './integrations/providers/provider-http-service.js';
import { createProviderClientResolverService } from './integrations/providers/provider-client-resolver-service.js';
import { createProviderCollectionAccessCheckService } from './integrations/providers/provider-collection-access-check-service.js';
import { createProviderStatusService } from './integrations/providers/provider-status-service.js';

export function createProviderModule({
  providerHttpService = createProviderHttpService(),
  appleMusicStatusService = createAppleMusicStatusService(),
  plexHttpClient = createPlexHttpClient(),
  plexOwnerLinkService = createPlexOwnerLinkService({ plexHttpClient }),
  spotifyOAuthService = createSpotifyOAuthService({ providerHttpService }),
  youtubeOAuthService = createYouTubeOAuthService({ providerHttpService }),
  providerStatusService = createProviderStatusService({ readers: {
    plex: queryable => plexOwnerLinkService.buildStatus(queryable),
    spotify: queryable => spotifyOAuthService.buildStatus(queryable),
    youtube: queryable => youtubeOAuthService.buildStatus(queryable),
    appleMusic: queryable => appleMusicStatusService.buildStatus(queryable),
  } }),
  providerClientResolverService = createProviderClientResolverService({ spotifyOAuthService, youtubeOAuthService, providerHttpService }),
  providerCollectionAccessCheckService = createProviderCollectionAccessCheckService({
    resolveProviderClient: providerClientResolverService.resolveProviderClient,
  }),
} = {}) {
  return {
    providerHttpService,
    providerStatusService,
    appleMusicStatusService,
    plexOwnerLinkService,
    spotifyOAuthService,
    youtubeOAuthService,
    providerCollectionAccessCheckService,
    routeDependencies: {
      checkProviderCollectionAccess: providerCollectionAccessCheckService.checkCollectionAccess,
      buildProviderStatuses: providerStatusService.buildStatuses,
      clearPlexLink: plexOwnerLinkService.clearLink,
      clearSpotifyAuthorization: spotifyOAuthService.clearAuthorization,
      clearYoutubeAuthorization: youtubeOAuthService.clearAuthorization,
      completePlexLink: plexOwnerLinkService.completeLink,
      completeSpotifyAuthorization: spotifyOAuthService.completeAuthorization,
      completeYoutubeAuthorization: youtubeOAuthService.completeAuthorization,
      startPlexLink: plexOwnerLinkService.startLink,
      startSpotifyAuthorization: spotifyOAuthService.startAuthorization,
      startYoutubeAuthorization: youtubeOAuthService.startAuthorization,
    },
  };
}
