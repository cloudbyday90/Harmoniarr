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
  buildMissingMusicProviderRepairNotice,
  hasMissingMusicProviderDependentWork,
} from '../../src/client/lib/missing-music-provider-repair-presentation.js';

function buildSetupProgress({
  managedDeploymentMissing = false,
  providerMode = 'external',
} = {}) {
  return {
    soulseek: { managedDeploymentMissing, providerMode },
  };
}

test('Missing Music provider repair recognizes only provider-dependent work', () => {
  assert.equal(hasMissingMusicProviderDependentWork([
    { statusCode: 'quality_choice_needed' },
    { statusCode: 'queued_for_search' },
  ]), true);
  assert.equal(hasMissingMusicProviderDependentWork([
    { statusCode: 'needs_setup' },
    { statusCode: 'quality_choice_needed' },
  ]), false);
});

test('Missing Music provider repair keeps setup states actionable and secret-safe', () => {
  const disabledNotice = buildMissingMusicProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress({ providerMode: 'disabled' }),
  });
  const managedNotice = buildMissingMusicProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress({
      managedDeploymentMissing: true,
      providerMode: 'managed',
    }),
  });
  const unavailableNotice = buildMissingMusicProviderRepairNotice({
    dependencies: [{
      message: 'http://private-host.example rejected key secret-value',
      provider: 'slskd',
      status: 'unavailable',
    }],
    setupProgress: buildSetupProgress(),
  });

  assert.deepEqual(disabledNotice, {
    actionRouteName: 'settings-connections',
    code: 'downloads_off',
    copy: 'Turn on a Soulseek provider before queued music can continue.',
    label: 'Choose provider mode',
    title: 'Downloads are off',
    tone: 'warning',
  });
  assert.equal(managedNotice.code, 'managed_setup_required');
  assert.equal(managedNotice.label, 'Finish managed setup');
  assert.equal(unavailableNotice.code, 'provider_attention_required');
  assert.equal(unavailableNotice.label, 'Check Soulseek connection');
  assert.doesNotMatch(JSON.stringify(unavailableNotice), /private-host|secret-value|http/i);
});

test('Missing Music provider repair distinguishes external setup and healthy states', () => {
  const setupNotice = buildMissingMusicProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'disabled' }],
    setupProgress: buildSetupProgress(),
  });

  assert.equal(setupNotice.code, 'external_setup_required');
  assert.equal(setupNotice.label, 'Set up Soulseek');
  assert.equal(buildMissingMusicProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress(),
  }), null);
});
