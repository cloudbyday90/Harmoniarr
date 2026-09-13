/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/** Queue/storage policy, not the protocol's definition of TTL zero or its maximum. */
export function validateQueueTtlSeconds(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) {
    throw new RangeError('Queued notification TTL must be an integer between 1 and 2147483647 seconds');
  }
  return value;
}
