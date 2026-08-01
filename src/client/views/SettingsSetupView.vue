<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed, onMounted } from 'vue';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import SettingsSetupNextAction from '../components/settings/SettingsSetupNextAction.vue';
import SettingsSetupTaskList from '../components/settings/SettingsSetupTaskList.vue';
import { useSettingsSetupProgress } from '../composables/useSettingsSetupProgress.js';
import { useSoulseekConnectionStatus } from '../composables/useSoulseekConnectionStatus.js';
import { buildSettingsSetupOverview } from '../lib/settings-setup-presentation.js';

const {
  connectionErrorCode,
  connectionStatus,
  isLoading: isLoadingConnection,
  loadConnectionStatus,
} = useSoulseekConnectionStatus();

const {
  isLoading: isLoadingSetupProgress,
  loadError: setupProgressError,
  loadSetupProgress,
  progress: setupProgress,
} = useSettingsSetupProgress();

const isCheckingSetup = computed(() => isLoadingConnection.value || isLoadingSetupProgress.value);

const setupOverview = computed(() => buildSettingsSetupOverview({
  connectionErrorCode: connectionErrorCode.value,
  connectionStatus: connectionStatus.value,
  setupProgress: setupProgress.value,
  setupProgressError: setupProgressError.value,
}));

const setupStatusMessage = computed(() => {
  if (isCheckingSetup.value) return 'Checking setup progress.';

  return `Setup readiness: ${setupOverview.value.readiness.label}. ${setupOverview.value.readiness.copy}`;
});

onMounted(() => {
  void refreshSetup();
});

async function refreshSetup() {
  await Promise.all([
    loadConnectionStatus(),
    loadSetupProgress(),
  ]);
}
</script>

<template>
  <section class="settings-setup" aria-labelledby="settings-setup-title">
    <header class="settings-setup__header">
      <div>
        <h2 id="settings-setup-title">Setup readiness</h2>
      </div>
      <div class="settings-setup__header-actions">
        <span v-if="isCheckingSetup" class="hx-pill" data-tone="info">Checking setup</span>
        <span v-else class="hx-pill" :data-tone="setupOverview.readiness.tone">{{ setupOverview.readiness.label }}</span>
        <button type="button" class="hx-btn" data-variant="ghost" :disabled="isCheckingSetup" @click="refreshSetup">
          {{ isCheckingSetup ? 'Checking status' : 'Check status' }}
        </button>
      </div>
    </header>
    <p class="settings-setup__status" role="status" aria-atomic="true">{{ setupStatusMessage }}</p>

    <SettingsSetupNextAction v-if="setupOverview.nextStep" :step="setupOverview.nextStep" />
    <p v-else class="settings-setup__complete">Required setup is complete. Harmoniarr is ready to handle music automatically.</p>

    <section class="settings-setup__required" aria-labelledby="settings-setup-required-title">
      <h3 id="settings-setup-required-title">Required setup</h3>
      <SettingsSetupTaskList :steps="setupOverview.coreSteps" label="Required setup tasks" />
    </section>

    <SettingsDisclosure
      action-style="compact"
      category="optional"
      heading-level="3"
      hide-label="Hide optional setup"
      panel-id="settings-setup-optional"
      show-label="Review optional setup"
      subtitle="Tailor search timing and automatic-download behavior when you are ready."
      title="Library preferences"
      variant="inline"
    >
      <SettingsSetupTaskList
        heading-level="4"
        id-prefix="settings-setup-optional-task"
        label="Optional library preferences"
        :steps="setupOverview.optionalSteps"
      />
    </SettingsDisclosure>
  </section>
</template>

<style scoped>
.settings-setup {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-lg);
  padding: var(--hx-space-5);
}

.settings-setup__header {
  align-items: flex-start;
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
}

.settings-setup__header-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  justify-content: flex-end;
}

.settings-setup__header h2,
.settings-setup__required h3 {
  color: var(--hx-text-strong);
  margin: 0;
}

.settings-setup__header h2 {
  font-size: var(--hx-text-lg);
}

.settings-setup__status {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

.settings-setup__complete {
  color: var(--hx-success);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-4) 0 0;
}

.settings-setup__required {
  margin-top: var(--hx-space-4);
}

.settings-setup__required h3 {
  font-size: var(--hx-text-sm);
  margin: 0;
}

@media (max-width: 640px) {
  .settings-setup__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-setup__header-actions {
    justify-content: flex-start;
  }
}
</style>
