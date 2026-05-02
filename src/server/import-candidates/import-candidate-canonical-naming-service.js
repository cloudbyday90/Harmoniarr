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

import { posix as path } from 'node:path';
import { getPool } from '../database.js';
import { isAudioFileExtension, normalizeFileExtension } from '../library/library-file-type-policy.js';
import { createLibraryNamingService } from '../library/library-naming-service.js';
import {
  getMetadataArtistById,
  getMetadataReleaseById,
  getMetadataReleaseGroupById,
  listMetadataMediaByReleaseId,
  listMetadataTracksByReleaseId,
} from '../metadata/metadata-repository.js';

function buildWarning(code, message) {
  return { code, message };
}

function buildTracksByMedium(trackRows) {
  const mapped = new Map();

  for (const trackRow of trackRows) {
    const tracks = mapped.get(trackRow.metadata_medium_id) ?? [];
    tracks.push(trackRow);
    mapped.set(trackRow.metadata_medium_id, tracks);
  }

  for (const tracks of mapped.values()) {
    tracks.sort((left, right) => left.position - right.position);
  }

  return mapped;
}

function buildOrderedReleaseTracks({ mediaRows, trackRows }) {
  const tracksByMedium = buildTracksByMedium(trackRows);

  return [...mediaRows]
    .sort((left, right) => left.position - right.position)
    .flatMap((mediumRow) => (tracksByMedium.get(mediumRow.id) ?? []).map((trackRow) => ({
      discNumber: mediumRow.position,
      mediumId: mediumRow.id,
      position: trackRow.position,
      title: trackRow.title,
      trackId: trackRow.id,
    })));
}

async function defaultFindMetadataReleaseIdBySearchId({ searchId, queryable = null }) {
  const db = queryable ?? getPool();
  const result = await db.query(
    `
      SELECT metadata_release_id
      FROM library_discovery_requests
      WHERE evidence->>'lastSearchId' = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [searchId],
  );

  return result.rows[0]?.metadata_release_id ?? null;
}

export function createImportCandidateCanonicalNamingService({
  findMetadataReleaseIdBySearchId = defaultFindMetadataReleaseIdBySearchId,
  getMetadataArtistByIdFn = getMetadataArtistById,
  getMetadataReleaseByIdFn = getMetadataReleaseById,
  getMetadataReleaseGroupByIdFn = getMetadataReleaseGroupById,
  libraryNamingService = createLibraryNamingService(),
  listMetadataMediaByReleaseIdFn = listMetadataMediaByReleaseId,
  listMetadataTracksByReleaseIdFn = listMetadataTracksByReleaseId,
  queryable = null,
} = {}) {
  async function resolveCanonicalImportNaming({ candidate } = {}) {
    const searchId = typeof candidate?.sourceSearchId === 'string'
      ? candidate.sourceSearchId.trim()
      : '';
    if (!searchId) {
      return null;
    }

    const metadataReleaseId = await findMetadataReleaseIdBySearchId({
      queryable,
      searchId,
    });
    if (!metadataReleaseId) {
      return null;
    }

    const release = await getMetadataReleaseByIdFn(metadataReleaseId, queryable);
    if (!release?.metadata_release_group_id) {
      return null;
    }

    const [releaseGroup, mediaRows, trackRows] = await Promise.all([
      getMetadataReleaseGroupByIdFn(release.metadata_release_group_id, queryable),
      listMetadataMediaByReleaseIdFn(metadataReleaseId, queryable),
      listMetadataTracksByReleaseIdFn(metadataReleaseId, queryable),
    ]);
    if (!releaseGroup?.metadata_artist_id) {
      return null;
    }

    const artist = await getMetadataArtistByIdFn(releaseGroup.metadata_artist_id, queryable);
    if (!artist?.name) {
      return null;
    }

    const audioFiles = [...(candidate.files ?? [])]
      .filter((file) => isAudioFileExtension(file.extension))
      .sort((left, right) => Number(left.sourceFileIndex ?? 0) - Number(right.sourceFileIndex ?? 0));
    const orderedTracks = buildOrderedReleaseTracks({ mediaRows, trackRows });

    if (orderedTracks.length === 0) {
      return null;
    }

    if (audioFiles.length !== orderedTracks.length) {
      return {
        canApply: false,
        strategy: 'mirror_candidate_path',
        warnings: [
          buildWarning(
            'canonical_naming_track_count_mismatch',
            `Canonical naming expects ${orderedTracks.length} audio track${orderedTracks.length === 1 ? '' : 's'}, but this candidate exposes ${audioFiles.length}. Preview falls back to the mirrored candidate structure until the file set is reviewed.`,
          ),
        ],
      };
    }

    const folderSegments = [
      libraryNamingService.buildArtistFolderName({ artistName: artist.name }),
      libraryNamingService.buildAlbumFolderName({
        albumTitle: releaseGroup.title ?? release.title,
        releaseDate: release.release_date ?? releaseGroup.first_release_date ?? null,
      }),
    ];
    const fileNamesById = new Map();
    const plannedFileNames = new Set();
    const isMultiDisc = mediaRows.length > 1;

    for (const [index, audioFile] of audioFiles.entries()) {
      const track = orderedTracks[index];
      const filename = libraryNamingService.buildTrackFilename({
        discNumber: track.discNumber,
        extension: normalizeFileExtension(audioFile.extension),
        isMultiDisc,
        trackNumber: track.position,
        trackTitle: track.title,
      });
      if (plannedFileNames.has(filename.toLowerCase())) {
        return {
          canApply: false,
          strategy: 'mirror_candidate_path',
          warnings: [
            buildWarning(
              'canonical_naming_duplicate_filename',
              'Canonical naming produced duplicate destination filenames for this candidate. Preview falls back to the mirrored candidate structure until the collision is reviewed.',
            ),
          ],
        };
      }

      plannedFileNames.add(filename.toLowerCase());
      fileNamesById.set(audioFile.id, filename);
    }

    for (const file of candidate.files ?? []) {
      if (fileNamesById.has(file.id)) {
        continue;
      }

      const filename = libraryNamingService.sanitizeLibraryFilename(file.filename, {
        extension: file.extension,
        fallback: `candidate-${candidate.id}-file`,
      });
      if (plannedFileNames.has(filename.toLowerCase())) {
        return {
          canApply: false,
          strategy: 'mirror_candidate_path',
          warnings: [
            buildWarning(
              'canonical_naming_duplicate_filename',
              'Canonical naming produced duplicate destination filenames for this candidate. Preview falls back to the mirrored candidate structure until the collision is reviewed.',
            ),
          ],
        };
      }

      plannedFileNames.add(filename.toLowerCase());
      fileNamesById.set(file.id, filename);
    }

    return {
      canApply: true,
      fileNamesById,
      relativeFolderPath: path.join(...folderSegments),
      strategy: 'canonical_release_default_template',
      warnings: [],
    };
  }

  return {
    resolveCanonicalImportNaming,
  };
}
