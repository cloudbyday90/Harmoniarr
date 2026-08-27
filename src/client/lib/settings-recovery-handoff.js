/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const SETTINGS_RECOVERY_CONTEXT = Object.freeze({
  ACTIVITY_LIBRARY_ADDS: 'activity_library_adds',
  ACTIVITY_LIBRARY_ADD_RELEASE: 'activity_library_add_release',
  ACTIVITY_TIMELINE: 'activity_timeline',
  DASHBOARD: 'dashboard',
  DOWNLOADER: 'downloader',
  MISSING_MUSIC: 'missing_music',
  MISSING_MUSIC_DECISION: 'missing_music_decision',
  MUSIC_QUEUE: 'music_queue',
  MUSIC_QUEUE_RELEASE: 'music_queue_release',
});

export const SETTINGS_RECOVERY_QUERY_KEY = 'returnTo';
export const SETTINGS_RECOVERY_RELEASE_QUERY_KEY = 'returnReleaseId';

const LEGACY_REPAIR_QUERY_KEY = 'repair';
const SAFE_RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

const RECOVERY_DESTINATIONS = Object.freeze({
  [SETTINGS_RECOVERY_CONTEXT.ACTIVITY_LIBRARY_ADDS]: Object.freeze({
    folderReadyCopy: 'Return to Activity to review the current library-add status.',
    label: 'Return to Activity',
    providerReadyCopy: 'Return to Activity to review the current music activity.',
    routeName: 'activity-diagnostics-library-adds',
  }),
  [SETTINGS_RECOVERY_CONTEXT.ACTIVITY_LIBRARY_ADD_RELEASE]: Object.freeze({
    folderReadyCopy: "Return to Activity to review this release's library-add status.",
    label: 'Return to Activity',
    providerReadyCopy: "Return to Activity to review this release's music activity.",
    routeName: 'activity-diagnostics-library-adds',
    requiresReleaseId: true,
  }),
  [SETTINGS_RECOVERY_CONTEXT.ACTIVITY_TIMELINE]: Object.freeze({
    folderReadyCopy: 'Return to Activity to review the current music status.',
    label: 'Return to Activity',
    providerReadyCopy: 'Return to Activity to review the current music activity.',
    routeName: 'activity-feed',
  }),
  [SETTINGS_RECOVERY_CONTEXT.DASHBOARD]: Object.freeze({
    folderReadyCopy: 'Return to Home to see the current music status.',
    label: 'Return to Home',
    providerReadyCopy: 'Return to Home to see the current music status.',
    routeName: 'dashboard',
  }),
  [SETTINGS_RECOVERY_CONTEXT.DOWNLOADER]: Object.freeze({
    folderReadyCopy: 'Return to Downloader to see current download progress.',
    label: 'Return to Downloader',
    providerReadyCopy: 'Return to Downloader to see current download progress.',
    routeName: 'downloader',
  }),
  [SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC]: Object.freeze({
    folderReadyCopy: 'Return to Missing Music to see the next release action.',
    label: 'Return to Missing Music',
    providerReadyCopy: 'Missing Music can continue its normal checks. Harmoniarr has not started a download yet.',
    routeName: 'missing',
  }),
  [SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION]: Object.freeze({
    folderReadyCopy: "Return to Missing Music to see this release's next action.",
    label: 'Return to Missing Music',
    providerReadyCopy: 'Missing Music can continue its normal checks. Harmoniarr has not started a download yet.',
    requiresReleaseId: true,
    routeName: 'missing-decision',
  }),
  [SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE]: Object.freeze({
    folderReadyCopy: 'Return to Missing Music to see the next automatic step.',
    label: 'Return to Missing Music',
    providerReadyCopy: 'Missing Music can continue its normal checks. Harmoniarr has not started a download yet.',
    routeName: 'missing',
  }),
  [SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE]: Object.freeze({
    folderReadyCopy: "Return to Missing Music to see this release's next automatic step.",
    label: 'Return to Missing Music',
    providerReadyCopy: 'Missing Music can continue its normal checks. Harmoniarr has not started a download yet.',
    routeName: 'missing-decision',
    requiresReleaseId: true,
  }),
});

function readSingleQueryValue(value) {
  return typeof value === 'string' ? value : null;
}

function normalizeReleaseId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return SAFE_RELEASE_ID_PATTERN.test(normalized) ? normalized : null;
}

/**
 * Creates the bounded internal context used to return a person to their work
 * after they repair a Settings prerequisite. This deliberately cannot hold a
 * URL, path, or arbitrary route name.
 *
 * @param {{ context?: string, wantedReleaseId?: string|null }=} input
 * @returns {{ context: string, wantedReleaseId?: string }|null}
 */
export function createSettingsRecoveryContext({
  context,
  wantedReleaseId = null,
} = {}) {
  const destination = RECOVERY_DESTINATIONS[context];
  if (!destination) return null;

  if (!destination.requiresReleaseId) {
    return { context };
  }

  const normalizedReleaseId = normalizeReleaseId(wantedReleaseId);
  if (!normalizedReleaseId) return null;

  return {
    context,
    wantedReleaseId: normalizedReleaseId,
  };
}

/**
 * Reads a Settings return context from the route query. `repair` remains
 * supported for existing Music Queue deep links, but new links use `returnTo`.
 *
 * @param {Record<string, unknown>|null|undefined} query
 * @returns {{ context: string, wantedReleaseId?: string }|null}
 */
export function resolveSettingsRecoveryContext(query) {
  const requestedContext = readSingleQueryValue(query?.[SETTINGS_RECOVERY_QUERY_KEY])
    ?? readSingleQueryValue(query?.[LEGACY_REPAIR_QUERY_KEY]);

  return createSettingsRecoveryContext({
    context: requestedContext,
    wantedReleaseId: readSingleQueryValue(query?.[SETTINGS_RECOVERY_RELEASE_QUERY_KEY]),
  });
}

/**
 * Returns presentation metadata for a validated recovery context.
 *
 * @param {{ context?: string, wantedReleaseId?: string|null }|null} recoveryContext
 * @returns {{ folderReadyCopy: string, label: string, providerReadyCopy: string, routeName: string }|null}
 */
export function getSettingsRecoveryDestination(recoveryContext) {
  const normalizedContext = createSettingsRecoveryContext(recoveryContext ?? {});
  if (!normalizedContext) return null;

  const destination = RECOVERY_DESTINATIONS[normalizedContext.context];
  return {
    folderReadyCopy: destination.folderReadyCopy,
    label: destination.label,
    providerReadyCopy: destination.providerReadyCopy,
    routeName: destination.routeName,
  };
}

/**
 * Builds the named Settings route used by a blocked workflow. The serialized
 * context contains only a fixed internal destination and, where needed, a
 * bounded release identifier.
 *
 * @param {{ recoveryContext?: { context?: string, wantedReleaseId?: string|null }|null, routeName?: string }} input
 * @returns {{ name: string, query?: Record<string, string> }}
 */
export function buildSettingsRecoveryHandoffLocation({
  recoveryContext = null,
  routeName,
} = {}) {
  const normalizedContext = createSettingsRecoveryContext(recoveryContext ?? {});
  if (!normalizedContext) return { name: routeName };

  const query = {
    [SETTINGS_RECOVERY_QUERY_KEY]: normalizedContext.context,
  };
  if (normalizedContext.wantedReleaseId) {
    query[SETTINGS_RECOVERY_RELEASE_QUERY_KEY] = normalizedContext.wantedReleaseId;
  }

  return { name: routeName, query };
}

/**
 * Builds a safe return action after Settings confirms the required prerequisite
 * is ready. Optional query values are code-owned status markers only.
 *
 * @param {{ recoveryContext?: { context?: string, wantedReleaseId?: string|null }|null, query?: Record<string, string>|null }} input
 * @returns {{ label: string, params?: Record<string, string>, query?: Record<string, string>, routeName: string }|null}
 */
export function buildSettingsRecoveryReturnAction({
  query = null,
  recoveryContext = null,
} = {}) {
  const normalizedContext = createSettingsRecoveryContext(recoveryContext ?? {});
  const destination = getSettingsRecoveryDestination(normalizedContext);
  if (!normalizedContext || !destination) return null;

  const action = {
    label: destination.label,
    routeName: destination.routeName,
  };

  if (normalizedContext.wantedReleaseId) {
    if (normalizedContext.context === SETTINGS_RECOVERY_CONTEXT.ACTIVITY_LIBRARY_ADD_RELEASE) {
      action.query = { wantedReleaseId: normalizedContext.wantedReleaseId };
    } else if ([
      SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION,
      SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
    ].includes(normalizedContext.context)) {
      action.params = { decisionId: normalizedContext.wantedReleaseId };
    } else {
      action.params = { wantedReleaseId: normalizedContext.wantedReleaseId };
    }
  }

  if (query && typeof query === 'object') {
    action.query = {
      ...(action.query ?? {}),
      ...query,
    };
  }

  return action;
}

/**
 * Builds the bounded post-save result for a folder-repair handoff. A return
 * action is available only after the server validates all required folders.
 *
 * @param {{ recoveryContext?: { context?: string, wantedReleaseId?: string|null }|null, validation?: object|null }} input
 * @returns {{ action: object|null, copy: string, outcome: string, title: string, tone: string }|null}
 */
export function buildSettingsFolderRecoveryConfirmation({
  recoveryContext = null,
  validation = null,
} = {}) {
  const destination = getSettingsRecoveryDestination(recoveryContext);
  if (!destination) return null;

  if (validation?.summary?.status === 'healthy') {
    return {
      action: buildSettingsRecoveryReturnAction({ recoveryContext }),
      copy: destination.folderReadyCopy,
      outcome: 'ready',
      title: 'Folders are ready',
      tone: 'success',
    };
  }

  return {
    action: null,
    copy: 'Folder changes were saved, but Harmoniarr still cannot use every required folder. Review Folder readiness before returning to your music.',
    outcome: 'needs_attention',
    title: 'Folders still need attention',
    tone: 'warning',
  };
}
