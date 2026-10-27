/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from './api-error.js';

export const maximumPasswordBytes = 4096;

export function assertPasswordInput(password) {
  if (typeof password !== 'string') throw createApiError(400, 'validation_error', 'Password must be a string');
  if (password.length > maximumPasswordBytes || Buffer.byteLength(password, 'utf8') > maximumPasswordBytes) {
    throw createApiError(400, 'validation_error', `Password must be at most ${maximumPasswordBytes} UTF-8 bytes`);
  }
  return password;
}
