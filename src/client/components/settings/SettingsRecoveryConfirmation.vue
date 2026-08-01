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
import { RouterLink } from 'vue-router';

const props = defineProps({
  confirmation: {
    default: null,
    type: Object,
  },
});

const headingId = computed(() => `settings-recovery-confirmation-${props.confirmation?.outcome ?? 'status'}`);
const statusMessage = computed(() => (
  props.confirmation ? `${props.confirmation.title}. ${props.confirmation.copy}` : ''
));
const actionLocation = computed(() => {
  if (!props.confirmation?.action) return null;

  return {
    name: props.confirmation.action.routeName,
    params: props.confirmation.action.params,
    query: props.confirmation.action.query,
  };
});
</script>

<template>
  <p class="settings-recovery-confirmation__status" role="status" aria-atomic="true">
    {{ statusMessage }}
  </p>

  <section
    v-if="confirmation"
    class="settings-recovery-confirmation"
    :aria-labelledby="headingId"
    :data-tone="confirmation.tone"
  >
    <div>
      <h2 :id="headingId">{{ confirmation.title }}</h2>
      <p>{{ confirmation.copy }}</p>
    </div>
    <RouterLink
      v-if="actionLocation"
      class="hx-btn"
      data-variant="ghost"
      :to="actionLocation"
    >
      {{ confirmation.action.label }}
    </RouterLink>
  </section>
</template>

<style scoped>
.settings-recovery-confirmation {
  align-items: center;
  background: var(--hx-bg-surface-muted);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  display: flex;
  gap: var(--hx-space-4);
  justify-content: space-between;
  margin-top: var(--hx-space-4);
  padding: var(--hx-space-3) var(--hx-space-4);
}

.settings-recovery-confirmation[data-tone='success'] {
  background: var(--hx-success-soft);
  border-color: var(--hx-success);
}

.settings-recovery-confirmation[data-tone='warning'] {
  background: var(--hx-warning-soft);
  border-color: var(--hx-warning);
}

.settings-recovery-confirmation h2,
.settings-recovery-confirmation p {
  margin: 0;
}

.settings-recovery-confirmation h2 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.settings-recovery-confirmation p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin-top: var(--hx-space-1);
}

.settings-recovery-confirmation__status {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

@media (max-width: 640px) {
  .settings-recovery-confirmation {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
