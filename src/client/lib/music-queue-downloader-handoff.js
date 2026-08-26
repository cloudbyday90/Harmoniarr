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

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getReleaseId(release) {
  return normalizeString(release?.id ?? release?.releaseId);
}

function isDownloaderRouteAction(action) {
  return action?.code === 'open_downloader'
    && action?.routeName === 'downloader'
    && action?.type === 'route';
}

/**
 * Builds the bounded, release-level route from a Music Queue release to its
 * live Downloader transfer view. Provider identifiers deliberately never
 * cross this view boundary; Downloader resolves matching transfers from its
 * existing caller-scoped queue projection.
 *
 * @param {{ id?: unknown, releaseId?: unknown, artistName?: unknown, releaseTitle?: unknown, action?: object }|null} release
 * @returns {{ accessibleLabel: string, description: string, label: string, location: object, wantedReleaseId: string }|null}
 */
export function buildMusicQueueDownloaderHandoff(release) {
  const wantedReleaseId = getReleaseId(release);
  if (!wantedReleaseId || !isDownloaderRouteAction(release?.action)) {
    return null;
  }

  const identity = [
    normalizeString(release.artistName),
    normalizeString(release.releaseTitle),
  ].filter(Boolean).join(' — ');
  const label = 'View download progress';

  return {
    accessibleLabel: identity ? `${label} for ${identity}` : label,
    description: 'View the live transfer and its controls in Downloader. Release decisions remain in Music Queue.',
    label,
    location: {
      name: 'downloader',
      query: { wantedReleaseId },
    },
    wantedReleaseId,
  };
}
