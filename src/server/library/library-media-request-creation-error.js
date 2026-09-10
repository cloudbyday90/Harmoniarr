/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { mapDatabaseError, normalizeDatabaseConnectionError } from '../database-error-mapper.js';

const publicRequestErrorCodes = new Set([
  'app_user_not_found',
  'forbidden',
  'media_request_no_eligible_targets',
  'media_request_target_ineligible',
  'recovery_lock_conflict',
  'validation_error',
]);

export function normalizeMediaRequestCreationError(error) {
  const mapped = normalizeDatabaseConnectionError(mapDatabaseError(error));
  if (mapped !== error) return mapped;
  if (error?.status >= 400 && error.status < 500 && publicRequestErrorCodes.has(error.code)) {
    return error;
  }
  const publicError = createApiError(
    500,
    'media_request_creation_failed',
    'Music request submission could not be completed. Check your requests before trying again.',
  );
  publicError.cause = error;
  return publicError;
}
