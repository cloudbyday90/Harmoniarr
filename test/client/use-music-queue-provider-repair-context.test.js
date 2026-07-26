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
import { nextTick, ref } from 'vue';
import { useMusicQueueProviderRepairContext } from '../../src/client/composables/useMusicQueueProviderRepairContext.js';

function createDependencyHealth() {
  return {
    dependencies: ref([{ provider: 'slskd', status: 'healthy' }]),
    isLoading: ref(false),
    loadDependencyHealth: async () => {},
  };
}

function createSetupProgress() {
  return {
    isLoading: ref(false),
    loadSetupProgress: async () => {},
    progress: ref({
      soulseek: {
        managedDeploymentMissing: true,
        providerMode: 'managed',
      },
    }),
  };
}

test('Music Queue provider repair context loads only after provider-dependent work appears', async (t) => {
  const enabled = ref(false);
  const dependencyHealth = createDependencyHealth();
  const setupProgress = createSetupProgress();
  const loadDependencyHealth = t.mock.method(dependencyHealth, 'loadDependencyHealth');
  const loadSetupProgress = t.mock.method(setupProgress, 'loadSetupProgress');
  const context = useMusicQueueProviderRepairContext({
    enabled,
    useDependencyHealthFn: () => dependencyHealth,
    useSettingsSetupProgressFn: () => setupProgress,
  });

  assert.equal(context.notice.value, null);
  assert.equal(loadDependencyHealth.mock.callCount(), 0);
  assert.equal(loadSetupProgress.mock.callCount(), 0);

  enabled.value = true;
  await nextTick();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  assert.equal(loadDependencyHealth.mock.callCount(), 1);
  assert.equal(loadSetupProgress.mock.callCount(), 1);
  assert.equal(context.notice.value?.title, 'Managed setup required');
});

test('Music Queue provider repair context refreshes both bounded read models together', async (t) => {
  const dependencyHealth = createDependencyHealth();
  const setupProgress = createSetupProgress();
  const loadDependencyHealth = t.mock.method(dependencyHealth, 'loadDependencyHealth');
  const loadSetupProgress = t.mock.method(setupProgress, 'loadSetupProgress');
  const context = useMusicQueueProviderRepairContext({
    enabled: false,
    useDependencyHealthFn: () => dependencyHealth,
    useSettingsSetupProgressFn: () => setupProgress,
  });

  await context.refreshProviderRepairContext();
  assert.equal(loadDependencyHealth.mock.callCount(), 0);
  assert.equal(loadSetupProgress.mock.callCount(), 0);
});
