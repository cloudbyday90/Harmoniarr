/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../../auth.js';
import { appleMusicMaxPemBytes, captureAppleMusicPrivateKey } from './apple-music-signing-policy.js';

/** Empty identifiers support staged setup and explicit settings resets. */
export function normalizeAppleMusicIdentifier(value, fieldPath) {
  if (typeof value !== 'string') throw createApiError(400, 'validation_error', `${fieldPath} must be a string`);
  const normalized = value.trim();
  if (normalized !== '' && !/^[A-Za-z0-9]{10}$/u.test(normalized)) {
    throw createApiError(400, 'validation_error', `${fieldPath} must be empty or contain exactly 10 ASCII letters or digits`);
  }
  return normalized;
}

/** Validate only a submitted replacement; blank retains the existing secret. */
export function normalizeAppleMusicPrivateKey(value) {
  try {
    if (typeof value !== 'string' || Buffer.byteLength(value) > appleMusicMaxPemBytes) throw new Error();
    const normalized = value.trim();
    if (normalized) captureAppleMusicPrivateKey(normalized);
    return normalized;
  } catch {
    throw createApiError(400, 'validation_error', 'providers.appleMusicPrivateKey must be an unencrypted P-256 private PEM key of at most 16384 bytes');
  }
}
