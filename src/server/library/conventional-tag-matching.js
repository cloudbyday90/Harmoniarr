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

const titleSuffixPattern = /\s*[([](feat\.|ft\.|featuring|with|live|remaster(?:ed)?|remix(?:ed)?|bonus|acoustic|demo|radio)[^)\]]*[)\]].*$/iu;
const dashCreditSuffixPattern = /\s+-\s+(feat\.|ft\.|featuring|with)\s+.*$/iu;

export function normalizeMatchText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return normalized || null;
}

export function normalizeConventionalTitle(value) {
  if (typeof value !== 'string') {
    return null;
  }

  return normalizeMatchText(value
    .replace(titleSuffixPattern, '')
    .replace(dashCreditSuffixPattern, '')
    .trim());
}

export function getConventionalArtist(normalizedTags) {
  const candidates = [
    normalizedTags?.albumArtist,
    normalizedTags?.artist,
    normalizedTags?.artists?.[0],
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;
}

export function getArtistTokenSet(value) {
  const normalized = normalizeMatchText(value);
  if (!normalized) {
    return new Set();
  }

  return new Set(normalized.split(' ').filter((token) => token.length >= 3));
}

export function artistTokensOverlap(tagArtist, candidateArtist) {
  const tagTokens = getArtistTokenSet(tagArtist);
  if (tagTokens.size === 0) {
    return false;
  }

  const candidateTokens = getArtistTokenSet(candidateArtist);
  for (const token of tagTokens) {
    if (candidateTokens.has(token)) {
      return true;
    }
  }

  return false;
}

export function findConventionalTagMatches({
  candidates,
  normalizedTags,
  scopeMetadataReleaseId = null,
} = {}) {
  const trackPosition = normalizedTags?.track?.number ?? null;
  const normalizedTitle = normalizeConventionalTitle(normalizedTags?.title ?? null);
  if (!Number.isInteger(trackPosition) || !normalizedTitle) {
    return {
      reason: 'missing_title_or_track_position',
      scopeMatches: [],
      globalMatches: [],
      normalizedAlbum: null,
      normalizedArtist: null,
      normalizedTitle,
      trackPosition,
    };
  }

  const scopedCandidates = scopeMetadataReleaseId
    ? candidates.filter((candidate) => candidate.metadataReleaseId === scopeMetadataReleaseId)
    : [];
  const scopeMatches = scopedCandidates
    .filter((candidate) => candidate.trackPosition === trackPosition)
    .filter((candidate) => normalizeConventionalTitle(candidate.trackTitle) === normalizedTitle);

  const tagArtist = getConventionalArtist(normalizedTags);
  const normalizedArtist = normalizeMatchText(tagArtist);
  const normalizedAlbum = normalizeMatchText(normalizedTags?.album ?? null);
  const artistScopedMatches = candidates
    .filter((candidate) => artistTokensOverlap(tagArtist, candidate.releaseArtistName))
    .filter((candidate) => candidate.trackPosition === trackPosition)
    .filter((candidate) => normalizeConventionalTitle(candidate.trackTitle) === normalizedTitle);

  const albumScopedMatches = normalizedAlbum
    ? artistScopedMatches.filter((candidate) => normalizeMatchText(candidate.releaseTitle) === normalizedAlbum)
    : [];
  const globalMatches = albumScopedMatches.length > 0 ? albumScopedMatches : artistScopedMatches;

  return {
    reason: null,
    scopeMatches,
    globalMatches,
    normalizedAlbum,
    normalizedArtist,
    normalizedTitle,
    trackPosition,
  };
}
