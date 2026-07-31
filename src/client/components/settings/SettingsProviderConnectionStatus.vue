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

const props = defineProps({
  isTesting: {
    default: false,
    type: Boolean,
  },
  providerState: {
    required: true,
    type: Object,
  },
  showTestAction: {
    default: true,
    type: Boolean,
  },
});

const emit = defineEmits(['test']);

const pillTone = computed(() => props.providerState?.tone ?? 'info');
</script>

<template>
  <section
    class="settings-provider-connection-status"
    :data-provider-state="providerState.state"
    aria-labelledby="settings-soulseek-status-heading"
  >
    <div class="settings-provider-connection-status__header">
      <div>
        <h4 id="settings-soulseek-status-heading" class="settings-provider-connection-status__title">Soulseek status</h4>
        <p class="settings-provider-connection-status__subtitle">The saved download service connection used by Harmoniarr.</p>
      </div>
      <span class="hx-pill" :data-tone="pillTone">{{ providerState.statusLabel }}</span>
    </div>

    <p class="settings-provider-connection-status__message" role="status" aria-atomic="true">
      {{ providerState.message }}
    </p>

    <div v-if="providerState.canTest && showTestAction" class="settings-provider-connection-status__actions">
      <button type="button" class="hx-btn" :disabled="isTesting" @click="emit('test')">
        {{ isTesting ? 'Testing saved connection…' : providerState.actionLabel }}
      </button>
      <span class="settings-provider-connection-status__hint">Save changes before testing a new address or API key.</span>
    </div>
    <p v-else-if="providerState.canTest" class="settings-provider-connection-status__next-action">
      <strong>Next:</strong> Test the saved connection with the save control below.
    </p>
    <p v-else class="settings-provider-connection-status__next-action">
      <strong>Next:</strong> {{ providerState.actionLabel }}
    </p>
  </section>
</template>

<style scoped>
.settings-provider-connection-status {
  border-top: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-4);
  padding-top: var(--hx-space-4);
}

.settings-provider-connection-status__header,
.settings-provider-connection-status__actions {
  align-items: center;
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
}

.settings-provider-connection-status__title,
.settings-provider-connection-status__subtitle,
.settings-provider-connection-status__message,
.settings-provider-connection-status__hint,
.settings-provider-connection-status__next-action {
  margin: 0;
}

.settings-provider-connection-status__title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.settings-provider-connection-status__subtitle,
.settings-provider-connection-status__hint,
.settings-provider-connection-status__next-action {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.settings-provider-connection-status__message {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.settings-provider-connection-status__actions {
  justify-content: flex-start;
}

@media (max-width: 640px) {
  .settings-provider-connection-status__header,
  .settings-provider-connection-status__actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
