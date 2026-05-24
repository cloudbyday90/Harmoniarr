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

import { createApiError } from './auth.js';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

const CONNECTION_ERROR_SQLSTATES = new Set([
  '57P01',
  '57P02',
  '57P03',
  '08003',
  '08006',
]);

function isDatabaseConnectionError(error) {
  if (CONNECTION_ERROR_CODES.has(error?.code)) return true;
  if (CONNECTION_ERROR_SQLSTATES.has(error?.code)) return true;
  if (error?.syscall === 'connect') return true;
  return false;
}

export function mapDatabaseError(error) {
  if (!error?.code) return error;

  switch (error.code) {
    case PG_UNIQUE_VIOLATION:
      return createApiError(409, 'conflict', 'Resource already exists');

    case PG_FK_VIOLATION:
      return createApiError(422, 'fk_violation', 'Referenced resource does not exist');

    case PG_NOT_NULL_VIOLATION:
      return createApiError(422, 'validation_error', 'Required field is missing');

    default:
      return error;
  }
}

export function mapDatabaseErrorWithConstraints(constraintMap = {}) {
  return function mapWithConstraints(error) {
    if (error?.code === PG_UNIQUE_VIOLATION && error?.constraint) {
      const mapped = constraintMap[error.constraint];
      if (mapped) {
        return createApiError(mapped.status ?? 409, mapped.code, mapped.message);
      }
    }

    return mapDatabaseError(error);
  };
}

export function normalizeDatabaseConnectionError(error) {
  if (!isDatabaseConnectionError(error)) return error;
  return createApiError(503, 'database_unavailable', 'Database is temporarily unavailable');
}
