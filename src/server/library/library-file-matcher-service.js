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
import { createLibraryFileMatchStore } from './library-file-match-store.js';
import {
  findConventionalTagMatches,
  normalizeMatchText,
} from './conventional-tag-matching.js';

function buildTrackLookupRows(rows) {
  return rows.map((row) => ({
    metadataArtistId: row.metadata_artist_id,
    metadataMediumId: row.metadata_medium_id,
    metadataRecordingId: row.metadata_recording_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    metadataTrackId: row.metadata_track_id,
    releaseArtistName: row.release_artist_name,
    releaseTitle: row.release_title,
    releaseMusicBrainzId: row.release_musicbrainz_release_id,
    trackPosition: row.track_position,
    trackTitle: row.track_title,
    trackArtistCredit: row.track_artist_credit,
    recordingMusicBrainzId: row.recording_musicbrainz_recording_id,
  }));
}

function buildMatchedResult(candidate, evidence, { confidence = 'high' } = {}) {
  return {
    confidence,
    evidence,
    matchStatus: 'matched',
    matchedBy: evidence.strategy,
    metadataArtistId: candidate.metadataArtistId,
    metadataMediumId: candidate.metadataMediumId,
    metadataRecordingId: candidate.metadataRecordingId,
    metadataReleaseGroupId: candidate.metadataReleaseGroupId,
    metadataReleaseId: candidate.metadataReleaseId,
    metadataTrackId: candidate.metadataTrackId,
  };
}

function buildReleaseScopedCandidates(candidates, releaseId) {
  if (!releaseId) {
    return [];
  }

  return candidates.filter((candidate) => candidate.releaseMusicBrainzId === releaseId);
}

function matchByRecordingId({ candidates, normalizedTags }) {
  const recordingId = normalizedTags?.musicBrainz?.recordingId ?? null;
  if (!recordingId) {
    return null;
  }

  const matches = candidates.filter((candidate) => candidate.recordingMusicBrainzId === recordingId);
  if (matches.length !== 1) {
    return null;
  }

  return buildMatchedResult(matches[0], {
    musicBrainzRecordingId: recordingId,
    strategy: 'musicbrainz_recording_id',
  });
}

function matchByReleaseTitleAndTrackPosition({ candidates, normalizedTags }) {
  const releaseId = normalizedTags?.musicBrainz?.releaseId ?? null;
  const trackPosition = normalizedTags?.track?.number ?? null;
  const normalizedTitle = normalizeMatchText(normalizedTags?.title ?? null);
  if (!releaseId || !Number.isInteger(trackPosition) || !normalizedTitle) {
    return null;
  }

  const matches = buildReleaseScopedCandidates(candidates, releaseId)
    .filter((candidate) => candidate.trackPosition === trackPosition)
    .filter((candidate) => normalizeMatchText(candidate.trackTitle) === normalizedTitle);

  if (matches.length !== 1) {
    return null;
  }

  return buildMatchedResult(matches[0], {
    musicBrainzReleaseId: releaseId,
    normalizedTitle,
    strategy: 'musicbrainz_release_title_track_position',
    trackPosition,
  });
}

function buildAmbiguousResult({
  candidates,
  evidence = null,
  normalizedTags,
  strategy,
}) {
  return {
    confidence: 'low',
    evidence: evidence ?? {
      candidateCount: candidates.length,
      releaseId: normalizedTags?.musicBrainz?.releaseId ?? null,
      strategy,
      title: normalizedTags?.title ?? null,
      trackNumber: normalizedTags?.track?.number ?? null,
    },
    matchStatus: 'ambiguous',
    matchedBy: strategy,
  };
}

function buildUnmatchedResult({ reason, normalizedTags }) {
  return {
    confidence: 'low',
    evidence: {
      reason,
      releaseId: normalizedTags?.musicBrainz?.releaseId ?? null,
      title: normalizedTags?.title ?? null,
      trackNumber: normalizedTags?.track?.number ?? null,
    },
    matchStatus: 'unmatched',
    matchedBy: 'no_canonical_match',
  };
}

function matchByConventionalTags({ candidates, file, normalizedTags }) {
  const matchResult = findConventionalTagMatches({
    candidates,
    normalizedTags,
    scopeMetadataReleaseId: file?.scopeMetadataReleaseId ?? null,
  });

  if (matchResult.reason) {
    return null;
  }

  if (matchResult.scopeMatches.length === 1) {
    return buildMatchedResult(matchResult.scopeMatches[0], {
      matchedAlbum: matchResult.normalizedAlbum,
      matchedArtist: matchResult.normalizedArtist,
      matchedTitle: matchResult.normalizedTitle,
      matchedTrackPosition: matchResult.trackPosition,
      scopeMetadataReleaseId: file.scopeMetadataReleaseId,
      strategy: 'conventional_tags',
    });
  }

  if (matchResult.scopeMatches.length > 1) {
    return buildAmbiguousResult({
      candidates: matchResult.scopeMatches,
      evidence: {
        candidateCount: matchResult.scopeMatches.length,
        matchedTitle: matchResult.normalizedTitle,
        matchedTrackPosition: matchResult.trackPosition,
        scopeMetadataReleaseId: file.scopeMetadataReleaseId,
        strategy: 'conventional_tags_scope_multiple_candidates',
      },
      normalizedTags,
      strategy: 'conventional_tags_scope_multiple_candidates',
    });
  }

  if (matchResult.globalMatches.length === 1) {
    return buildMatchedResult(matchResult.globalMatches[0], {
      matchedAlbum: matchResult.normalizedAlbum,
      matchedArtist: matchResult.normalizedArtist,
      matchedTitle: matchResult.normalizedTitle,
      matchedTrackPosition: matchResult.trackPosition,
      scopeMetadataReleaseId: file?.scopeMetadataReleaseId ?? null,
      strategy: 'conventional_tags',
    }, { confidence: 'medium' });
  }

  if (matchResult.globalMatches.length > 1) {
    return buildAmbiguousResult({
      candidates: matchResult.globalMatches,
      evidence: {
        candidateCount: matchResult.globalMatches.length,
        matchedAlbum: matchResult.normalizedAlbum,
        matchedArtist: matchResult.normalizedArtist,
        matchedTitle: matchResult.normalizedTitle,
        matchedTrackPosition: matchResult.trackPosition,
        scopeMetadataReleaseId: file?.scopeMetadataReleaseId ?? null,
        strategy: 'conventional_tags_multiple_candidates',
      },
      normalizedTags,
      strategy: 'conventional_tags_multiple_candidates',
    });
  }

  return null;
}

function resolveMatchResult({ candidates, file, normalizedTags }) {
  const strategies = [
    matchByRecordingId,
    matchByReleaseTitleAndTrackPosition,
    matchByConventionalTags,
  ];

  for (const strategy of strategies) {
    const result = strategy({ candidates, file, normalizedTags });
    if (result) {
      return result;
    }
  }

  const releaseScopedCandidates = buildReleaseScopedCandidates(
    candidates,
    normalizedTags?.musicBrainz?.releaseId ?? null,
  );

  if (releaseScopedCandidates.length > 1) {
    return buildAmbiguousResult({
      candidates: releaseScopedCandidates,
      normalizedTags,
      strategy: 'release_scoped_multiple_candidates',
    });
  }

  return buildUnmatchedResult({
    normalizedTags,
    reason: 'no_unique_canonical_candidate',
  });
}

export function createLibraryFileMatcherService({
  getPoolFn = getPool,
  libraryFileMatchStore = createLibraryFileMatchStore(),
} = {}) {
  async function loadTrackLookupRows() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          metadata_artists.id AS metadata_artist_id,
          metadata_release_groups.id AS metadata_release_group_id,
          metadata_releases.id AS metadata_release_id,
          metadata_releases.musicbrainz_release_id AS musicbrainz_release_id,
          metadata_releases.title AS release_title,
          metadata_media.id AS metadata_medium_id,
          metadata_tracks.id AS metadata_track_id,
          metadata_tracks.position AS track_position,
          metadata_tracks.title AS track_title,
          metadata_tracks.artist_credit AS track_artist_credit,
          metadata_recordings.id AS metadata_recording_id,
          metadata_recordings.musicbrainz_recording_id AS recording_musicbrainz_recording_id,
          metadata_artists.name AS release_artist_name
        FROM metadata_tracks
        JOIN metadata_media ON metadata_media.id = metadata_tracks.metadata_medium_id
        JOIN metadata_releases ON metadata_releases.id = metadata_media.metadata_release_id
        JOIN metadata_release_groups ON metadata_release_groups.id = metadata_releases.metadata_release_group_id
        JOIN metadata_artists ON metadata_artists.id = metadata_release_groups.metadata_artist_id
        LEFT JOIN metadata_recordings ON metadata_recordings.id = metadata_tracks.metadata_recording_id
      `,
    );

    return buildTrackLookupRows(result.rows.map((row) => ({
      ...row,
      release_musicbrainz_release_id: row.musicbrainz_release_id,
    })));
  }

  async function matchLibraryFiles({ files }) {
    const candidates = await loadTrackLookupRows();
    const matchResults = [];

    for (const file of files) {
      if (file.fileState !== 'observed') {
        continue;
      }

      const normalizedTags = file.tagPayload ?? null;
      if (!normalizedTags) {
        matchResults.push({
          confidence: 'low',
          evidence: {
            reason: 'missing_tag_payload',
          },
          libraryFileId: file.id,
          matchStatus: 'unmatched',
          matchedBy: 'missing_tag_payload',
        });
        continue;
      }

      const result = resolveMatchResult({ candidates, file, normalizedTags });
      matchResults.push({
        ...result,
        libraryFileId: file.id,
      });
    }

    await libraryFileMatchStore.writeLibraryFileMatchBatch({
      matches: matchResults,
    });
  }

  return {
    matchLibraryFiles,
  };
}
