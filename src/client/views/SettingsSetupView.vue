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
import { RouterLink } from 'vue-router';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
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
  void loadConnectionStatus();
  void loadSetupProgress();
});
</script>

<template>
  <section class="settings-setup" aria-labelledby="settings-setup-title">
    <header class="settings-setup__header">
      <div>
        <h2 id="settings-setup-title">Setup readiness</h2>
        <p>Complete these two prerequisites once. Harmoniarr handles normal music progress after that.</p>
      </div>
      <span v-if="isCheckingSetup" class="hx-pill" data-tone="info">Checking setup</span>
      <span v-else class="hx-pill" :data-tone="setupOverview.readiness.tone">{{ setupOverview.readiness.label }}</span>
    </header>
    <p class="settings-setup__status" role="status" aria-atomic="true">{{ setupStatusMessage }}</p>
    <p class="settings-setup__readiness">{{ setupOverview.readiness.copy }}</p>

    <ol class="settings-setup__steps" aria-label="Required setup tasks">
      <li v-for="step in setupOverview.coreSteps" :key="step.id" class="settings-setup__step">
        <div class="settings-setup__content">
          <div class="settings-setup__heading">
            <h3>{{ step.title }}</h3>
            <span class="hx-pill" :data-tone="step.tone">{{ step.status }}</span>
          </div>
          <p>{{ step.copy }}</p>
          <RouterLink class="hx-btn" :to="{ name: step.routeName }">
            {{ step.label }}
          </RouterLink>
        </div>
      </li>
    </ol>

    <SettingsDisclosure
      heading-level="3"
      hide-label="Hide optional setup"
      panel-id="settings-setup-optional"
      show-label="Review optional setup"
      subtitle="Tailor search timing and safe automatic downloads when you are ready."
      title="Optional setup"
      variant="inline"
    >
      <ul class="settings-setup__optional-list">
        <li v-for="step in setupOverview.optionalSteps" :key="step.id" class="settings-setup__optional-step">
          <div>
            <div class="settings-setup__heading">
              <h4>{{ step.title }}</h4>
              <span class="hx-pill" :data-tone="step.tone">{{ step.status }}</span>
            </div>
            <p>{{ step.copy }}</p>
          </div>
          <RouterLink class="hx-btn" :to="{ name: step.routeName }">
            {{ step.label }}
          </RouterLink>
        </li>
      </ul>
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

.settings-setup__header h2,
.settings-setup__heading h3,
.settings-setup__heading h4 {
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

.settings-setup__header p,
.settings-setup__content p,
.settings-setup__optional-step p,
.settings-setup__readiness {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.settings-setup__steps {
  display: grid;
  gap: var(--hx-space-3);
  list-style: none;
  margin: var(--hx-space-4) 0 0;
  padding: 0;
}

.settings-setup__step {
  align-items: center;
  border-top: 1px solid var(--hx-border-subtle);
  display: block;
  padding-top: var(--hx-space-3);
}

.settings-setup__content {
  display: grid;
  gap: var(--hx-space-2);
}

.settings-setup__heading {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  justify-content: space-between;
}

.settings-setup__content p {
  margin: 0;
}

.settings-setup__content .hx-btn {
  justify-self: start;
}

.settings-setup__optional-list {
  display: grid;
  gap: var(--hx-space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}

.settings-setup__optional-step {
  align-items: flex-start;
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
}

.settings-setup__optional-step p {
  margin: var(--hx-space-1) 0 0;
}

.settings-setup__optional-step .hx-btn {
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .settings-setup__header,
  .settings-setup__optional-step {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
