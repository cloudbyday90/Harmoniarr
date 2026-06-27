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

import { setDraftReleaseGroupSelectionState } from './operator-artist-detail-draft.js';

export const ARTIST_DETAIL_BULK_RELEASE_CONFIRMATION_THRESHOLD = 25;
export const ARTIST_DETAIL_BULK_TRACK_CONFIRMATION_THRESHOLD = 250;

const selectableBulkStates = new Set(['selected', 'unselected']);

function toFiniteCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function sumMediaTrackCounts(media = []) {
  if (!Array.isArray(media)) {
    return 0;
  }

  return media.reduce((total, medium) => {
    const explicitCount = toFiniteCount(medium?.trackCount ?? medium?.track_count);
    if (explicitCount > 0) {
      return total + explicitCount;
    }

    return total + (Array.isArray(medium?.tracks) ? medium.tracks.length : 0);
  }, 0);
}

function unwrapReleaseGroup(release) {
  return release?.sourceReleaseGroup ?? release;
}

export function countArtistDetailBulkReleaseTracks(release) {
  const releaseGroup = unwrapReleaseGroup(release);
  const resolvedRelease = releaseGroup?.operatorState?.resolvedRelease
    ?? release?.operatorState?.resolvedRelease
    ?? null;

  return Math.max(
    toFiniteCount(release?.trackCount ?? release?.track_count),
    toFiniteCount(releaseGroup?.trackCount ?? releaseGroup?.track_count),
    toFiniteCount(resolvedRelease?.trackCount ?? resolvedRelease?.track_count),
    sumMediaTrackCounts(release?.media),
    sumMediaTrackCounts(releaseGroup?.media),
    sumMediaTrackCounts(resolvedRelease?.media),
  );
}

export function summarizeArtistDetailBulkSelection(releases = []) {
  const normalizedReleases = Array.isArray(releases) ? releases : [];
  return {
    releaseCount: normalizedReleases.length,
    trackCount: normalizedReleases.reduce(
      (total, release) => total + countArtistDetailBulkReleaseTracks(release),
      0,
    ),
  };
}

export function shouldConfirmArtistDetailBulkSelection(summary = {}) {
  return toFiniteCount(summary.releaseCount) > ARTIST_DETAIL_BULK_RELEASE_CONFIRMATION_THRESHOLD
    || toFiniteCount(summary.trackCount) > ARTIST_DETAIL_BULK_TRACK_CONFIRMATION_THRESHOLD;
}

export function buildArtistDetailBulkSelectionOperation({
  releases = [],
  sectionType = '',
  selectionState,
} = {}) {
  if (!selectableBulkStates.has(selectionState)) {
    return null;
  }

  const normalizedReleases = Array.isArray(releases) ? releases : [];
  const summary = summarizeArtistDetailBulkSelection(normalizedReleases);

  return {
    releases: normalizedReleases,
    requiresConfirmation: shouldConfirmArtistDetailBulkSelection(summary),
    sectionType,
    selectionState,
    ...summary,
  };
}

export function applyArtistDetailBulkSelection(draft, releases = [], selectionState) {
  if (!draft || !selectableBulkStates.has(selectionState) || !Array.isArray(releases)) {
    return draft;
  }

  for (const release of releases) {
    setDraftReleaseGroupSelectionState(
      draft,
      unwrapReleaseGroup(release),
      selectionState,
    );
  }

  return draft;
}
