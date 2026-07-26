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
  buildMusicQueueProviderRepairNotice,
  hasMusicQueueProviderDependentWork,
} from '../../src/client/lib/music-queue-provider-repair-presentation.js';

function buildSetupProgress({
  managedDeploymentMissing = false,
  providerMode = 'external',
} = {}) {
  return {
    soulseek: { managedDeploymentMissing, providerMode },
  };
}

test('Music Queue provider repair recognizes only provider-dependent work', () => {
  assert.equal(hasMusicQueueProviderDependentWork([
    { statusCode: 'quality_choice_needed' },
    { statusCode: 'queued_for_search' },
  ]), true);
  assert.equal(hasMusicQueueProviderDependentWork([
    { statusCode: 'needs_setup' },
    { statusCode: 'quality_choice_needed' },
  ]), false);
  assert.equal(hasMusicQueueProviderDependentWork([]), false);
});

test('Music Queue provider repair gives disabled mode priority', () => {
  const notice = buildMusicQueueProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress({ providerMode: 'disabled' }),
  });

  assert.deepEqual(notice, {
    actionRouteName: 'settings-connections',
    code: 'downloads_off',
    copy: 'Turn on a Soulseek provider before queued music can continue.',
    label: 'Choose provider mode',
    title: 'Downloads are off',
    tone: 'warning',
  });
});

test('Music Queue provider repair identifies missing managed deployment', () => {
  const notice = buildMusicQueueProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress({
      managedDeploymentMissing: true,
      providerMode: 'managed',
    }),
  });

  assert.equal(notice.code, 'managed_setup_required');
  assert.equal(notice.label, 'Finish managed setup');
  assert.equal(notice.title, 'Managed setup required');
});

test('Music Queue provider repair distinguishes provider setup from provider attention', () => {
  const setupNotice = buildMusicQueueProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'disabled' }],
    setupProgress: buildSetupProgress(),
  });
  const attentionNotice = buildMusicQueueProviderRepairNotice({
    dependencies: [{
      message: 'http://private-host.example rejected key secret-value',
      provider: 'slskd',
      status: 'unavailable',
    }],
    setupProgress: buildSetupProgress(),
  });

  assert.equal(setupNotice.code, 'external_setup_required');
  assert.equal(setupNotice.label, 'Set up Soulseek');
  assert.equal(attentionNotice.code, 'provider_attention_required');
  assert.equal(attentionNotice.label, 'Check Soulseek connection');
  assert.doesNotMatch(JSON.stringify(attentionNotice), /private-host|secret-value|http/i);
});

test('Music Queue provider repair stays quiet when Soulseek is healthy or unknown', () => {
  assert.equal(buildMusicQueueProviderRepairNotice({
    dependencies: [{ provider: 'slskd', status: 'healthy' }],
    setupProgress: buildSetupProgress(),
  }), null);
  assert.equal(buildMusicQueueProviderRepairNotice({
    dependencies: [],
    setupProgress: buildSetupProgress(),
  }), null);
});
