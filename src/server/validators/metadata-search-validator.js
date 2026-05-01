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

import { createApiError } from '../auth.js';

const allowedReleaseGroupStatusValues = new Set(['website-default', 'all']);
const allowedReleaseGroupTypeValues = new Set([
  'album',
  'single',
  'ep',
  'broadcast',
  'other',
  'audio drama',
  'audiobook',
  'compilation',
  'demo',
  'dj-mix',
  'field recording',
  'interview',
  'live',
  'mixtape/street',
  'remix',
  'soundtrack',
  'spokenword',
]);

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeSearchText(value, fieldName) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  if (normalized.length > 200) {
    throw createApiError(400, 'validation_error', `${fieldName} must be 200 characters or less`);
  }

  return normalized;
}

export function normalizeSearchLimit(value, fallback = 10) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 25) {
    throw createApiError(400, 'validation_error', 'limit must be an integer between 1 and 25');
  }

  return parsed;
}

export function normalizeSearchOffset(value, fallback = 0) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw createApiError(400, 'validation_error', 'offset must be an integer greater than or equal to 0');
  }

  return parsed;
}

export function normalizeReleaseGroupStatus(value, fallback = 'website-default') {
  if (value == null || value === '') {
    return fallback;
  }

  if (!allowedReleaseGroupStatusValues.has(value)) {
    throw createApiError(400, 'validation_error', 'releaseGroupStatus must be website-default or all');
  }

  return value;
}

export function normalizeReleaseGroupType(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'type must be a string');
  }

  const normalized = value
    .split('|')
    .map((entry) => normalizeWhitespace(entry).toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) {
    return null;
  }

  for (const entry of normalized) {
    if (!allowedReleaseGroupTypeValues.has(entry)) {
      throw createApiError(400, 'validation_error', `Unsupported release-group type: ${entry}`);
    }
  }

  return normalized.join('|');
}