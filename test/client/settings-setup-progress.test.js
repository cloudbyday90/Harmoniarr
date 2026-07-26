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
import { useSettingsSetupProgress } from '../../src/client/composables/useSettingsSetupProgress.js';
import { buildSettingsSetupProgress } from '../../src/client/lib/settings-setup-progress.js';

test('settings setup progress retains only the managed deployment signal', () => {
  const progress = buildSettingsSetupProgress({
    secretStatus: {
      providers: {
        spotify: { clientSecretConfigured: true },
      },
      slskd: {
        apiKeyConfigured: true,
        baseUrl: 'http://must-not-reach-setup.example',
        providerModeState: 'managed_deployment_missing',
      },
    },
    settings: { slskd: { baseUrl: 'http://must-not-reach-setup.example' } },
  });

  assert.deepEqual(progress, {
    soulseek: { managedDeploymentMissing: true },
  });
  assert.doesNotMatch(JSON.stringify(progress), /base.?url|api.?key|secret|spotify/i);
});

test('useSettingsSetupProgress loads the reduced setup state', async (t) => {
  const fetchSettingsFn = t.mock.fn(async () => ({
    secretStatus: {
      slskd: { providerModeState: 'managed_deployment_missing' },
    },
  }));
  const { isLoading, loadError, loadSetupProgress, progress } = useSettingsSetupProgress({ fetchSettingsFn });

  await loadSetupProgress();

  assert.equal(fetchSettingsFn.mock.callCount(), 1);
  assert.equal(isLoading.value, false);
  assert.equal(loadError.value, '');
  assert.deepEqual(progress.value, {
    soulseek: { managedDeploymentMissing: true },
  });
});

test('useSettingsSetupProgress keeps the safe default when Settings cannot load', async () => {
  const { isLoading, loadError, loadSetupProgress, progress } = useSettingsSetupProgress({
    fetchSettingsFn: async () => { throw new Error('Settings request failed'); },
  });

  await loadSetupProgress();

  assert.equal(isLoading.value, false);
  assert.equal(loadError.value, 'Settings request failed');
  assert.deepEqual(progress.value, {
    soulseek: { managedDeploymentMissing: false },
  });
});
