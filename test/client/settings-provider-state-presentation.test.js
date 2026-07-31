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
import { buildSettingsSoulseekProviderState } from '../../src/client/lib/settings-provider-state-presentation.js';

test('Settings provider state makes disabled mode authoritative and quiet', () => {
  assert.deepEqual(buildSettingsSoulseekProviderState({
    connectionStatus: { provider: 'slskd', status: 'healthy' },
    providerMode: 'disabled',
  }), {
    actionLabel: 'Choose a download mode',
    canTest: false,
    message: 'Harmoniarr will not contact Soulseek or start downloads until you choose Managed or External and save the change.',
    mode: 'disabled',
    state: 'downloads_off',
    statusLabel: 'Downloads off',
    tone: 'info',
  });
});

test('Settings provider state gives missing managed deployment one direct recovery action', () => {
  const state = buildSettingsSoulseekProviderState({
    providerMode: 'managed',
    providerModeState: 'managed_deployment_missing',
  });

  assert.equal(state.state, 'managed_setup_required');
  assert.equal(state.actionLabel, 'Finish managed setup');
  assert.equal(state.canTest, false);
  assert.equal(state.tone, 'warning');
});

test('Settings provider state maps saved healthy connection to a safe test action', () => {
  const state = buildSettingsSoulseekProviderState({
    connectionStatus: {
      message: 'https://private-slskd.example accepted secret-value',
      provider: 'slskd',
      status: 'healthy',
    },
    providerMode: 'external',
  });

  assert.equal(state.state, 'connection_healthy');
  assert.equal(state.actionLabel, 'Test saved connection');
  assert.equal(state.canTest, true);
  assert.doesNotMatch(JSON.stringify(state), /private-slskd|secret-value|https?:/i);
});

test('Settings provider state turns credential failures into a bounded recovery message', () => {
  const state = buildSettingsSoulseekProviderState({
    connectionErrorCode: 'slskd_unauthorized',
    providerMode: 'external',
  });

  assert.equal(state.state, 'connection_setup_required');
  assert.equal(state.actionLabel, 'Review connection details');
  assert.equal(state.canTest, false);
  assert.equal(state.tone, 'warning');
});

test('Settings provider state does not expose a transport error in the unavailable outcome', () => {
  const state = buildSettingsSoulseekProviderState({
    connectionErrorCode: 'connection_check_failed',
    providerMode: 'external',
  });

  assert.equal(state.state, 'connection_unavailable');
  assert.equal(state.actionLabel, 'Try connection again');
  assert.equal(state.canTest, true);
  assert.equal(state.tone, 'danger');
});
