/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import {
  SETTINGS_RECOVERY_CONTEXT,
  SETTINGS_RECOVERY_QUERY_KEY,
  buildSettingsRecoveryHandoffLocation,
  resolveSettingsRecoveryContext,
} from './settings-recovery-handoff.js';

export function buildIgnoredSourceReviewLocation(decisionId) {
  return buildSettingsRecoveryHandoffLocation({
    routeName: 'activity-ignored',
    recoveryContext: { context: SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION, wantedReleaseId: decisionId },
  });
}

// Reuse the bounded context parser, but admit only this journey's exact context.
// This return location is not a grant of access to the referenced decision.
export function resolveIgnoredSourceReviewReturn({ actorRole, query } = {}) {
  if (actorRole !== 'admin' || query?.[SETTINGS_RECOVERY_QUERY_KEY] !== SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION) return null;
  const context = resolveSettingsRecoveryContext(query);
  return context ? { name: 'missing-decision', params: { decisionId: context.wantedReleaseId } } : null;
}
