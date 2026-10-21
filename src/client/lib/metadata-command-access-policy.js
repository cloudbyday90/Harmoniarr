/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

// Browsing and artist import retain their separate authenticated contracts.
export function canManageMetadata(actorRole) {
  return actorRole === 'admin';
}
