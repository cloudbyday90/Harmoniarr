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

function normalizeText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getReleaseIdentity(release) {
  const artistName = normalizeText(release?.artistCredit) ?? normalizeText(release?.artistName);
  const releaseTitle = normalizeText(release?.title) ?? normalizeText(release?.releaseTitle);

  if (artistName && releaseTitle) return `${artistName} — ${releaseTitle}`;
  return releaseTitle ?? artistName ?? 'this release';
}

/**
 * Builds the route used to inspect one Missing Music release in Music Queue.
 * The route carries only Harmoniarr's durable wanted-release ID. It is a
 * navigation hint; server-side scoped reads remain the authorization boundary.
 *
 * @param {object|null|undefined} release
 * @returns {{name: 'music-queue-release', params: {wantedReleaseId: string}}|null}
 */
export function buildMissingReleaseMusicQueueRoute(release) {
  const wantedReleaseId = normalizeText(release?.wantedReleaseId) ?? normalizeText(release?.id);
  if (!wantedReleaseId) return null;

  return {
    name: 'music-queue-release',
    params: { wantedReleaseId },
  };
}

/**
 * Centralizes Missing Music's visible labels and accessible names. Keeping this
 * pure avoids alternate wording between the artwork card, confirmation, and
 * release-scoped Music Queue handoff.
 *
 * @param {object|null|undefined} release
 * @returns {{openMusicQueue: {accessibleLabel: string, label: string}, startSearch: {accessibleLabel: string, label: string, summary: string}}}
 */
export function buildMissingReleaseDecisionPresentation(release) {
  const identity = getReleaseIdentity(release);

  return {
    openMusicQueue: {
      accessibleLabel: `Open Music Queue for ${identity}`,
      label: 'Open Music Queue',
    },
    startSearch: {
      accessibleLabel: `Start a search for ${identity}`,
      label: 'Start search',
      summary: 'Start a search, then choose a match in Music Queue if Harmoniarr cannot decide automatically.',
    },
  };
}
