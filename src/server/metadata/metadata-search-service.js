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

import { getPool } from '../database.js';
import {
  listAdminMonitoredMetadataArtists,
  listMonitoredMetadataArtists,
  searchMetadataArtists,
  searchMetadataReleaseGroups,
  searchMetadataReleases,
  searchMetadataReleasesByArtistAndTitle,
} from './metadata-repository.js';
import {
  normalizeSearchLimit,
  normalizeSearchText,
} from '../validators/metadata-search-validator.js';

function mapArtist(row) {
  return {
    id: row.id,
    name: row.name,
    sortName: row.sort_name,
    disambiguation: row.disambiguation,
    country: row.country,
    artistType: row.artist_type,
    source: {
      provider: row.source_provider,
      sourceArtistId: row.source_artist_id,
      musicbrainzArtistId: row.musicbrainz_artist_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}

function mapReleaseGroup(row) {
  return {
    id: row.id,
    artistId: row.metadata_artist_id,
    artistName: row.artist_name ?? null,
    title: row.title,
    primaryType: row.primary_type,
    secondaryTypes: row.secondary_types,
    firstReleaseDate: row.first_release_date,
    disambiguation: row.disambiguation,
    releaseCount: row.release_count ?? 0,
    source: {
      provider: row.source_provider,
      sourceReleaseGroupId: row.source_release_group_id,
      musicbrainzReleaseGroupId: row.musicbrainz_release_group_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}

function mapRelease(row) {
  return {
    id: row.id,
    releaseGroupId: row.metadata_release_group_id,
    artistId: row.metadata_artist_id ?? null,
    artistName: row.artist_name ?? null,
    releaseGroupTitle: row.release_group_title ?? null,
    title: row.title,
    status: row.status,
    releaseDate: row.release_date,
    country: row.country,
    barcode: row.barcode,
    disambiguation: row.disambiguation,
    trackCount: row.track_count,
    mediumCount: row.medium_count,
    source: {
      provider: row.source_provider,
      sourceReleaseId: row.source_release_id,
      musicbrainzReleaseId: row.musicbrainz_release_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}

export function createMetadataSearchService({
  pool = getPool(),
  searchArtistsQuery = searchMetadataArtists,
  listMonitoredArtistsQuery = listMonitoredMetadataArtists,
  searchReleaseGroupsQuery = searchMetadataReleaseGroups,
  searchReleasesByArtistAndTitleQuery = searchMetadataReleasesByArtistAndTitle,
  searchReleasesQuery = searchMetadataReleases,
} = {}) {
  async function searchArtists({ query, limit }) {
    const normalizedQuery = normalizeSearchText(query, 'query');
    const normalizedLimit = normalizeSearchLimit(limit);
    const results = await searchArtistsQuery({ query: normalizedQuery, limit: normalizedLimit }, pool);

    return {
      query: normalizedQuery,
      limit: normalizedLimit,
      results: results.map(mapArtist),
    };
  }

  async function searchReleaseGroups({ query, limit }) {
    const normalizedQuery = normalizeSearchText(query, 'query');
    const normalizedLimit = normalizeSearchLimit(limit);
    const results = await searchReleaseGroupsQuery({ query: normalizedQuery, limit: normalizedLimit }, pool);

    return {
      query: normalizedQuery,
      limit: normalizedLimit,
      results: results.map(mapReleaseGroup),
    };
  }

  async function searchReleases({ query, limit }) {
    const normalizedQuery = normalizeSearchText(query, 'query');
    const normalizedLimit = normalizeSearchLimit(limit);
    const results = await searchReleasesQuery({ query: normalizedQuery, limit: normalizedLimit }, pool);

    return {
      query: normalizedQuery,
      limit: normalizedLimit,
      results: results.map(mapRelease),
    };
  }

  async function searchReleasesByArtistAndTitle({ artistName, releaseTitle, limit }) {
    const normalizedArtistName = normalizeSearchText(artistName, 'artistName');
    const normalizedReleaseTitle = normalizeSearchText(releaseTitle, 'releaseTitle');
    const normalizedLimit = normalizeSearchLimit(limit);
    const results = await searchReleasesByArtistAndTitleQuery({
      artistName: normalizedArtistName,
      limit: normalizedLimit,
      releaseTitle: normalizedReleaseTitle,
    }, pool);

    return {
      artistName: normalizedArtistName,
      limit: normalizedLimit,
      releaseTitle: normalizedReleaseTitle,
      results: results.map(mapRelease),
    };
  }

  async function listMonitoredArtists({ limit } = {}) {
    const normalizedLimit = normalizeSearchLimit(limit, 25);
    const results = await listMonitoredArtistsQuery({ limit: normalizedLimit }, pool);

    return {
      limit: normalizedLimit,
      results: results.map((row) => ({
        id: row.musicbrainz_artist_id ?? String(row.id),
        localId: row.id,
        name: row.name,
        sortName: row.sort_name,
        disambiguation: row.disambiguation,
        country: row.country,
        type: row.artist_type,
        monitored: true,
      })),
    };
  }

  async function searchAll({ query, artistLimit = 5, releaseGroupLimit = 5, releaseLimit = 5 } = {}) {
    const normalizedQuery = normalizeSearchText(query, 'query');

    const [artists, releaseGroups, releases] = await Promise.all([
      searchArtists({ query: normalizedQuery, limit: artistLimit }),
      searchReleaseGroups({ query: normalizedQuery, limit: releaseGroupLimit }),
      searchReleases({ query: normalizedQuery, limit: releaseLimit }),
    ]);

    return {
      query: normalizedQuery,
      artists: artists.results,
      releaseGroups: releaseGroups.results,
      releases: releases.results,
    };
  }

  async function listAllMonitoredArtists({ search, sort, limit, offset } = {}) {
    return listAdminMonitoredMetadataArtists({ search, sort, limit, offset }, pool);
  }

  return {
    listAllMonitoredArtists,
    listMonitoredArtists,
    searchAll,
    searchArtists,
    searchReleaseGroups,
    searchReleasesByArtistAndTitle,
    searchReleases,
  };
}
