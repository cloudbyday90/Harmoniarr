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

import { buildFormatSearchTerm } from './format-preference-scoring.js';

export const MAX_DISCOVERY_SEARCH_ATTEMPTS = 3;

function normalizeQueryPart(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function getReleaseYear(releaseDate) {
  if (typeof releaseDate !== 'string') {
    return null;
  }

  const match = releaseDate.match(/^(\d{4})-/);
  return match?.[1] ?? null;
}

export function normalizeFallbackQuery(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[/:]/g, ' ')
    .replace(/['.!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || null;
}

function hasSafeTitleOnlySearchShape(title) {
  const normalizedTitle = normalizeFallbackQuery(title);
  if (!normalizedTitle) {
    return false;
  }

  const wordCount = normalizedTitle.split(/\s+/).filter(Boolean).length;
  return normalizedTitle.length >= 20 || wordCount >= 4;
}

function appendFormatTerm(queryParts, preferredFormat) {
  const formatTerm = buildFormatSearchTerm(preferredFormat);
  if (formatTerm) {
    queryParts.push(formatTerm);
  }

  return queryParts;
}

export function buildDiscoverySearchQuery({
  artistName,
  preferredFormat,
  releaseDate,
  releaseGroupTitle,
  releaseTitle,
  searchAttemptCount = 0,
}) {
  const title = normalizeQueryPart(releaseTitle) ?? normalizeQueryPart(releaseGroupTitle);
  const artist = normalizeQueryPart(artistName);
  const attemptCount = Number.isInteger(searchAttemptCount) && searchAttemptCount > 0
    ? searchAttemptCount
    : 0;

  if (attemptCount >= MAX_DISCOVERY_SEARCH_ATTEMPTS) {
    return null;
  }

  if (attemptCount >= 2) {
    if (!hasSafeTitleOnlySearchShape(title)) {
      return null;
    }

    const queryParts = appendFormatTerm([normalizeFallbackQuery(title)].filter(Boolean), preferredFormat);
    return queryParts.join(' ') || null;
  }

  if (attemptCount === 1) {
    const fallbackParts = [
      normalizeFallbackQuery(artist),
      normalizeFallbackQuery(title),
    ].filter(Boolean);
    const queryParts = appendFormatTerm(fallbackParts, preferredFormat);
    return queryParts.join(' ') || null;
  }

  const queryParts = appendFormatTerm([
    artist,
    title,
    getReleaseYear(releaseDate),
  ].filter(Boolean), preferredFormat);

  return queryParts.join(' ') || null;
}
