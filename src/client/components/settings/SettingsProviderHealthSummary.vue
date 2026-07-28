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
import { computed } from 'vue';
import {
  buildSoulseekConnectionHealthSummary,
  formatDependencyProviderLabel,
  formatDependencyStatusLabel,
  getDependencyStatusClass,
  getSupportingProviderHealth,
} from '../../lib/settings-connections-presentation.js';
import SettingsDisclosure from './SettingsDisclosure.vue';

const props = defineProps({
  dependencies: {
    default: () => [],
    type: Array,
  },
  isDisabled: {
    default: false,
    type: Boolean,
  },
  isTesting: {
    default: false,
    type: Boolean,
  },
  loadError: {
    default: '',
    type: String,
  },
});

const emit = defineEmits(['test']);

const connectionHealth = computed(() => buildSoulseekConnectionHealthSummary(
  props.dependencies,
  props.loadError,
));
const supportingHealth = computed(() => getSupportingProviderHealth(props.dependencies));
</script>

<template>
  <section class="settings-provider-health" aria-labelledby="settings-soulseek-status-heading">
    <div class="settings-provider-health__header">
      <div>
        <h4 id="settings-soulseek-status-heading" class="settings-provider-health__title">Saved connection status</h4>
        <p class="settings-provider-health__subtitle">Checks the connection currently saved in Harmoniarr.</p>
      </div>
      <span class="review-status-pill" :class="connectionHealth.statusClass">
        {{ connectionHealth.statusLabel }}
      </span>
    </div>

    <p v-if="loadError" class="cfg-save-msg is-error" role="alert">{{ loadError }}</p>
    <p v-else class="settings-provider-health__message">{{ connectionHealth.message }}</p>
    <p v-if="connectionHealth.observedAt" class="settings-provider-health__observed">
      Last checked {{ new Date(connectionHealth.observedAt).toLocaleString() }}
    </p>

    <div class="settings-provider-health__actions">
      <button
        type="button"
        class="hx-btn"
        :disabled="isTesting || isDisabled"
        @click="emit('test')"
      >
        {{ isDisabled ? 'Soulseek is off' : isTesting ? 'Testing saved connection…' : 'Test saved connection' }}
      </button>
      <span v-if="!isDisabled" class="settings-provider-health__hint">Save changes before testing a new address or API key.</span>
    </div>

    <SettingsDisclosure
      v-if="supportingHealth.length"
      panel-id="settings-supporting-service-status"
      title="Other service status"
      :subtitle="`${supportingHealth.length} supporting service${supportingHealth.length === 1 ? '' : 's'} available for review.`"
      show-label="Show other service status"
      hide-label="Hide other service status"
      variant="inline"
    >
      <div class="settings-provider-health__supporting-list">
        <div v-for="dependency in supportingHealth" :key="dependency.provider" class="settings-provider-health__supporting-row">
          <span class="settings-provider-health__provider">{{ formatDependencyProviderLabel(dependency.provider) }}</span>
          <span class="review-status-pill" :class="getDependencyStatusClass(dependency.status)">
            {{ formatDependencyStatusLabel(dependency.status) }}
          </span>
          <span v-if="dependency.message" class="hx-text-muted">{{ dependency.message }}</span>
        </div>
      </div>
    </SettingsDisclosure>
  </section>
</template>

<style scoped>
.settings-provider-health {
  border-top: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-4);
  padding-top: var(--hx-space-4);
}

.settings-provider-health__header,
.settings-provider-health__actions,
.settings-provider-health__supporting-row {
  align-items: center;
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
}

.settings-provider-health__title,
.settings-provider-health__subtitle,
.settings-provider-health__message,
.settings-provider-health__observed,
.settings-provider-health__hint {
  margin: 0;
}

.settings-provider-health__title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.settings-provider-health__subtitle,
.settings-provider-health__observed,
.settings-provider-health__hint {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.settings-provider-health__message {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.settings-provider-health__actions {
  justify-content: flex-start;
}

.settings-provider-health__supporting-list {
  display: grid;
  gap: var(--hx-space-3);
}

.settings-provider-health__supporting-row {
  align-items: flex-start;
  border-bottom: 1px solid var(--hx-border-subtle);
  display: grid;
  grid-template-columns: minmax(120px, auto) auto minmax(0, 1fr);
  padding-bottom: var(--hx-space-3);
}

.settings-provider-health__supporting-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.settings-provider-health__provider {
  font-weight: 600;
}

@media (max-width: 640px) {
  .settings-provider-health__header,
  .settings-provider-health__actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-provider-health__supporting-row {
    grid-template-columns: 1fr;
  }
}
</style>
