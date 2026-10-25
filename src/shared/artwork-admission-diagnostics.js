/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const fields = Object.freeze(['active', 'queued', 'queuedInputBytes', 'reservedBytes', 'budgetBytes',
  'concurrencyLimit', 'queueLimit', 'queuedInputLimitBytes', 'queueTimeoutMs']);

/** A fixed numeric projection; unavailable observations never become idle zeroes. */
export function projectArtworkAdmissionSnapshot(value) {
  if (!value) return null;
  value = Object.fromEntries(fields.map(key => [key, value[key]]));
  if (!fields.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)
    || value.concurrencyLimit < 1 || value.concurrencyLimit > 8 || value.queueLimit > 256
    || value.budgetBytes < 1 || value.queueTimeoutMs < 1 || value.queueTimeoutMs > 60_000
    || value.active > value.concurrencyLimit || value.queued > value.queueLimit
    || value.reservedBytes > value.budgetBytes || value.queuedInputBytes > value.queuedInputLimitBytes
    || (value.active === 0 && value.reservedBytes !== 0) || (value.queued === 0 && value.queuedInputBytes !== 0)) return null;
  return Object.fromEntries(fields.map(key => [key, value[key]]));
}

export function projectArtworkAdmissionObservation(value) {
  const snapshot = projectArtworkAdmissionSnapshot(value);
  if (!snapshot || typeof value.capturedAt !== 'string' || value.capturedAt.length > 32
    || !Number.isFinite(Date.parse(value.capturedAt)) || new Date(value.capturedAt).toISOString() !== value.capturedAt) return null;
  return { ...snapshot, capturedAt: value.capturedAt };
}
