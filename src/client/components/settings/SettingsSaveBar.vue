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
  saveState: {
    required: true,
    type: Object,
  },
});

const emit = defineEmits(['verify']);

const statusRole = computed(() => (
  props.saveState?.state === 'save_failed' ? 'alert' : 'status'
));
</script>

<template>
  <div class="settings-save-bar" :data-save-state="saveState.state">
    <div v-if="saveState.statusLabel" class="settings-save-bar__outcome">
      <span class="hx-pill" :data-tone="saveState.tone">{{ saveState.statusLabel }}</span>
      <p :role="statusRole" aria-atomic="true">{{ saveState.message }}</p>
    </div>
    <div class="settings-save-bar__actions">
      <button
        type="submit"
        class="hx-btn"
        data-variant="primary"
        :disabled="!saveState.canSubmit"
      >
        {{ saveState.actionLabel }}
      </button>
      <button
        v-if="saveState.verificationActionLabel"
        type="button"
        class="hx-btn"
        data-variant="ghost"
        @click="emit('verify')"
      >
        {{ saveState.verificationActionLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-save-bar {
  align-items: center;
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-lg);
  bottom: 0;
  box-shadow: 0 -2px 8px rgba(15, 28, 36, 0.06);
  display: flex;
  gap: var(--hx-space-3);
  justify-content: space-between;
  margin-top: var(--hx-space-4);
  padding: var(--hx-space-3) var(--hx-space-4);
  position: sticky;
  z-index: 3;
}

.settings-save-bar__outcome,
.settings-save-bar__actions {
  align-items: center;
  display: flex;
  gap: var(--hx-space-2);
}

.settings-save-bar__outcome {
  min-width: 0;
}

.settings-save-bar__outcome p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: 0;
  overflow-wrap: anywhere;
}

.settings-save-bar[data-save-state="save_failed"] .settings-save-bar__outcome p {
  color: var(--hx-danger);
}

@media (max-width: 640px) {
  .settings-save-bar,
  .settings-save-bar__outcome,
  .settings-save-bar__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .settings-save-bar__actions .hx-btn {
    width: 100%;
  }
}
</style>
