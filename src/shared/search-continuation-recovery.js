/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const recoveryMessages = new Map([
  ['slskd_search_continuation_expired', 'The saved search expired. Choose Search again to request a new search using the saved automation policy.'],
  ['slskd_search_continuation_unavailable', 'The saved search is no longer available. Choose Search again to request a new search using the saved automation policy.'],
]);

/** Only these known terminal continuation failures permit explicit recovery. */
export function getSearchContinuationRecoveryMessage(code) {
  return recoveryMessages.get(code) ?? null;
}
