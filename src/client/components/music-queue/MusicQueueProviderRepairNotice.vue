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
import { buildSettingsRecoveryHandoffLocation } from '../../lib/settings-recovery-handoff.js';

const props = defineProps({
  notice: {
    default: null,
    type: Object,
  },
  returnContext: {
    default: null,
    type: [Object, String],
  },
});

const headingId = computed(() => `music-queue-provider-repair-${props.notice?.code ?? 'status'}`);
const recoveryContext = computed(() => (
  typeof props.returnContext === 'string'
    ? { context: props.returnContext }
    : props.returnContext
));
const settingsLocation = computed(() => buildSettingsRecoveryHandoffLocation({
  recoveryContext: recoveryContext.value,
  routeName: props.notice?.actionRouteName,
}));
const statusMessage = computed(() => (
  props.notice ? `${props.notice.title}. ${props.notice.copy}` : ''
));
</script>

<template>
  <p class="music-queue-provider-repair__status" role="status" aria-atomic="true">
    {{ statusMessage }}
  </p>

  <section
    v-if="notice"
    class="music-queue-provider-repair"
    :aria-labelledby="headingId"
    :data-tone="notice.tone"
  >
    <div>
      <h2 :id="headingId">{{ notice.title }}</h2>
      <p>{{ notice.copy }}</p>
    </div>
    <RouterLink class="hx-btn" data-variant="ghost" :to="settingsLocation">
      {{ notice.label }}
    </RouterLink>
  </section>
</template>

<style scoped>
.music-queue-provider-repair {
  align-items: center;
  background: var(--hx-warning-soft);
  border: 1px solid var(--hx-warning);
  border-radius: var(--hx-radius-sm);
  display: flex;
  gap: var(--hx-space-4);
  justify-content: space-between;
  padding: var(--hx-space-3) var(--hx-space-4);
}

.music-queue-provider-repair h2,
.music-queue-provider-repair p {
  margin: 0;
}

.music-queue-provider-repair h2 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.music-queue-provider-repair p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin-top: var(--hx-space-1);
}

.music-queue-provider-repair__status {
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
  .music-queue-provider-repair {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
