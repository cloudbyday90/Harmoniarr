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
import { DEFAULT_NAMING_TEMPLATES, resolveTemplate } from './library-naming-template-engine.js';
import { loadSettings } from '../settings.js';

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

const reservedCharacterPattern = /[<>:"/\\|?*]+/g;
const whitespacePattern = /\s+/g;
const edgeDotsWhitespaceAndHyphenPattern = /^[.\s-]+|[.\s-]+$/g;
const repeatedReplacementPattern = /(?:\s-\s){2,}/g;

function replaceControlCharacters(value, replacement) {
  let output = '';

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    output += codePoint !== undefined && codePoint <= 0x1F
      ? replacement
      : character;
  }

  return output;
}

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
  const withoutControlCharacters = replaceControlCharacters(normalizedValue, replacement);
  const replaced = withoutControlCharacters.replace(reservedCharacterPattern, replacement);
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

function resolveNamingSettings(settings) {
  const naming = settings?.naming;
  if (!naming || typeof naming !== 'object') {
    return DEFAULT_NAMING_TEMPLATES;
  }

  return {
    artistFolderFormat: naming.artistFolderFormat ?? DEFAULT_NAMING_TEMPLATES.artistFolderFormat,
    albumFolderFormat: naming.albumFolderFormat ?? DEFAULT_NAMING_TEMPLATES.albumFolderFormat,
    trackFilenameFormat: naming.trackFilenameFormat ?? DEFAULT_NAMING_TEMPLATES.trackFilenameFormat,
    multiDiscTrackFilenameFormat: naming.multiDiscTrackFilenameFormat ?? DEFAULT_NAMING_TEMPLATES.multiDiscTrackFilenameFormat,
  };
}

function buildTemplateContext({ artistName, albumTitle, releaseDate, trackNumber, trackTitle, discNumber, discCount }) {
  return {
    ArtistName: artistName ?? '',
    AlbumTitle: albumTitle ?? '',
    ReleaseYear: resolveReleaseYear(releaseDate) ?? '',
    SongTitle: trackTitle ?? '',
    TrackNumber: formatTrackNumber(trackNumber),
    DiscNumber: discNumber != null ? String(discNumber) : '',
    DiscCount: discCount != null ? String(discCount) : '',
  };
}

export function createLibraryNamingService({
  loadSettingsFn = loadSettings,
} = {}) {
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

  async function loadNamingTemplates() {
    try {
      const settings = await loadSettingsFn();
      return resolveNamingSettings(settings);
    } catch {
      return DEFAULT_NAMING_TEMPLATES;
    }
  }

  async function buildArtistFolderName({ artistName }) {
    const templates = await loadNamingTemplates();
    const context = buildTemplateContext({ artistName });
    const resolved = resolveTemplate(templates.artistFolderFormat, context);
    return sanitizeLibraryPathSegment(resolved, { fallback: 'Unknown Artist' });
  }

  async function buildAlbumFolderName({ albumTitle, releaseDate = null }) {
    const templates = await loadNamingTemplates();
    const context = buildTemplateContext({ albumTitle, releaseDate });
    const resolved = resolveTemplate(templates.albumFolderFormat, context);
    return sanitizeLibraryPathSegment(resolved, { fallback: 'Unknown Album' });
  }

  async function buildTrackFilename({
    discNumber = null,
    extension = '',
    isMultiDisc = false,
    trackNumber,
    trackTitle,
  }) {
    const templates = await loadNamingTemplates();
    const templateKey = isMultiDisc ? 'multiDiscTrackFilenameFormat' : 'trackFilenameFormat';
    const context = buildTemplateContext({ discNumber, trackNumber, trackTitle });
    const resolved = resolveTemplate(templates[templateKey], context);
    return `${sanitizeLibraryPathSegment(resolved, { fallback: 'Unknown Track' })}${normalizeFileExtension(extension)}`;
  }

  return {
    buildAlbumFolderName,
    buildArtistFolderName,
    buildTrackFilename,
    sanitizeLibraryFilename,
    sanitizeLibraryPathSegment,
  };
}
