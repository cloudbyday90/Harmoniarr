/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
export const OPERATOR_TRACK_READ_BUFFER_BYTES = 64 * 1024;
export const OPERATOR_TRACK_READ_BUFFER_OPTIONS = Object.freeze([64 * 1024, 256 * 1024, 1024 * 1024]);

export function resolveOperatorTrackReadBuffer(value = OPERATOR_TRACK_READ_BUFFER_BYTES) {
  if (!OPERATOR_TRACK_READ_BUFFER_OPTIONS.includes(value)) throw new TypeError('Unsupported track fingerprint read buffer');
  return value;
}
