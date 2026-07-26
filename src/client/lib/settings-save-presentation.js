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

function getReleasedMusicQueueCount(payload) {
  const releasedCount = payload?.musicQueueRecovery?.releasedCount;

  return Number.isSafeInteger(releasedCount) && releasedCount > 0
    ? releasedCount
    : 0;
}

/**
 * Builds the concise confirmation shown after a successful Settings save.
 * The server determines whether a folder repair safely released Music Queue
 * work; the client intentionally exposes only that bounded count.
 *
 * @param {object|null|undefined} payload
 * @returns {string}
 */
export function buildSettingsSaveSuccessMessage(payload) {
  const releasedCount = getReleasedMusicQueueCount(payload);
  if (releasedCount === 0) return 'Settings saved.';

  const releaseLabel = releasedCount === 1 ? 'release' : 'releases';
  const isSearching = payload?.musicQueueRecovery?.runStarted === true;
  const searchStatus = isSearching ? 'is searching' : 'will search';

  return `Settings saved. Music Queue ${searchStatus} for ${releasedCount} ${releaseLabel} automatically.`;
}
