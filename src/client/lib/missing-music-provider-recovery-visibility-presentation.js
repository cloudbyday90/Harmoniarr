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

export const MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT = 'provider_ready';

function normalizeRouteQuery(query) {
  return query && typeof query === 'object' ? query : {};
}

function getReleaseLabel(release) {
  const releaseTitle = typeof release?.releaseTitle === 'string' && release.releaseTitle.trim().length > 0
    ? release.releaseTitle.trim()
    : 'This release';
  const artistName = typeof release?.artistName === 'string' && release.artistName.trim().length > 0
    ? release.artistName.trim()
    : null;

  return artistName ? `${releaseTitle} by ${artistName}` : releaseTitle;
}

export function isMissingMusicProviderReadyRecoveryContext(value) {
  return value === MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT;
}

export function omitMissingMusicProviderReadyRecoveryQuery(query) {
  const { recovery, ...remainingQuery } = normalizeRouteQuery(query);
  return remainingQuery;
}

/**
 * The release API is already deterministically ordered by the server. Preserve
 * that ordering so this message identifies the first eligible release without
 * creating a client-side scheduling policy.
 */
export function buildMissingMusicProviderRecoveryVisibility({
  releases = [],
  refreshFailed = false,
} = {}) {
  if (refreshFailed) {
    return {
      copy: 'Soulseek is ready, but Missing Music could not refresh yet. It will retry during its normal checks.',
      outcome: 'refresh_failed',
      title: 'Missing Music has not refreshed yet',
      tone: 'warning',
    };
  }

  const nextEligibleRelease = Array.isArray(releases)
    ? releases.find((release) => release?.statusCode === 'queued_for_search')
    : null;

  if (!nextEligibleRelease) {
    return {
      copy: 'Missing Music refreshed. No release is waiting for a normal search check right now.',
      outcome: 'no_waiting_release',
      title: 'Missing Music is ready',
      tone: 'success',
    };
  }

  return {
    copy: `${getReleaseLabel(nextEligibleRelease)} is waiting for its next normal search check. Harmoniarr has not started a download yet.`,
    outcome: 'waiting_for_search',
    releaseId: nextEligibleRelease.id ?? null,
    title: 'Missing Music is ready',
    tone: 'success',
  };
}
