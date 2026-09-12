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

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalidField(message) {
  return Object.assign(new Error(message), { status: 400, code: 'validation_error' });
}

export function normalizeNullableTrackInteger(value, field, minimum = 1) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < minimum || value > POSTGRES_INTEGER_MAX) {
    throw invalidField(`${field} must be an integer between ${minimum} and ${POSTGRES_INTEGER_MAX} when provided`);
  }
  return value;
}

export function normalizeNullableTrackUuid(value, field) {
  if (value == null) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw invalidField(`${field} must be a hyphenated UUID when provided`);
  }
  return value.trim().toLowerCase();
}
