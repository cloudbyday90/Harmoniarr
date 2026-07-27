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

export const MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES = Object.freeze([
  'adding_to_library',
  'checking_matches',
  'downloading',
  'ready_to_add',
  'searching',
  'trying_next_match',
]);

export const MUSIC_QUEUE_ATTENTION_STATUSES = Object.freeze([
  'failed',
  'needs_help_adding',
  'needs_setup',
  'no_matches_left',
  'pick_match',
  'quality_choice_needed',
]);

const activeProgressStatusSet = new Set(MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES);
const attentionStatusSet = new Set(MUSIC_QUEUE_ATTENTION_STATUSES);

export function getMusicQueueReleaseStatusCode(release) {
  return release?.statusCode ?? release?.status?.code ?? '';
}

export function isMusicQueueActiveProgressRelease(release) {
  return activeProgressStatusSet.has(getMusicQueueReleaseStatusCode(release));
}

export function isMusicQueueAttentionRelease(release) {
  return attentionStatusSet.has(getMusicQueueReleaseStatusCode(release));
}

export function isMusicQueueHomeProgressRelease(release) {
  return isMusicQueueActiveProgressRelease(release) || isMusicQueueAttentionRelease(release);
}

export function hasMusicQueueHomeProgress(releases) {
  return Array.isArray(releases) && releases.some(isMusicQueueHomeProgressRelease);
}
