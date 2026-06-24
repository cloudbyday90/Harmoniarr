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
import { createMetadataMonitoredArtistStore } from './metadata-monitored-artist-store.js';
import { createMetadataReleaseDetectionService } from './metadata-release-detection-service.js';
import {
  getMetadataArtistById,
  getMetadataArtistByMusicBrainzArtistId,
  getMetadataReleaseById,
  getMetadataReleaseByMusicBrainzReleaseId,
  getMetadataReleaseGroupById,
  getMetadataReleaseGroupByMusicBrainzReleaseGroupId,
  listMetadataMediaByReleaseId,
  listMetadataArtistAliases,
  listMetadataReleaseGroupsByArtistId,
  listMetadataReleasesByArtistId,
  listMetadataReleasesByReleaseGroupId,
  listMetadataTracksByReleaseId,
} from './metadata-repository.js';

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function mapArtist(row) {
  return {
    id: row.id,
    name: row.name,
    sortName: row.sort_name,
    disambiguation: row.disambiguation,
    country: row.country,
    artistType: row.artist_type,
    beginDate: row.begin_date,
    endDate: row.end_date,
    source: {
      provider: row.source_provider,
      sourceArtistId: row.source_artist_id,
      musicbrainzArtistId: row.musicbrainz_artist_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}

function mapAlias(row) {
  return {
    id: row.id,
    alias: row.alias,
    locale: row.locale,
    isPrimary: row.is_primary,
  };
}

function mapReleaseGroup(row) {
  return {
    id: row.id,
    artistId: row.metadata_artist_id,
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
    releaseGroupTitle: row.release_group_title ?? null,
    releaseGroupMusicBrainzId: row.release_group_musicbrainz_release_group_id ?? null,
    title: row.title,
    status: row.status,
    releaseDate: row.release_date,
    country: row.country,
    barcode: row.barcode,
    disambiguation: row.disambiguation,
    trackCount: row.track_count,
    mediumCount: row.medium_count,
    isCanonical: row.is_canonical ?? false,
    source: {
      provider: row.source_provider,
      sourceReleaseId: row.source_release_id,
      musicbrainzReleaseId: row.musicbrainz_release_id,
    },
    fetchedAt: row.fetched_at,
    updatedAt: row.updated_at,
  };
}

function mapMedium(row, tracks) {
  return {
    id: row.id,
    releaseId: row.metadata_release_id,
    position: row.position,
    title: row.title,
    format: row.format,
    trackCount: row.track_count,
    updatedAt: row.updated_at,
    tracks,
  };
}

function mapRecording(row) {
  if (!row.recording_id) {
    return null;
  }

  return {
    id: row.recording_id,
    title: row.recording_title,
    lengthMs: row.recording_length_ms,
    artistCredit: row.recording_artist_credit,
    source: {
      provider: row.recording_source_provider,
      sourceRecordingId: row.recording_source_recording_id,
      musicbrainzRecordingId: row.recording_musicbrainz_recording_id,
    },
    fetchedAt: row.recording_fetched_at,
    updatedAt: row.recording_updated_at,
  };
}

function mapTrack(row) {
  return {
    id: row.id,
    mediumId: row.metadata_medium_id,
    position: row.position,
    numberText: row.number_text,
    title: row.title,
    lengthMs: row.length_ms,
    artistCredit: row.artist_credit,
    updatedAt: row.updated_at,
    recording: mapRecording(row),
  };
}

export function createMetadataReadService({
  pool = getPool(),
  metadataReleaseDetectionService = createMetadataReleaseDetectionService(),
  metadataMonitoredArtistStore = createMetadataMonitoredArtistStore({ getPoolFn: () => pool }),
} = {}) {
  async function buildArtistPayload(artist) {
    if (!artist) {
      throw createMetadataNotFoundError('artist', 'unknown');
    }

    const [aliases, detectionEventsPage, monitoring, releaseGroups, releases] = await Promise.all([
      listMetadataArtistAliases(artist.id, pool),
      metadataReleaseDetectionService.listDetectionEventsPageForArtist({ metadataArtistId: artist.id }),
      metadataMonitoredArtistStore.getArtistMonitoringStatus(artist.id),
      listMetadataReleaseGroupsByArtistId(artist.id, pool),
      listMetadataReleasesByArtistId(artist.id, pool),
    ]);

    return {
      artist: mapArtist(artist),
      aliases: aliases.map(mapAlias),
      detectionEvents: detectionEventsPage.entries,
      detectionEventsPageInfo: detectionEventsPage.pageInfo,
      monitoring,
      releaseGroups: releaseGroups.map(mapReleaseGroup),
      releases: releases.map(mapRelease),
    };
  }

  async function getArtist({ artistId }) {
    const artist = await getMetadataArtistById(artistId, pool);
    if (!artist) {
      throw createMetadataNotFoundError('artist', artistId);
    }

    return buildArtistPayload(artist);
  }

  async function getArtistByMusicBrainzId({ musicBrainzArtistId }) {
    const artist = await getMetadataArtistByMusicBrainzArtistId(musicBrainzArtistId, pool);
    if (!artist) {
      throw createMetadataNotFoundError('artist', musicBrainzArtistId);
    }

    return buildArtistPayload(artist);
  }

  async function getArtistDetectionEvents({ artistId, before = null, limit = 10 } = {}) {
    const artist = await getMetadataArtistById(artistId, pool);
    if (!artist) {
      throw createMetadataNotFoundError('artist', artistId);
    }

    return metadataReleaseDetectionService.listDetectionEventsPageForArtist({
      before,
      limit,
      metadataArtistId: artist.id,
    });
  }

  async function buildReleaseGroupPayload(releaseGroup) {
    if (!releaseGroup) {
      throw createMetadataNotFoundError('release group', 'unknown');
    }

    const [artist, releases] = await Promise.all([
      getMetadataArtistById(releaseGroup.metadata_artist_id, pool),
      listMetadataReleasesByReleaseGroupId(releaseGroup.id, pool),
    ]);

    if (!artist) {
      throw createMetadataNotFoundError('artist', releaseGroup.metadata_artist_id);
    }

    return {
      artist: mapArtist(artist),
      releaseGroup: mapReleaseGroup(releaseGroup),
      releases: releases.map(mapRelease),
    };
  }

  async function getReleaseGroup({ releaseGroupId }) {
    const releaseGroup = await getMetadataReleaseGroupById(releaseGroupId, pool);
    if (!releaseGroup) {
      throw createMetadataNotFoundError('release group', releaseGroupId);
    }

    return buildReleaseGroupPayload(releaseGroup);
  }

  async function getReleaseGroupByMusicBrainzId({ musicBrainzReleaseGroupId }) {
    const releaseGroup = await getMetadataReleaseGroupByMusicBrainzReleaseGroupId(
      musicBrainzReleaseGroupId,
      pool,
    );
    if (!releaseGroup) {
      throw createMetadataNotFoundError('release group', musicBrainzReleaseGroupId);
    }

    return buildReleaseGroupPayload(releaseGroup);
  }

  async function buildReleasePayload(release) {
    if (!release) {
      throw createMetadataNotFoundError('release', 'unknown');
    }

    const [releaseGroup, mediaRows, trackRows] = await Promise.all([
      getMetadataReleaseGroupById(release.metadata_release_group_id, pool),
      listMetadataMediaByReleaseId(release.id, pool),
      listMetadataTracksByReleaseId(release.id, pool),
    ]);

    if (!releaseGroup) {
      throw createMetadataNotFoundError('release group', release.metadata_release_group_id);
    }

    const artist = await getMetadataArtistById(releaseGroup.metadata_artist_id, pool);
    if (!artist) {
      throw createMetadataNotFoundError('artist', releaseGroup.metadata_artist_id);
    }

    const tracksByMediumId = new Map();
    for (const trackRow of trackRows) {
      const mediumTracks = tracksByMediumId.get(trackRow.metadata_medium_id) ?? [];
      mediumTracks.push(mapTrack(trackRow));
      tracksByMediumId.set(trackRow.metadata_medium_id, mediumTracks);
    }

    return {
      artist: mapArtist(artist),
      releaseGroup: mapReleaseGroup(releaseGroup),
      release: mapRelease(release),
      media: mediaRows.map((mediumRow) => mapMedium(
        mediumRow,
        tracksByMediumId.get(mediumRow.id) ?? [],
      )),
    };
  }

  async function getRelease({ releaseId }) {
    const release = await getMetadataReleaseById(releaseId, pool);
    if (!release) {
      throw createMetadataNotFoundError('release', releaseId);
    }

    return buildReleasePayload(release);
  }

  async function getReleaseByMusicBrainzId({ musicBrainzReleaseId }) {
    const release = await getMetadataReleaseByMusicBrainzReleaseId(musicBrainzReleaseId, pool);
    if (!release) {
      throw createMetadataNotFoundError('release', musicBrainzReleaseId);
    }

    return buildReleasePayload(release);
  }

  return {
    getArtistDetectionEvents,
    getArtist,
    getArtistByMusicBrainzId,
    getReleaseGroup,
    getReleaseGroupByMusicBrainzId,
    getRelease,
    getReleaseByMusicBrainzId,
  };
}