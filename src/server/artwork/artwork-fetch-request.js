/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

/** Copy only bounded scalar metadata before it can enter the waiting queue. */
export function normalizeArtworkFetchRequest(input) {
  const { ownerType, ownerId, artworkRole = 'cover_front', refresh = false } = input ?? {};
  if (typeof ownerType !== 'string' || !ownerType || ownerType.length > 64
    || typeof ownerId !== 'string' || !ownerId || ownerId.length > 256
    || typeof artworkRole !== 'string' || !artworkRole || artworkRole.length > 64
    || typeof refresh !== 'boolean') {
    throw Object.assign(new Error('Invalid artwork request metadata'), { status: 400, code: 'validation_error' });
  }
  return { ownerType, ownerId, artworkRole, refresh };
}
