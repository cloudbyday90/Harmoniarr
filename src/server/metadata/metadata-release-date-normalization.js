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

function isValidDateParts({ day, month, year }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function normalizeMetadataReleaseDateForDateColumn(value) {
  if (value == null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T.*)?$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2] ?? '01', 10);
  const day = Number.parseInt(match[3] ?? '01', 10);
  if (!isValidDateParts({ day, month, year })) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function parseMetadataReleaseDateInstant(value) {
  const normalized = normalizeMetadataReleaseDateForDateColumn(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
