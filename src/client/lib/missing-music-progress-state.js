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

export const MISSING_MUSIC_ACTIVE_PROGRESS_STATUSES = Object.freeze([
  'adding_to_library',
  'checking_matches',
  'downloading',
  'ready_to_add',
  'searching',
  'trying_next_match',
]);

export const MISSING_MUSIC_ATTENTION_STATUSES = Object.freeze([
  'failed',
  'needs_help_adding',
  'needs_setup',
  'no_matches_left',
  'pick_match',
  'quality_choice_needed',
]);

const activeProgressStatusSet = new Set(MISSING_MUSIC_ACTIVE_PROGRESS_STATUSES);
const attentionStatusSet = new Set(MISSING_MUSIC_ATTENTION_STATUSES);

export function getMissingMusicReleaseStatusCode(release) {
  return release?.statusCode ?? release?.status?.code ?? '';
}

export function isMissingMusicActiveProgressRelease(release) {
  return activeProgressStatusSet.has(getMissingMusicReleaseStatusCode(release));
}

export function isMissingMusicAttentionRelease(release) {
  return attentionStatusSet.has(getMissingMusicReleaseStatusCode(release));
}

export function isMissingMusicHomeProgressRelease(release) {
  return isMissingMusicActiveProgressRelease(release) || isMissingMusicAttentionRelease(release);
}

export function hasMissingMusicHomeProgress(releases) {
  return Array.isArray(releases) && releases.some(isMissingMusicHomeProgressRelease);
}
