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

import { createMetadataSourceWriteService } from './metadata-source-write-service.js';
import { getPool } from '../database.js';
import {
  deleteMetadataMediaByReleaseId,
  insertMetadataMedium,
  insertMetadataProviderSnapshot,
  insertMetadataTrack,
  replaceMetadataArtistAliases,
  upsertMetadataArtist,
  upsertMetadataRecording,
  upsertMetadataRelease,
  upsertMetadataReleaseGroup,
} from './metadata-repository.js';

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function resolveSnapshotEntityId(snapshot, entityIds) {
  if (snapshot.entityId) {
    return snapshot.entityId;
  }

  switch (snapshot.entityType) {
    case 'artist':
      return entityIds.artistId ?? null;
    case 'release_group':
      return entityIds.releaseGroupId ?? null;
    case 'release':
      return entityIds.releaseId ?? null;
    default:
      return entityIds.defaultEntityId ?? null;
  }
}

async function insertProviderSnapshots(providerSnapshots, entityIds, client) {
  for (const snapshot of normalizeArray(providerSnapshots)) {
    assertObject(snapshot, 'providerSnapshots entry');
    await insertMetadataProviderSnapshot(
      {
        ...snapshot,
        entityId: resolveSnapshotEntityId(snapshot, entityIds),
      },
      client,
    );
  }
}

export function createMetadataService({ pool = getPool() } = {}) {
  const { withExclusiveWrite: withTransaction } = createMetadataSourceWriteService({ getPoolFn: () => pool });

  async function storeArtist({ artist, aliases = [], providerSnapshots = [] }) {
    assertObject(artist, 'artist');

    const acceptedInput = structuredClone({ artist, aliases, providerSnapshots });
    return withTransaction(async (client) => {
      const storedArtist = await upsertMetadataArtist(acceptedInput.artist, client);
      await replaceMetadataArtistAliases(storedArtist.id, normalizeArray(acceptedInput.aliases), client);
      await insertProviderSnapshots(acceptedInput.providerSnapshots, {
        artistId: storedArtist.id,
        defaultEntityId: storedArtist.id,
      }, client);

      return storedArtist;
    });
  }

  async function storeReleaseGroup({
    artist,
    aliases = [],
    releaseGroup,
    providerSnapshots = [],
  }) {
    assertObject(artist, 'artist');
    assertObject(releaseGroup, 'releaseGroup');

    const acceptedInput = structuredClone({ artist, aliases, releaseGroup, providerSnapshots });
    return withTransaction(async (client) => {
      const storedArtist = await upsertMetadataArtist(acceptedInput.artist, client);
      await replaceMetadataArtistAliases(storedArtist.id, normalizeArray(acceptedInput.aliases), client);

      const storedReleaseGroup = await upsertMetadataReleaseGroup(
        {
          ...acceptedInput.releaseGroup,
          metadataArtistId: storedArtist.id,
        },
        client,
      );

      await insertProviderSnapshots(acceptedInput.providerSnapshots, {
        artistId: storedArtist.id,
        releaseGroupId: storedReleaseGroup.id,
        defaultEntityId: storedReleaseGroup.id,
      }, client);

      return {
        artist: storedArtist,
        releaseGroup: storedReleaseGroup,
      };
    });
  }

  async function storeReleaseGraph({
    artist,
    aliases = [],
    releaseGroup,
    release,
    media = [],
    providerSnapshots = [],
  }) {
    assertObject(artist, 'artist');
    assertObject(releaseGroup, 'releaseGroup');
    assertObject(release, 'release');

    const acceptedInput = structuredClone({ artist, aliases, releaseGroup, release, media, providerSnapshots });
    return withTransaction(async (client) => {
      const storedArtist = await upsertMetadataArtist(acceptedInput.artist, client);
      await replaceMetadataArtistAliases(storedArtist.id, normalizeArray(acceptedInput.aliases), client);

      const storedReleaseGroup = await upsertMetadataReleaseGroup(
        {
          ...acceptedInput.releaseGroup,
          metadataArtistId: storedArtist.id,
        },
        client,
      );

      const storedRelease = await upsertMetadataRelease(
        {
          ...acceptedInput.release,
          metadataReleaseGroupId: storedReleaseGroup.id,
        },
        client,
      );

      await deleteMetadataMediaByReleaseId(storedRelease.id, client);

      for (const medium of normalizeArray(acceptedInput.media)) {
        assertObject(medium, 'media entry');
        const storedMedium = await insertMetadataMedium(
          {
            metadataReleaseId: storedRelease.id,
            position: medium.position,
            title: medium.title ?? null,
            format: medium.format ?? null,
            trackCount: medium.trackCount ?? null,
          },
          client,
        );

        for (const track of normalizeArray(medium.tracks)) {
          assertObject(track, 'track entry');

          let metadataRecordingId = null;
          if (track.recording) {
            assertObject(track.recording, 'track.recording');
            const storedRecording = await upsertMetadataRecording(track.recording, client);
            metadataRecordingId = storedRecording.id;
          }

          await insertMetadataTrack(
            {
              metadataMediumId: storedMedium.id,
              metadataRecordingId,
              position: track.position,
              numberText: track.numberText ?? null,
              title: track.title,
              lengthMs: track.lengthMs ?? null,
              artistCredit: track.artistCredit ?? null,
            },
            client,
          );
        }
      }

      await insertProviderSnapshots(acceptedInput.providerSnapshots, {
        artistId: storedArtist.id,
        releaseGroupId: storedReleaseGroup.id,
        releaseId: storedRelease.id,
        defaultEntityId: storedRelease.id,
      }, client);

      return {
        artist: storedArtist,
        releaseGroup: storedReleaseGroup,
        release: storedRelease,
      };
    });
  }

  return {
    storeArtist,
    storeReleaseGroup,
    storeReleaseGraph,
  };
}