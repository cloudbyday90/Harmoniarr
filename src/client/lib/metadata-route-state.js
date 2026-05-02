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

function normalizeRouteValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeMetadataRouteState(query = {}) {
  return {
    artistId: normalizeRouteValue(query.artistId),
    releaseGroupId: normalizeRouteValue(query.releaseGroupId),
    releaseId: normalizeRouteValue(query.releaseId),
  };
}

export function buildMetadataRouteQuery(state = {}) {
  const artistId = normalizeRouteValue(state.artistId);
  const releaseGroupId = normalizeRouteValue(state.releaseGroupId);
  const releaseId = normalizeRouteValue(state.releaseId);
  const query = {};

  if (artistId) {
    query.artistId = artistId;
  }

  if (releaseGroupId) {
    query.releaseGroupId = releaseGroupId;
  }

  if (releaseId) {
    query.releaseId = releaseId;
  }

  return query;
}

export function getMetadataRouteStateKey(state) {
  const normalized = normalizeMetadataRouteState(state);

  return JSON.stringify([
    normalized.artistId,
    normalized.releaseGroupId,
    normalized.releaseId,
  ]);
}

export function resolveMetadataRouteReleaseGroupId({ localReleaseGroups = [], releaseGroup } = {}) {
  const normalizedReleaseGroupId = normalizeRouteValue(releaseGroup?.id);

  if (!normalizedReleaseGroupId) {
    return '';
  }

  const matchingLocalReleaseGroup = localReleaseGroups.find((candidate) => (
    normalizeRouteValue(candidate?.id) === normalizedReleaseGroupId
    || normalizeRouteValue(candidate?.source?.musicbrainzReleaseGroupId) === normalizedReleaseGroupId
  ));

  return normalizeRouteValue(matchingLocalReleaseGroup?.id);
}

export function buildMetadataRouteHydrationPlan({
  currentArtistId,
  currentReleaseGroupId,
  currentReleaseId,
  nextState,
} = {}) {
  const normalizedCurrentArtistId = normalizeRouteValue(currentArtistId);
  const normalizedCurrentReleaseGroupId = normalizeRouteValue(currentReleaseGroupId);
  const normalizedCurrentReleaseId = normalizeRouteValue(currentReleaseId);
  const normalizedNextState = normalizeMetadataRouteState(nextState);

  return {
    artistId: normalizedNextState.artistId && normalizedNextState.artistId !== normalizedCurrentArtistId
      ? normalizedNextState.artistId
      : '',
    release: normalizedNextState.releaseId && normalizedNextState.releaseId !== normalizedCurrentReleaseId
      ? {
        releaseGroupId: normalizedNextState.releaseGroupId,
        releaseId: normalizedNextState.releaseId,
      }
      : null,
    releaseGroupId: !normalizedNextState.releaseId
      && normalizedNextState.releaseGroupId
      && normalizedNextState.releaseGroupId !== normalizedCurrentReleaseGroupId
      ? normalizedNextState.releaseGroupId
      : '',
  };
}

export function buildMetadataArtistLocation(artistId) {
  const normalizedArtistId = normalizeRouteValue(artistId);

  if (!normalizedArtistId) {
    return null;
  }

  return {
    name: 'metadata',
    query: buildMetadataRouteQuery({ artistId: normalizedArtistId }),
  };
}

export function buildMetadataReleaseGroupLocation({ artistId, releaseGroupId } = {}) {
  const normalizedArtistId = normalizeRouteValue(artistId);
  const normalizedReleaseGroupId = normalizeRouteValue(releaseGroupId);

  if (!normalizedReleaseGroupId) {
    return null;
  }

  return {
    name: 'metadata',
    query: buildMetadataRouteQuery({
      artistId: normalizedArtistId,
      releaseGroupId: normalizedReleaseGroupId,
    }),
  };
}

export function buildMetadataReleaseLocation({ artistId, releaseGroupId, releaseId } = {}) {
  const normalizedReleaseId = normalizeRouteValue(releaseId);

  if (!normalizedReleaseId) {
    return null;
  }

  return {
    name: 'metadata',
    query: buildMetadataRouteQuery({
      artistId: normalizeRouteValue(artistId),
      releaseGroupId: normalizeRouteValue(releaseGroupId),
      releaseId: normalizedReleaseId,
    }),
  };
}