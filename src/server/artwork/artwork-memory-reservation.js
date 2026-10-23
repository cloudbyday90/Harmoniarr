/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { ARTWORK_WORKER_DATA_LIMIT, artworkDecodedMemoryBytes } from './artwork-worker-memory.js';
import { ARTWORK_WORKER_OUTPUT_LIMIT } from './artwork-worker-protocol.js';

export const ARTWORK_ACTIVE_MEMORY_BUDGET = 2 * 1024 ** 3;

function assertInputBytes(inputBytes) {
  if (!Number.isSafeInteger(inputBytes) || inputBytes < 1 || inputBytes > 100 * 1024 ** 2) throw new TypeError('Invalid artwork reservation input size');
}
export function initialArtworkMemoryReservation(inputBytes) {
  assertInputBytes(inputBytes);
  // DATA ceiling plus mapped/runtime allowance, parent original and two output
  // copies (collector fragments and the returned contiguous buffer).
  return ARTWORK_WORKER_DATA_LIMIT + 64 * 1024 ** 2 + inputBytes + 2 * ARTWORK_WORKER_OUTPUT_LIMIT;
}
export function decodedArtworkMemoryReservation(metadata, inputBytes) {
  assertInputBytes(inputBytes);
  const pixels = artworkDecodedMemoryBytes(metadata);
  const child = 128 * 1024 ** 2 + 2 * inputBytes + ARTWORK_WORKER_OUTPUT_LIMIT + pixels;
  const estimate = inputBytes + 2 * ARTWORK_WORKER_OUTPUT_LIMIT + child;
  if (!Number.isSafeInteger(estimate) || estimate < 1) throw new TypeError('Invalid artwork metadata reservation');
  return Math.min(initialArtworkMemoryReservation(inputBytes), estimate);
}
