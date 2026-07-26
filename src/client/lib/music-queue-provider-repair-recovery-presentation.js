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

import { buildMusicQueueProviderRepairNotice } from './music-queue-provider-repair-presentation.js';
import { MUSIC_QUEUE_PROVIDER_READY_RECOVERY_CONTEXT } from './music-queue-provider-recovery-visibility-presentation.js';

export const MUSIC_QUEUE_PROVIDER_REPAIR_RETURN_CONTEXT = 'music_queue';

export function isMusicQueueProviderRepairReturnContext(value) {
  return value === MUSIC_QUEUE_PROVIDER_REPAIR_RETURN_CONTEXT;
}

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
        copy: 'Music Queue remains paused until you choose Managed or External and save the change.',
        outcome: 'downloads_off',
        title: 'Downloads are still off',
        tone: 'warning',
      });
    case 'managed_setup_required':
      return buildConfirmation({
        copy: 'Complete the managed deployment, then test the connection again before Music Queue can continue.',
        outcome: 'managed_setup_required',
        title: 'Managed setup is still required',
        tone: 'warning',
      });
    case 'external_setup_required':
      return buildConfirmation({
        copy: 'Add a reachable Soulseek service and API key, then save before Music Queue can continue.',
        outcome: 'external_setup_required',
        title: 'Soulseek still needs setup',
        tone: 'warning',
      });
    default:
      return buildConfirmation({
        copy: 'Review the connection details, then test Soulseek again before Music Queue can continue.',
        outcome: 'provider_attention_required',
        title: 'Soulseek still needs attention',
        tone: 'warning',
      });
  }
}

/**
 * Summarize the result of a post-save provider check without exposing provider
 * endpoints, secret metadata, or raw health errors.
 */
export function buildMusicQueueProviderRepairRecoveryConfirmation({
  dependencies,
  healthLoadFailed = false,
  setupProgress,
} = {}) {
  const repairNotice = buildMusicQueueProviderRepairNotice({
    dependencies,
    setupProgress,
  });
  if (repairNotice && [
    'downloads_off',
    'managed_setup_required',
  ].includes(repairNotice.code)) {
    return buildUnresolvedConfirmation(repairNotice);
  }

  if (healthLoadFailed) {
    return buildConfirmation({
      copy: 'Settings were saved, but Harmoniarr could not verify Soulseek yet. Music Queue will retry when the connection is available.',
      outcome: 'not_verified',
      title: 'Connection not verified yet',
      tone: 'warning',
    });
  }

  if (repairNotice) {
    return buildUnresolvedConfirmation(repairNotice);
  }

  return buildConfirmation({
    action: {
      label: 'Return to Music Queue',
      query: { recovery: MUSIC_QUEUE_PROVIDER_READY_RECOVERY_CONTEXT },
      routeName: 'music-queue',
    },
    copy: 'Music Queue can continue its normal checks. Harmoniarr has not started a download yet.',
    outcome: 'ready',
    title: 'Soulseek is ready',
    tone: 'success',
  });
}
