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

import { MUSIC_QUEUE_STATUS_CODES } from '../acquisition/acquisition-pipeline-status-service.js';
import { createApiError } from '../auth.js';

export const MISSING_MUSIC_DECISION_STATES = Object.freeze([
  'action',
  'searching',
  'downloading',
  'ready',
  'all',
]);

const ACTION_STATUS_CODES = new Set([
  MUSIC_QUEUE_STATUS_CODES.FAILED,
  MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING,
  MUSIC_QUEUE_STATUS_CODES.NEEDS_SETUP,
  MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT,
  MUSIC_QUEUE_STATUS_CODES.PICK_MATCH,
  MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED,
]);

const SEARCHING_STATUS_CODES = new Set([
  MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES,
  MUSIC_QUEUE_STATUS_CODES.QUEUED_FOR_SEARCH,
  MUSIC_QUEUE_STATUS_CODES.RETRYING_SEARCH,
  MUSIC_QUEUE_STATUS_CODES.SEARCHING,
  MUSIC_QUEUE_STATUS_CODES.TRYING_NEXT_MATCH,
]);

const DOWNLOADING_STATUS_CODES = new Set([
  MUSIC_QUEUE_STATUS_CODES.ADDING_TO_LIBRARY,
  MUSIC_QUEUE_STATUS_CODES.DOWNLOADING,
]);

export function normalizeMissingMusicDecisionState(value) {
  if (value === null || value === undefined || value === '') {
    return 'all';
  }

  if (typeof value !== 'string' || !MISSING_MUSIC_DECISION_STATES.includes(value.trim())) {
    throw createApiError(400, 'validation_error', 'state must be action, searching, downloading, ready, or all');
  }

  return value.trim();
}

export function deriveMissingMusicDecisionState(statusCode) {
  if (ACTION_STATUS_CODES.has(statusCode)) {
    return 'action';
  }

  if (SEARCHING_STATUS_CODES.has(statusCode)) {
    return 'searching';
  }

  if (DOWNLOADING_STATUS_CODES.has(statusCode)) {
    return 'downloading';
  }

  if (statusCode === MUSIC_QUEUE_STATUS_CODES.READY_TO_ADD) {
    return 'ready';
  }

  return 'other';
}
