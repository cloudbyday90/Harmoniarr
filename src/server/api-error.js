/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const publicErrors = new WeakMap();

export function createApiError(status, code, message) {
  const error = Object.assign(new Error(message), { status, code });
  if (Number.isInteger(status) && status >= 400 && status <= 599
    && typeof code === 'string' && code.length > 0 && code.length <= 128
    && typeof message === 'string' && message.length > 0 && message.length <= 2048) {
    publicErrors.set(error, Object.freeze({ status, code, message }));
  }
  return error;
}

/** Only the original factory-owned error has public intent; arbitrary fields do not. */
export function getPublicApiError(error) {
  return publicErrors.get(error) ?? null;
}
