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

const headingId = computed(() => `music-queue-provider-recovery-${props.confirmation?.outcome ?? 'status'}`);
const statusMessage = computed(() => (
  props.confirmation ? `${props.confirmation.title}. ${props.confirmation.copy}` : ''
));
</script>

<template>
  <p class="music-queue-provider-recovery__status" role="status" aria-atomic="true">
    {{ statusMessage }}
  </p>

  <section
    v-if="confirmation"
    class="music-queue-provider-recovery"
    :aria-labelledby="headingId"
    :data-tone="confirmation.tone"
  >
    <div>
      <h2 :id="headingId">{{ confirmation.title }}</h2>
      <p>{{ confirmation.copy }}</p>
    </div>
    <RouterLink
      v-if="confirmation.action"
      class="hx-btn"
      data-variant="ghost"
      :to="{ name: confirmation.action.routeName }"
    >
      {{ confirmation.action.label }}
    </RouterLink>
  </section>
</template>

<style scoped>
.music-queue-provider-recovery {
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

.music-queue-provider-recovery[data-tone='success'] {
  background: var(--hx-success-soft);
  border-color: var(--hx-success);
}

.music-queue-provider-recovery[data-tone='warning'] {
  background: var(--hx-warning-soft);
  border-color: var(--hx-warning);
}

.music-queue-provider-recovery h2,
.music-queue-provider-recovery p {
  margin: 0;
}

.music-queue-provider-recovery h2 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.music-queue-provider-recovery p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin-top: var(--hx-space-1);
}

.music-queue-provider-recovery__status {
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
  .music-queue-provider-recovery {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
