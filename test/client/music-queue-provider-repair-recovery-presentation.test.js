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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMusicQueueProviderRepairRecoveryConfirmation,
  isMusicQueueProviderRepairReturnContext,
  MUSIC_QUEUE_PROVIDER_REPAIR_RETURN_CONTEXT,
} from '../../src/client/lib/music-queue-provider-repair-recovery-presentation.js';
import { MUSIC_QUEUE_PROVIDER_READY_RECOVERY_CONTEXT } from '../../src/client/lib/music-queue-provider-recovery-visibility-presentation.js';

function buildSetupProgress({
  managedDeploymentMissing = false,
  providerMode = 'external',
} = {}) {
  return {
    soulseek: { managedDeploymentMissing, providerMode },
  };
}

test('Music Queue provider recovery accepts only its fixed return context', () => {
  assert.equal(isMusicQueueProviderRepairReturnContext(MUSIC_QUEUE_PROVIDER_REPAIR_RETURN_CONTEXT), true);
  assert.equal(isMusicQueueProviderRepairReturnContext('/app/music-queue'), false);
  assert.equal(isMusicQueueProviderRepairReturnContext('https://outside.example'), false);
  assert.equal(isMusicQueueProviderRepairReturnContext(''), false);
});

test('Music Queue provider recovery confirms readiness without claiming a download started', () => {
  const confirmation = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress(),
  });

  assert.deepEqual(confirmation, {
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
});

test('Music Queue provider recovery reports unresolved setup states safely', () => {
  const downloadsOff = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress({ providerMode: 'disabled' }),
  });
  const managedSetup = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress({
      managedDeploymentMissing: true,
      providerMode: 'managed',
    }),
  });
  const externalSetup = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: [{ provider: 'slskd', status: 'disabled' }],
    setupProgress: buildSetupProgress(),
  });

  assert.equal(downloadsOff.outcome, 'downloads_off');
  assert.equal(managedSetup.outcome, 'managed_setup_required');
  assert.equal(externalSetup.outcome, 'external_setup_required');
  assert.equal(downloadsOff.action, null);
  assert.equal(managedSetup.action, null);
  assert.equal(externalSetup.action, null);
});

test('Music Queue provider recovery does not expose failed health details', () => {
  const confirmation = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: [{
      message: 'http://private-host.example rejected secret-value',
      provider: 'slskd',
      status: 'healthy',
    }],
    healthLoadFailed: true,
    setupProgress: buildSetupProgress(),
  });

  assert.equal(confirmation.outcome, 'not_verified');
  assert.doesNotMatch(JSON.stringify(confirmation), /private-host|secret-value|http/i);
});

test('Music Queue provider recovery keeps explicit disabled mode authoritative after a failed check', () => {
  const confirmation = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    healthLoadFailed: true,
    setupProgress: buildSetupProgress({ providerMode: 'disabled' }),
  });

  assert.equal(confirmation.outcome, 'downloads_off');
});
