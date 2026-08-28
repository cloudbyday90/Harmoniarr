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

import { buildMissingMusicProviderRepairNotice } from './missing-music-provider-repair-presentation.js';
import { MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT } from './missing-music-provider-recovery-visibility-presentation.js';
import {
  SETTINGS_RECOVERY_CONTEXT,
  buildSettingsRecoveryReturnAction,
  createSettingsRecoveryContext,
  getSettingsRecoveryDestination,
} from './settings-recovery-handoff.js';

function buildConfirmation({ action = null, copy, outcome, title, tone }) {
  return {
    action,
    copy,
    outcome,
    title,
    tone,
  };
}

function buildUnresolvedConfirmation(repairNotice) {
  switch (repairNotice.code) {
    case 'downloads_off':
      return buildConfirmation({
        copy: 'Downloads remain off until you choose Managed or External and save the change.',
        outcome: 'downloads_off',
        title: 'Downloads are still off',
        tone: 'warning',
      });
    case 'managed_setup_required':
      return buildConfirmation({
        copy: 'Complete the managed deployment, then test the connection again before automatic music handling can continue.',
        outcome: 'managed_setup_required',
        title: 'Managed setup is still required',
        tone: 'warning',
      });
    case 'external_setup_required':
      return buildConfirmation({
        copy: 'Add a reachable Soulseek service and API key, then save before automatic music handling can continue.',
        outcome: 'external_setup_required',
        title: 'Soulseek still needs setup',
        tone: 'warning',
      });
    default:
      return buildConfirmation({
        copy: 'Review the connection details, then test Soulseek again before automatic music handling can continue.',
        outcome: 'provider_attention_required',
        title: 'Soulseek still needs attention',
        tone: 'warning',
      });
  }
}

function buildReadyAction(recoveryContext) {
  const normalizedRecoveryContext = createSettingsRecoveryContext(recoveryContext ?? {});
  const shouldShowMissingMusicProviderRecovery = [
    SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC,
    SETTINGS_RECOVERY_CONTEXT.MISSING_MUSIC_DECISION,
  ].includes(normalizedRecoveryContext?.context);

  return buildSettingsRecoveryReturnAction({
    query: shouldShowMissingMusicProviderRecovery
      ? { recovery: MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT }
      : null,
    recoveryContext: normalizedRecoveryContext,
  });
}

/**
 * Summarize the result of a post-save or post-test provider check without
 * exposing provider endpoints, secret metadata, or raw health errors.
 *
 * @param {{ connectionCheckFailed?: boolean, connectionStatus?: object|null, dependencies?: object[], healthLoadFailed?: boolean, recoveryContext?: object|null, setupProgress?: object|null }=} options
 * @returns {{ action: object|null, copy: string, outcome: string, title: string, tone: string }|null}
 */
export function buildSettingsProviderRecoveryConfirmation({
  connectionCheckFailed = false,
  connectionStatus = null,
  dependencies,
  healthLoadFailed = false,
  recoveryContext = null,
  setupProgress,
} = {}) {
  const destination = getSettingsRecoveryDestination(recoveryContext);
  if (!destination) return null;

  const repairNotice = buildMissingMusicProviderRepairNotice({
    dependencies: connectionStatus ? [connectionStatus] : dependencies,
    setupProgress,
  });
  if (repairNotice && [
    'downloads_off',
    'managed_setup_required',
  ].includes(repairNotice.code)) {
    return buildUnresolvedConfirmation(repairNotice);
  }

  if (connectionCheckFailed || healthLoadFailed) {
    return buildConfirmation({
      copy: 'Settings were saved, but Harmoniarr could not verify Soulseek yet. It will retry when the connection is available.',
      outcome: 'not_verified',
      title: 'Connection not verified yet',
      tone: 'warning',
    });
  }

  if (repairNotice) {
    return buildUnresolvedConfirmation(repairNotice);
  }

  return buildConfirmation({
    action: buildReadyAction(recoveryContext),
    copy: destination.providerReadyCopy,
    outcome: 'ready',
    title: 'Soulseek is ready',
    tone: 'success',
  });
}
