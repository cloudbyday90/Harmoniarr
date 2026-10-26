/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

/** Batch totals are observations, not an exactly-once ledger of file outcomes. */
export function hasIncompleteBackupRecoveryProgress(summary) {
  return summary?.progressMayBeIncomplete === true
    || (typeof summary?.recoveryDetectedAt === 'string' && Number.isFinite(Date.parse(summary.recoveryDetectedAt)));
}
