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

import {
  SETTINGS_RECOVERY_CONTEXT,
  buildSettingsRecoveryReturnAction,
} from './settings-recovery-handoff.js';

function isMusicQueueReleaseRecovery(recoveryContext) {
  return recoveryContext?.context === SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE
    && typeof recoveryContext.wantedReleaseId === 'string'
    && recoveryContext.wantedReleaseId.length > 0;
}

/**
 * Turns a bounded server recheck outcome into Settings feedback. No candidate,
 * filesystem, provider, or media-tool detail is included in this normal path.
 */
export function buildSettingsMusicQueueSafeAddRecheckConfirmation({
  recoveryContext = null,
  recheck = null,
} = {}) {
  if (!isMusicQueueReleaseRecovery(recoveryContext)) return null;

  const outcome = recheck?.action?.outcome;
  const action = buildSettingsRecoveryReturnAction({ recoveryContext });
  switch (outcome) {
    case 'queued':
      return {
        action,
        copy: 'Harmoniarr rechecked this completed download and queued only this release for a safe library add.',
        outcome,
        title: 'Library add resumed',
        tone: 'success',
      };
    case 'deferred':
      return {
        action,
        copy: 'The recheck passed, but another library add is active. Return to Music Queue after that work finishes to see whether this release needs another try.',
        outcome,
        title: 'Library add is waiting',
        tone: 'warning',
      };
    case 'still_needs_review':
      return {
        action,
        copy: 'Harmoniarr rechecked this completed download but it still needs review before it can be added safely.',
        outcome,
        title: 'Library add still needs review',
        tone: 'warning',
      };
    default:
      return null;
  }
}
