/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

/** Copy only bounded scalar metadata before it can enter the waiting queue. */
import { createApiError } from '../api-error.js';

export function normalizeArtworkFetchRequest(input) {
  const { ownerType, ownerId, artworkRole = 'cover_front', refresh = false } = input ?? {};
  if (typeof ownerType !== 'string' || !ownerType || ownerType.length > 64
    || typeof ownerId !== 'string' || !ownerId || ownerId.length > 256
    || typeof artworkRole !== 'string' || !artworkRole || artworkRole.length > 64
    || typeof refresh !== 'boolean') {
    throw createApiError(400, 'validation_error', 'Invalid artwork request metadata');
  }
  return { ownerType, ownerId, artworkRole, refresh };
}
