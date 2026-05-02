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

import { normalizeFileExtension } from './library-file-type-policy.js';

const windowsReservedNames = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

const reservedCharacterPattern = /[<>:"/\\|?*\u0000-\u001F]+/g;
const whitespacePattern = /\s+/g;
const edgeDotsWhitespaceAndHyphenPattern = /^[.\s-]+|[.\s-]+$/g;
const repeatedReplacementPattern = /(?:\s-\s){2,}/g;

function normalizeText(value) {
  return typeof value === 'string' ? value.normalize('NFC') : '';
}

function collapseWhitespace(value) {
  return value.replace(whitespacePattern, ' ').trim();
}

function protectReservedDeviceName(stem) {
  return windowsReservedNames.has(stem.toUpperCase()) ? `${stem}_` : stem;
}

function splitFilename(value) {
  const normalizedValue = String(value ?? '');
  const lastDotIndex = normalizedValue.lastIndexOf('.');

  if (lastDotIndex <= 0 || lastDotIndex === normalizedValue.length - 1) {
    return {
      extension: '',
      stem: normalizedValue,
    };
  }

  return {
    extension: normalizedValue.slice(lastDotIndex),
    stem: normalizedValue.slice(0, lastDotIndex),
  };
}

function sanitizeStem(value, { fallback = 'untitled', replacement = ' - ' } = {}) {
  const normalizedValue = normalizeText(value);
  const replaced = normalizedValue.replace(reservedCharacterPattern, replacement);
  const collapsed = collapseWhitespace(replaced).replace(repeatedReplacementPattern, ' - ');
  const trimmed = collapsed.replace(edgeDotsWhitespaceAndHyphenPattern, '');
  const safeStem = trimmed || fallback;

  return protectReservedDeviceName(safeStem);
}

function resolveReleaseYear(releaseDate) {
  const match = String(releaseDate ?? '').match(/^(\d{4})/);
  return match?.[1] ?? null;
}

function formatTrackNumber(trackNumber) {
  const parsed = Number.parseInt(String(trackNumber ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed).padStart(2, '0') : '00';
}

export function createLibraryNamingService() {
  function sanitizeLibraryPathSegment(value, options = {}) {
    return sanitizeStem(value, options);
  }

  function sanitizeLibraryFilename(value, {
    extension = null,
    fallback = 'untitled',
  } = {}) {
    const split = splitFilename(value);
    const resolvedExtension = normalizeFileExtension(extension ?? split.extension);
    const safeStem = sanitizeStem(split.stem, { fallback });

    return `${safeStem}${resolvedExtension}`;
  }

  function buildArtistFolderName({ artistName }) {
    return sanitizeLibraryPathSegment(artistName, { fallback: 'Unknown Artist' });
  }

  function buildAlbumFolderName({ albumTitle, releaseDate = null }) {
    const safeAlbumTitle = sanitizeLibraryPathSegment(albumTitle, { fallback: 'Unknown Album' });
    const releaseYear = resolveReleaseYear(releaseDate);

    return releaseYear ? `${safeAlbumTitle} (${releaseYear})` : safeAlbumTitle;
  }

  function buildTrackFilename({
    discNumber = null,
    extension = '',
    isMultiDisc = false,
    trackNumber,
    trackTitle,
  }) {
    const trackLabel = formatTrackNumber(trackNumber);
    const discLabel = Number.isInteger(Number.parseInt(String(discNumber ?? ''), 10))
      ? `${Number.parseInt(String(discNumber), 10)}-`
      : '';
    const prefix = isMultiDisc ? `${discLabel}${trackLabel}` : trackLabel;
    const safeTrackTitle = sanitizeLibraryPathSegment(trackTitle, { fallback: 'Unknown Track' });

    return `${prefix} - ${safeTrackTitle}${normalizeFileExtension(extension)}`;
  }

  return {
    buildAlbumFolderName,
    buildArtistFolderName,
    buildTrackFilename,
    sanitizeLibraryFilename,
    sanitizeLibraryPathSegment,
  };
}
