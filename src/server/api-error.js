/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export function createApiError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
