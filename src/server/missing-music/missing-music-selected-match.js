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

const MAX_MATCH_ID_LENGTH = 200;

function normalizeMatchId(value) {
  if (typeof value !== 'string') return null;

  const matchId = value.trim();
  return matchId.length > 0 && matchId.length <= MAX_MATCH_ID_LENGTH ? matchId : null;
}

/**
 * Resolves a single selected candidate from server-owned release evidence.
 * A malformed or ambiguous snapshot deliberately has no actionable match;
 * callers must fail safely rather than guess which provider request to send.
 */
export function findSelectedMissingMusicMatchId(release) {
  const matches = release?.discoveryRequest?.importReviewSummary?.matches;
  if (!Array.isArray(matches)) return null;

  const selectedMatchIds = [...new Set(matches
    .filter((match) => match?.status === 'selected')
    .map((match) => normalizeMatchId(match?.matchId))
    .filter(Boolean))];

  return selectedMatchIds.length === 1 ? selectedMatchIds[0] : null;
}
