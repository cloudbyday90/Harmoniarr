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

const SELECTABLE_MATCH_STATUSES = new Set(['pending', 'held']);
const MAX_MATCH_ID_LENGTH = 200;
const MAX_MATCH_CHOICES = 12;
const MAX_FORMAT_LENGTH = 40;

function normalizeIdentifier(value) {
  if (typeof value !== 'string') return null;

  const identifier = value.trim();
  return identifier.length > 0 && identifier.length <= MAX_MATCH_ID_LENGTH ? identifier : null;
}

function normalizeNonNegativeInteger(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function normalizeFormats(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value
    .map((format) => (typeof format === 'string' ? format.trim().toUpperCase() : ''))
    .filter(Boolean)
    .map((format) => format.slice(0, MAX_FORMAT_LENGTH)))]
    .slice(0, 8);
}

function listReleaseMatches(release) {
  const matches = release?.discoveryRequest?.importReviewSummary?.matches;
  return Array.isArray(matches) ? matches : [];
}

export function findSelectableMissingMusicMatch(release, matchId) {
  const normalizedMatchId = normalizeIdentifier(matchId);
  if (!normalizedMatchId) return null;

  return listReleaseMatches(release).find((match) => (
    normalizeIdentifier(match?.matchId) === normalizedMatchId
      && SELECTABLE_MATCH_STATUSES.has(match?.status)
  )) ?? null;
}

/**
 * Projects only facts useful for choosing a release match. Peer identities,
 * provider identifiers, transfer state, paths, queue data, and scoring
 * internals are intentionally excluded from this browser-facing shape.
 */
export function buildMissingMusicMatchChoices(release) {
  const choices = [];
  const seenIds = new Set();

  for (const match of listReleaseMatches(release)) {
    if (!SELECTABLE_MATCH_STATUSES.has(match?.status)) continue;

    const id = normalizeIdentifier(match?.matchId);
    if (!id || seenIds.has(id)) continue;

    seenIds.add(id);
    choices.push({
      fileCount: normalizeNonNegativeInteger(match.fileCount),
      formats: normalizeFormats(match.formats),
      id,
      totalSizeBytes: normalizeNonNegativeInteger(match.totalSizeBytes),
    });
    if (choices.length === MAX_MATCH_CHOICES) break;
  }

  return choices;
}
