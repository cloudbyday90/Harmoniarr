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

import { createMusicBrainzClient } from '../integrations/musicbrainz/musicbrainz-client.js';
import {
  normalizeSearchLimit,
  normalizeSearchText,
} from '../validators/metadata-search-validator.js';
import { observeMusicBrainzProviderCall } from './musicbrainz-provider-health.js';

function buildArtistCredit(artistCredit) {
  if (!Array.isArray(artistCredit)) {
    return null;
  }

  const text = artistCredit
    .map((credit) => `${credit.name ?? credit.artist?.name ?? ''}${credit.joinphrase ?? ''}`)
    .join('')
    .trim();

  return text || null;
}

function escapeLucenePhrase(value) {
  return value.replace(/([-+!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1');
}

function quoteLucene(value) {
  return `"${escapeLucenePhrase(value)}"`;
}

function toScore(value) {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function normalizeArtistSearchResult(artist) {
  return {
    id: artist.id,
    sourceProvider: 'musicbrainz',
    musicbrainzArtistId: artist.id,
    name: artist.name,
    sortName: artist['sort-name'] ?? null,
    disambiguation: artist.disambiguation ?? null,
    country: artist.country ?? null,
    type: artist.type ?? null,
    score: toScore(artist.score),
    area: artist.area
      ? {
          id: artist.area.id,
          name: artist.area.name,
          sortName: artist.area['sort-name'] ?? null,
        }
      : null,
    lifeSpan: artist['life-span']
      ? {
          begin: artist['life-span'].begin ?? null,
          end: artist['life-span'].end ?? null,
          ended: artist['life-span'].ended ?? null,
        }
      : null,
  };
}

function normalizeReleaseSearchResult(release) {
  return {
    id: release.id,
    sourceProvider: 'musicbrainz',
    musicbrainzReleaseId: release.id,
    title: release.title,
    status: release.status ?? null,
    date: release.date ?? null,
    country: release.country ?? null,
    barcode: release.barcode ?? null,
    packaging: release.packaging ?? null,
    score: toScore(release.score),
    artistCredit: buildArtistCredit(release['artist-credit']),
    artist: Array.isArray(release['artist-credit']) && release['artist-credit'][0]?.artist
      ? {
          id: release['artist-credit'][0].artist.id,
          name: release['artist-credit'][0].artist.name,
          sortName: release['artist-credit'][0].artist['sort-name'] ?? null,
        }
      : null,
    releaseGroup: release['release-group']
      ? {
          id: release['release-group'].id,
          primaryType: release['release-group']['primary-type'] ?? null,
          secondaryTypes: Array.isArray(release['release-group']['secondary-types'])
            ? release['release-group']['secondary-types']
            : [],
        }
      : null,
    trackCount: release['track-count'] ?? null,
    mediaCount: Array.isArray(release.media) ? release.media.length : null,
  };
}

export function createMusicBrainzSearchService({
  musicBrainzClient = createMusicBrainzClient(),
  providerHealthRecorder = null,
} = {}) {
  async function checkProviderHealth() {
    await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.searchArtists({
        query: 'a',
        limit: 1,
        dismax: true,
      }),
    );

    return {
      provider: 'musicbrainz',
      status: 'healthy',
      message: 'MusicBrainz lookups are reachable.',
    };
  }

  async function searchArtists({ query, limit }) {
    const normalizedQuery = normalizeSearchText(query, 'query');
    const normalizedLimit = normalizeSearchLimit(limit);

    const payload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.searchArtists({
        query: normalizedQuery,
        limit: normalizedLimit,
        dismax: true,
      }),
    );

    return {
      query: normalizedQuery,
      limit: normalizedLimit,
      total: payload.count ?? 0,
      offset: payload.offset ?? 0,
      results: Array.isArray(payload.artists)
        ? payload.artists.map(normalizeArtistSearchResult)
        : [],
    };
  }

  async function searchReleases({ artist, release, limit }) {
    const normalizedRelease = normalizeSearchText(release, 'release');
    const normalizedArtist = artist == null || artist === ''
      ? null
      : normalizeSearchText(artist, 'artist');
    const normalizedLimit = normalizeSearchLimit(limit);

    const queryParts = [
      `release:${quoteLucene(normalizedRelease)}`,
    ];

    if (normalizedArtist) {
      queryParts.unshift(`artist:${quoteLucene(normalizedArtist)}`);
    }

    const payload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.searchReleases({
        query: queryParts.join(' AND '),
        limit: normalizedLimit,
      }),
    );

    return {
      query: {
        artist: normalizedArtist,
        release: normalizedRelease,
      },
      limit: normalizedLimit,
      total: payload.count ?? 0,
      offset: payload.offset ?? 0,
      results: Array.isArray(payload.releases)
        ? payload.releases.map(normalizeReleaseSearchResult)
        : [],
    };
  }

  return {
    checkProviderHealth,
    searchArtists,
    searchReleases,
  };
}
