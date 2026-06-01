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

import { parseFile } from 'music-metadata';
import { createLibraryTagSnapshotStore } from './library-tag-snapshot-store.js';

function sanitizeTagValue(value) {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTagValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {
      byteLength: value.byteLength,
      type: 'binary',
    };
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeTagValue(nestedValue)]),
    );
  }

  return value;
}

function normalizeMusicBrainzTags(common) {
  return {
    artistId: common.musicbrainz_artistid ?? null,
    albumArtistId: common.musicbrainz_albumartistid ?? null,
    releaseGroupId: common.musicbrainz_releasegroupid ?? null,
    releaseId: common.musicbrainz_albumid ?? null,
    trackId: common.musicbrainz_trackid ?? null,
    recordingId: common.musicbrainz_recordingid ?? null,
  };
}

function buildNormalizedTags(metadata) {
  const common = metadata.common ?? {};

  return {
    album: common.album ?? null,
    albumArtist: common.albumartist ?? null,
    artist: common.artist ?? null,
    artists: Array.isArray(common.artists) ? common.artists : [],
    disk: {
      number: common.disk?.no ?? null,
      of: common.disk?.of ?? null,
    },
    genre: Array.isArray(common.genre) ? common.genre : [],
    musicBrainz: normalizeMusicBrainzTags(common),
    title: common.title ?? null,
    track: {
      number: common.track?.no ?? null,
      of: common.track?.of ?? null,
    },
    year: common.year ?? null,
  };
}

function buildRawTags(metadata) {
  return {
    native: Object.fromEntries(
      Object.entries(metadata.native ?? {}).map(([tagType, tags]) => [
        tagType,
        tags.map((tag) => ({
          id: tag.id,
          value: sanitizeTagValue(tag.value),
        })),
      ]),
    ),
    tagTypes: metadata.format?.tagTypes ?? [],
  };
}

function buildExtractionPayload(metadata) {
  return {
    audioCodec: metadata.format?.codec ?? null,
    bitrateKbps: metadata.format?.bitrate ? metadata.format.bitrate / 1000 : null,
    bitDepth: metadata.format?.bitsPerSample ?? null,
    channels: metadata.format?.numberOfChannels ?? null,
    durationMs: metadata.format?.duration ? metadata.format.duration * 1000 : null,
    embeddedArtworkCount: metadata.common?.picture?.length ?? 0,
    normalizedTags: buildNormalizedTags(metadata),
    rawTags: buildRawTags(metadata),
    sampleRateHz: metadata.format?.sampleRate ?? null,
    status: 'extracted',
    tagFormat: metadata.format?.tagTypes?.[0] ?? null,
  };
}

export function createLibraryTagExtractionService({
  extractMetadata = parseFile,
  extractor = 'music-metadata',
  extractorVersion = null,
  libraryEmbeddedArtworkService = null,
  libraryTagSnapshotStore = createLibraryTagSnapshotStore(),
} = {}) {
  async function extractLibraryFileTags({ files }) {
    const extractedFiles = [];

    for (const file of files) {
      if (file.fileState !== 'observed') {
        continue;
      }

      try {
        const metadata = await extractMetadata(file.canonicalPath);
        const extractionPayload = buildExtractionPayload(metadata);
        await libraryTagSnapshotStore.writeLibraryFileTagSnapshot({
          ...extractionPayload,
          extractor,
          extractorVersion,
          libraryFileId: file.id,
          sourceModifiedAt: file.modifiedAt ?? null,
          sourceSizeBytes: file.sizeBytes ?? null,
        });
        extractedFiles.push({
          ...file,
          tagPayload: extractionPayload.normalizedTags,
        });

        if (libraryEmbeddedArtworkService) {
          try {
            await libraryEmbeddedArtworkService.captureEmbeddedArtwork({
              libraryFileId: file.id,
              metadata,
            });
          } catch {
            // Embedded artwork capture remains best-effort; missing or invalid art must not block scans.
          }
        }
      } catch (error) {
        await libraryTagSnapshotStore.writeLibraryFileTagSnapshot({
          extractor,
          extractorVersion,
          libraryFileId: file.id,
          rawTags: {
            error: error instanceof Error ? error.message : String(error),
          },
          status: 'failed',
        });
        extractedFiles.push({
          ...file,
          tagPayload: null,
        });
      }
    }

    return {
      files: extractedFiles,
    };
  }

  return {
    extractLibraryFileTags,
  };
}
