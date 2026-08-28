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

export function getMissingMusicCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizeMissingMusicToken(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function findFirstPresentString(values) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;
}

export function getMissingMusicReleaseYear(releaseDate) {
  if (!releaseDate) return null;
  const year = String(releaseDate).slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

export function formatMissingMusicReleaseType(value) {
  const normalized = normalizeMissingMusicToken(value);
  if (!normalized) return 'Release';
  if (normalized === 'ep') return 'EP';
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getMissingMusicLastActivityAt(release) {
  return findFirstPresentString([
    release?.evidence?.match?.latestUpdatedAt,
    release?.evidence?.search?.lastSearchAt,
    release?.lastReconciledAt,
  ]);
}
