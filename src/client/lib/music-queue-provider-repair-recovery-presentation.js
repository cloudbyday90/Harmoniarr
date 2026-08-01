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

import { buildSettingsProviderRecoveryConfirmation } from './settings-provider-recovery-presentation.js';
import { SETTINGS_RECOVERY_CONTEXT } from './settings-recovery-handoff.js';

export const MUSIC_QUEUE_PROVIDER_REPAIR_RETURN_CONTEXT = SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE;

export function isMusicQueueProviderRepairReturnContext(value) {
  return value === MUSIC_QUEUE_PROVIDER_REPAIR_RETURN_CONTEXT;
}

/**
 * Summarize the result of a post-save provider check without exposing provider
 * endpoints, secret metadata, or raw health errors.
 */
export function buildMusicQueueProviderRepairRecoveryConfirmation({
  connectionCheckFailed = false,
  connectionStatus = null,
  dependencies,
  healthLoadFailed = false,
  setupProgress,
} = {}) {
  return buildSettingsProviderRecoveryConfirmation({
    connectionCheckFailed,
    connectionStatus,
    dependencies,
    healthLoadFailed,
    recoveryContext: { context: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE },
    setupProgress,
  });
}
