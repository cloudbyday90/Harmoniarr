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

const missingMusicDecisionQueryKey = 'missingMusicDecisionId';

function readSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * The URL intentionally carries only the opaque decision identifier. Downloader
 * resolves its release and target-user context through an admin-only API.
 */
export function normalizeMissingMusicDownloaderHandoffRouteQuery(query = {}) {
  return {
    decisionId: normalizeString(readSingleQueryValue(query?.[missingMusicDecisionQueryKey])),
  };
}

export function omitMissingMusicDownloaderHandoffRouteQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(([key]) => key !== missingMusicDecisionQueryKey),
  );
}
