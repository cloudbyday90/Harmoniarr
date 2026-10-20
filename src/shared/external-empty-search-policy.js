/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

export const EXTERNAL_EMPTY_SEARCH_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const EXTERNAL_EMPTY_SEARCH_RECOVERY_LIMIT = 2;

export function getExternalEmptySearchPolicy({ lastEmptySearchAt, emptySearchRecoveryCount = 0, now }) {
  if (lastEmptySearchAt == null) return null;
  const observedAt = new Date(lastEmptySearchAt).getTime();
  const currentTime = new Date(now).getTime();
  if (!Number.isFinite(observedAt) || !Number.isFinite(currentTime)
    || !Number.isInteger(emptySearchRecoveryCount) || emptySearchRecoveryCount < 0) {
    throw new TypeError('Invalid external empty-search policy state');
  }
  const remainingSearches = Math.max(0, EXTERNAL_EMPTY_SEARCH_RECOVERY_LIMIT - emptySearchRecoveryCount);
  const nextSearchAfter = new Date(observedAt + EXTERNAL_EMPTY_SEARCH_COOLDOWN_MS).toISOString();
  const blockedReason = remainingSearches === 0 ? 'exhausted' : currentTime < Date.parse(nextSearchAfter) ? 'cooldown' : null;
  return { remainingSearches, nextSearchAfter, blockedReason };
}
