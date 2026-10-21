/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { projectSlskdSearchDiagnostics } from '../../shared/slskd-search-diagnostics.js';
import { SETTINGS_RECOVERY_CONTEXT, buildSettingsRecoveryHandoffLocation } from './settings-recovery-handoff.js';

export function buildMissingMusicSearchCorrections(detail) {
  const data = projectSlskdSearchDiagnostics(detail?.searchDiagnostics);
  if (!data) return [];
  const ignored = data.ignoredUserResponseCount > 0;
  const malformed = data.malformedFileCount > 0 || data.missingUsernameResponseCount > 0;
  if (!ignored && !malformed) return [];
  const permissions = detail?.permissions;
  const active = detail?.decision?.requestedFor?.accountStatus === 'active' && permissions?.isReadOnly !== true;
  if (!active) return [{ key: 'history', text: 'This account history is read-only. Search corrections are unavailable here.', link: null }];

  const steps = [];
  if (ignored) steps.push({
    key: 'ignored',
    text: permissions?.canReviewIgnoredSources === true
      ? 'Review the intentional source exclusions. Changing the ignore list affects future searches for everyone.'
      : 'Ask a household administrator to review the ignored sources. Source exclusions apply to everyone.',
    link: permissions?.canReviewIgnoredSources === true
      ? { label: 'Review ignored sources', to: { name: 'activity-ignored' } } : null,
  });
  if (malformed) steps.push({
    key: 'provider',
    text: permissions?.canReviewProviderConnection === true
      ? 'Review the provider connection status. Malformed responses or missing source identities alone do not establish a connection failure.'
      : 'Ask a household administrator to review the provider response issues. Malformed responses or missing source identities alone do not establish a connection failure.',
    link: permissions?.canReviewProviderConnection === true
      ? { label: 'Review provider connection', to: buildSettingsRecoveryHandoffLocation({
        routeName: 'settings-connections',
        recoveryContext: { context: SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION,
          wantedReleaseId: detail.decision.decisionId },
      }) } : null,
  });
  return steps;
}
