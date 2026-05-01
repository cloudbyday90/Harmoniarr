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

import { recordAuditEvent } from '../audit.js';
import { createMusicBrainzClient } from '../integrations/musicbrainz/musicbrainz-client.js';
import {
  normalizeMusicBrainzArtist,
  normalizeMusicBrainzReleaseGroup,
  normalizeMusicBrainzReleaseGraph,
} from '../integrations/musicbrainz/musicbrainz-normalizer.js';
import { createMetadataService } from './metadata-service.js';
import { observeMusicBrainzProviderCall } from './musicbrainz-provider-health.js';

function resolvePrimaryArtistId(releasePayload) {
  if (!Array.isArray(releasePayload?.['artist-credit'])) {
    return null;
  }

  const artistEntry = releasePayload['artist-credit'].find((entry) => entry?.artist?.id);
  return artistEntry?.artist?.id ?? null;
}

export function createMusicBrainzImportService({
  metadataService = createMetadataService(),
  musicBrainzClient = createMusicBrainzClient(),
  providerHealthRecorder = null,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function importArtistById({ artistId, actorUserId = null, requestMetadata = null }) {
    const artistPayload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.lookupArtist({ artistId, includeAliases: true }),
    );
    const normalizedArtist = normalizeMusicBrainzArtist({
      artist: artistPayload,
    });

    const storedArtist = await metadataService.storeArtist(normalizedArtist);

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      eventType: 'metadata_musicbrainz_artist_imported',
      summary: 'MusicBrainz artist imported',
      entityType: 'metadata_artist',
      entityId: storedArtist.id,
      details: {
        sourceProvider: 'musicbrainz',
        musicbrainzArtistId: artistId,
        metadataArtistId: storedArtist.id,
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      artist: storedArtist,
      source: {
        provider: 'musicbrainz',
        musicbrainzArtistId: artistId,
      },
    };
  }

  async function importReleaseGroupById({ releaseGroupId, actorUserId = null, requestMetadata = null }) {
    const releaseGroupPayload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.lookupReleaseGroup({ releaseGroupId }),
    );
    const primaryArtistId = resolvePrimaryArtistId(releaseGroupPayload);
    const artistDetails = primaryArtistId
      ? await observeMusicBrainzProviderCall(
          providerHealthRecorder,
          () => musicBrainzClient.lookupArtist({ artistId: primaryArtistId, includeAliases: true }),
        )
      : null;

    const normalizedReleaseGroup = normalizeMusicBrainzReleaseGroup({
      releaseGroup: releaseGroupPayload,
      artistDetails,
    });

    const stored = await metadataService.storeReleaseGroup(normalizedReleaseGroup);

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      eventType: 'metadata_musicbrainz_release_group_imported',
      summary: 'MusicBrainz release group imported',
      entityType: 'metadata_release_group',
      entityId: stored.releaseGroup.id,
      details: {
        sourceProvider: 'musicbrainz',
        musicbrainzArtistId: primaryArtistId,
        musicbrainzReleaseGroupId: releaseGroupId,
        metadataArtistId: stored.artist.id,
        metadataReleaseGroupId: stored.releaseGroup.id,
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      ...stored,
      source: {
        provider: 'musicbrainz',
        musicbrainzArtistId: primaryArtistId,
        musicbrainzReleaseGroupId: releaseGroupId,
      },
    };
  }

  async function importReleaseById({ releaseId, actorUserId = null, requestMetadata = null }) {
    const releasePayload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.lookupRelease({ releaseId }),
    );
    const primaryArtistId = resolvePrimaryArtistId(releasePayload);
    const artistDetails = primaryArtistId
      ? await observeMusicBrainzProviderCall(
          providerHealthRecorder,
          () => musicBrainzClient.lookupArtist({ artistId: primaryArtistId, includeAliases: true }),
        )
      : null;

    const normalizedGraph = normalizeMusicBrainzReleaseGraph({
      release: releasePayload,
      artistDetails,
    });

    const stored = await metadataService.storeReleaseGraph(normalizedGraph);

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      eventType: 'metadata_musicbrainz_release_imported',
      summary: 'MusicBrainz release imported',
      entityType: 'metadata_release',
      entityId: stored.release.id,
      details: {
        sourceProvider: 'musicbrainz',
        musicbrainzArtistId: primaryArtistId,
        musicbrainzReleaseId: releaseId,
        metadataArtistId: stored.artist.id,
        metadataReleaseGroupId: stored.releaseGroup.id,
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      ...stored,
      source: {
        provider: 'musicbrainz',
        musicbrainzArtistId: primaryArtistId,
        musicbrainzReleaseId: releaseId,
      },
    };
  }

  return {
    importArtistById,
    importReleaseGroupById,
    importReleaseById,
  };
}
