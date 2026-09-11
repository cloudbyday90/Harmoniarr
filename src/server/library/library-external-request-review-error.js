/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { mapDatabaseError, normalizeDatabaseConnectionError } from '../database-error-mapper.js';

const publicCodes = new Set([
  'validation_error', 'media_request_not_found', 'external_request_required',
  'external_request_inactive', 'media_request_target_ineligible',
  'provider_ingest_request_not_found', 'external_request_item_not_reviewable',
  'external_request_review_conflict', 'metadata_release_not_found',
  'external_request_preparation_complete', 'recovery_lock_conflict',
]);

export function normalizeExternalRequestReviewError(error) {
  const mapped = normalizeDatabaseConnectionError(mapDatabaseError(error));
  if (mapped !== error) return mapped;
  if (error?.status >= 400 && error.status < 500 && publicCodes.has(error.code)) return error;
  const safeError = createApiError(500, 'external_request_review_failed', 'External request review could not be completed. Refresh the request before trying again.');
  safeError.cause = error;
  return safeError;
}
