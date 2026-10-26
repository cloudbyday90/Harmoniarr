/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** A failed observation is unknown state, never a synthetic pending migration. */
export function buildOnboardingMigrationStep(result) {
  const value = result?.status === 'fulfilled' ? result.value : null;
  const known = value && Number.isSafeInteger(value.applied) && value.applied >= 0 && Array.isArray(value.pending);
  const pending = known ? value.pending.length : null;
  return {
    id: 'database', title: 'Check database migrations',
    status: pending === null ? 'unavailable' : pending === 0 ? 'complete' : 'attention',
    message: pending === null ? 'Database migration status is unavailable. Refresh to try again.'
      : pending === 0 ? 'Database migrations are current.'
        : `${pending} migration${pending === 1 ? '' : 's'} still ${pending === 1 ? 'needs' : 'need'} attention.`,
  };
}
