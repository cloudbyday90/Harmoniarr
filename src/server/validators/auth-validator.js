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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'Username must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,32}$/.test(normalized)) {
    throw createApiError(400, 'validation_error', 'Username must be 3-32 characters using letters, numbers, dot, dash, or underscore');
  }

  return normalized;
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'Email must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!emailPattern.test(normalized)) {
    throw createApiError(400, 'validation_error', 'Email must be a valid address');
  }

  return normalized;
}

export function normalizeOptionalEmail(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'Email must be a string');
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return normalizeEmail(trimmed);
}

export function normalizeLoginIdentifier(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'Username or email must be a string');
  }

  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    return normalizeEmail(trimmed);
  }

  return normalizeUsername(trimmed);
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 10) {
    throw createApiError(400, 'validation_error', 'Password must be at least 10 characters long');
  }

  return value;
}
