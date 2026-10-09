/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Retain supported observation fields without copying arbitrary provider properties. */
export function normalizeSlskdDownloadTransfer(transfer) {
  if (!transfer || typeof transfer !== 'object' || Array.isArray(transfer)) return null;
  const result = {};
  for (const field of ['averageSpeed', 'bytesTransferred', 'directory', 'endedAt', 'enqueuedAt', 'exception', 'filename',
    'id', 'placeInQueue', 'requestedAt', 'size', 'startedAt', 'state', 'username']) result[field] = transfer[field] ?? null;
  for (const field of ['direction', 'batchId', 'removed']) {
    if (Object.hasOwn(transfer, field)) result[field] = transfer[field];
  }
  return result;
}
