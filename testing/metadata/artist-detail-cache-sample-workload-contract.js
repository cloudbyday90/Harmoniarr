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

export function assertArtistDetailCacheSampleRead(value, label) {
  if (typeof value !== 'function') {
    throw new Error(`${label} must be a function`);
  }
}

export function normalizeArtistDetailCacheSampleCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('catalog must contain at least one Artist Detail sample');
  }

  const artistIds = new Set();
  for (const sample of catalog) {
    const artistId = typeof sample?.musicBrainzArtistId === 'string'
      ? sample.musicBrainzArtistId.trim()
      : '';
    if (!artistId) {
      throw new Error('each Artist Detail cache sample requires musicBrainzArtistId');
    }
    if (artistIds.has(artistId)) {
      throw new Error('Artist Detail cache sample IDs must be unique');
    }
    artistIds.add(artistId);
  }

  return catalog;
}

export function normalizeArtistDetailCacheSampleLimit(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}
