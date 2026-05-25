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

export const operatorTrackOverrideRemapStatuses = Object.freeze([
  'resolved',
  'review_needed',
  'orphaned',
]);

export const defaultOperatorTrackOverridePolicy = Object.freeze({
  isDesired: true,
  mediumPosition: null,
  metadataReleaseId: null,
  recordingMbid: null,
  remapStatus: 'resolved',
  trackLengthMsSnapshot: null,
  trackMbid: null,
  trackPosition: null,
  trackTitleSnapshot: null,
});

export function normalizeOperatorTrackOverrideRow(row = {}) {
  return {
    appUserId: row.app_user_id ?? row.appUserId ?? null,
    id: row.id ?? null,
    isDesired: row.is_desired === true || row.isDesired === true,
    mediumPosition: row.medium_position ?? row.mediumPosition ?? null,
    metadataArtistId: row.metadata_artist_id ?? row.metadataArtistId ?? null,
    metadataReleaseGroupId: row.metadata_release_group_id ?? row.metadataReleaseGroupId ?? null,
    metadataReleaseId: row.metadata_release_id ?? row.metadataReleaseId ?? null,
    recordingMbid: row.recording_mbid ?? row.recordingMbid ?? null,
    remapStatus: typeof row.remap_status === 'string'
      ? row.remap_status
      : (row.remapStatus ?? defaultOperatorTrackOverridePolicy.remapStatus),
    trackLengthMsSnapshot: row.track_length_ms_snapshot ?? row.trackLengthMsSnapshot ?? null,
    trackMbid: row.track_mbid ?? row.trackMbid ?? null,
    trackPosition: row.track_position ?? row.trackPosition ?? null,
    trackTitleSnapshot: row.track_title_snapshot ?? row.trackTitleSnapshot ?? null,
  };
}
