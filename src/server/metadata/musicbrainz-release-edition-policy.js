/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function normalizeMusicBrainzEditionLookup({ releaseGroupId, releaseId }) {
  for (const [field, value] of Object.entries({ releaseGroupId, releaseId })) {
    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      throw createApiError(400, 'validation_error', `${field} must be a hyphenated UUID`);
    }
  }
  return { releaseGroupId: releaseGroupId.toLowerCase(), releaseId: releaseId.toLowerCase() };
}

export function assertMusicBrainzEditionMembership(payload, { releaseGroupId, releaseId }) {
  const actualReleaseId = payload?.id;
  const actualGroupId = payload?.['release-group']?.id;
  if (typeof actualReleaseId !== 'string' || !uuidPattern.test(actualReleaseId)
    || actualReleaseId.toLowerCase() !== releaseId
    || typeof actualGroupId !== 'string' || !uuidPattern.test(actualGroupId)
    || typeof payload.title !== 'string' || !payload.title.trim()) {
    throw createApiError(502, 'musicbrainz_invalid_response', 'MusicBrainz returned an invalid edition identity');
  }
  if (actualGroupId.toLowerCase() !== releaseGroupId) {
    throw createApiError(404, 'release_group_mismatch', 'The selected edition does not belong to this release group');
  }
}

export function normalizeMusicBrainzEditionTotal(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
