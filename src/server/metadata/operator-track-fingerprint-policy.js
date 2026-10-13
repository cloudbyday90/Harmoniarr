/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
export const OPERATOR_TRACK_READ_BUFFER_BYTES = 64 * 1024;
export const OPERATOR_TRACK_REUSABLE_BUFFER_BYTES = 256 * 1024;
export const OPERATOR_TRACK_READ_BUFFER_OPTIONS = Object.freeze([64 * 1024, 256 * 1024, 1024 * 1024]);
export const OPERATOR_TRACK_READ_METHOD = 'reusable';
export const OPERATOR_TRACK_READ_METHODS = Object.freeze(['stream', 'reusable']);

export function resolveOperatorTrackReadBuffer(value, method = 'stream') {
  if (!OPERATOR_TRACK_READ_METHODS.includes(method)) throw new TypeError('Unsupported track fingerprint read method');
  const requested = value === undefined ? (method === 'reusable' ? OPERATOR_TRACK_REUSABLE_BUFFER_BYTES : OPERATOR_TRACK_READ_BUFFER_BYTES) : value;
  if (!OPERATOR_TRACK_READ_BUFFER_OPTIONS.includes(requested)) throw new TypeError('Unsupported track fingerprint read buffer');
  return requested;
}

export function resolveOperatorTrackReadMethod(value = OPERATOR_TRACK_READ_METHOD) {
  if (!OPERATOR_TRACK_READ_METHODS.includes(value)) throw new TypeError('Unsupported track fingerprint read method');
  return value;
}

export function captureOperatorTrackFileStat(value) {
  if (!value || !Number.isSafeInteger(value.size) || value.size < 0
    || !['mtimeMs', 'ino', 'dev'].every(field => Number.isFinite(value[field]))) throw new TypeError('Invalid captured track file evidence');
  return Object.freeze({ size: value.size, mtimeMs: value.mtimeMs, ino: value.ino, dev: value.dev });
}

export function assertOperatorTrackFileStatCurrent(before, after) {
  if (['size', 'mtimeMs', 'ino', 'dev'].some(field => before[field] !== after[field])) throw new Error('Track changed while collecting evidence');
}
