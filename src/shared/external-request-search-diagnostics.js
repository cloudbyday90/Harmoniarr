/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const countFields = ['responseCount', 'responseFileCount', 'ignoredUserResponseCount',
  'blacklistedFileCount', 'missingUsernameResponseCount', 'malformedFileCount'];

/** An idempotent allowlist for successful ingestion with responses but no candidates. */
export function projectExternalRequestSearchDiagnostics(value) {
  if (!value || value.provider !== 'slskd' || value.candidateCount !== 0
    || !Number.isSafeInteger(value.responseCount) || !Number.isSafeInteger(value.responseFileCount)) return null;
  const counts = {};
  for (const field of countFields) {
    const count = value[field] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) return null;
    counts[field] = count;
  }
  if (counts.responseCount === 0
    || counts.ignoredUserResponseCount > counts.responseCount
    || counts.missingUsernameResponseCount > counts.responseCount
    || counts.blacklistedFileCount > counts.responseFileCount
    || counts.malformedFileCount > counts.responseFileCount) return null;
  return { provider: 'slskd', candidateCount: 0, ...counts };
}
