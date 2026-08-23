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

import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { createJsonTestApp } from './http-test-helpers.js';

const defaultSession = Object.freeze({
  appUserId: 'artist-detail-cache-route-test-user',
  csrfToken: 'artist-detail-cache-route-test-csrf',
  csrfTokenHash: 'artist-detail-cache-route-test-csrf-hash',
});

function assertFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`${label} must be a function`);
  }
}

/**
 * Registers only the dependencies needed to exercise the two authenticated
 * Artist Detail provider routes through their production route contracts.
 */
export function createArtistDetailCacheRouteTestApp({
  browseMusicBrainzArtistReleaseGroups,
  getSimilarArtists,
  requireSession = async () => defaultSession,
} = {}) {
  assertFunction(browseMusicBrainzArtistReleaseGroups, 'browseMusicBrainzArtistReleaseGroups');
  assertFunction(getSimilarArtists, 'getSimilarArtists');
  assertFunction(requireSession, 'requireSession');

  return createJsonTestApp((app) => {
    registerMetadataRoutes(app, {
      browseMusicBrainzArtistReleaseGroups,
      getSimilarArtists,
      requireSession,
    });
  });
}
