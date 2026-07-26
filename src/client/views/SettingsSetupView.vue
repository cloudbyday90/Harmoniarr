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
import { useDependencyHealth } from '../composables/useDependencyHealth.js';
import { buildSettingsSetupSteps } from '../lib/settings-setup-presentation.js';

const {
  dependencies,
  isLoading,
  loadDependencyHealth,
  loadError,
} = useDependencyHealth();

const setupSteps = computed(() => buildSettingsSetupSteps({
  dependencies: dependencies.value,
  healthError: loadError.value,
}));

onMounted(() => {
  void loadDependencyHealth();
});
</script>

<template>
  <section class="settings-setup" aria-labelledby="settings-setup-title">
    <header class="settings-setup__header">
      <div>
        <h2 id="settings-setup-title">Get Harmoniarr ready</h2>
        <p>Complete these steps once. After that, Harmoniarr handles normal music progress automatically.</p>
      </div>
      <span v-if="isLoading" class="hx-pill" data-tone="info">Checking services</span>
    </header>

    <ol class="settings-setup__steps">
      <li v-for="(step, index) in setupSteps" :key="step.id" class="settings-setup__step">
        <span class="settings-setup__number" aria-hidden="true">{{ index + 1 }}</span>
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
.settings-setup__heading h3 {
  color: var(--hx-text-strong);
  margin: 0;
}

.settings-setup__header h2 {
  font-size: var(--hx-text-lg);
}

.settings-setup__header p,
.settings-setup__content p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.settings-setup__steps {
  display: grid;
  gap: var(--hx-space-3);
  list-style: none;
  margin: var(--hx-space-5) 0 0;
  padding: 0;
}

.settings-setup__step {
  align-items: flex-start;
  border-top: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: 28px minmax(0, 1fr);
  padding-top: var(--hx-space-3);
}

.settings-setup__number {
  align-items: center;
  background: var(--hx-accent-soft);
  border-radius: var(--hx-radius-pill);
  color: var(--hx-accent-strong);
  display: inline-flex;
  font-size: var(--hx-text-sm);
  font-weight: 700;
  height: 28px;
  justify-content: center;
  width: 28px;
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
</style>
