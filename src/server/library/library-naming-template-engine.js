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

const TOKEN_PATTERN = /\{(\w+)(?::(\d+))?\}/g;

const PATH_SEPARATOR_PATTERN = /[\\/]/;
const PARENT_DIRECTORY_PATTERN = /\.\./;

export const DEFAULT_NAMING_TEMPLATES = Object.freeze({
  artistFolderFormat: '{ArtistName}',
  albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
  trackFilenameFormat: '{TrackNumber} - {SongTitle}',
  multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
});

export const NAMING_TEMPLATE_TOKENS = Object.freeze({
  ArtistName: { description: 'Artist name from metadata', availableIn: ['artist', 'album', 'track'] },
  AlbumTitle: { description: 'Album or release group title', availableIn: ['album', 'track'] },
  ReleaseYear: { description: 'Four-digit release year', availableIn: ['album', 'track'] },
  SongTitle: { description: 'Track title from metadata', availableIn: ['track'] },
  TrackNumber: { description: 'Track position on disc', availableIn: ['track'] },
  DiscNumber: { description: 'Disc or medium position', availableIn: ['track'] },
  DiscCount: { description: 'Total disc or medium count', availableIn: ['track'] },
});

export function resolveTemplate(template, context) {
  if (typeof template !== 'string' || template.length === 0) {
    return '';
  }

  TOKEN_PATTERN.lastIndex = 0;

  return template.replace(TOKEN_PATTERN, (match, tokenName, truncationLength) => {
    const resolved = context[tokenName];

    if (resolved === undefined || resolved === null) {
      return match;
    }

    const stringValue = String(resolved);

    if (truncationLength !== undefined) {
      const maximumLength = Number.parseInt(truncationLength, 10);

      if (maximumLength >= 0) {
        return stringValue.slice(0, maximumLength);
      }
    }

    return stringValue;
  });
}

export function validateTemplate(template) {
  if (typeof template !== 'string') {
    return { valid: false, reason: 'Template must be a string.' };
  }

  const trimmed = template.trim();

  if (trimmed.length === 0) {
    return { valid: false, reason: 'Template must not be empty.' };
  }

  if (PATH_SEPARATOR_PATTERN.test(trimmed)) {
    return { valid: false, reason: 'Template must not contain path separators (/ or \\).' };
  }

  if (PARENT_DIRECTORY_PATTERN.test(trimmed)) {
    return { valid: false, reason: 'Template must not contain parent directory references (..).' };
  }

  return { valid: true };
}

export function listAvailableTokens() {
  return Object.entries(NAMING_TEMPLATE_TOKENS).map(([name, meta]) => ({
    name,
    ...meta,
  }));
}
