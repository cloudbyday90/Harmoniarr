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
  visibility: {
    default: null,
    type: Object,
  },
});

const headingId = computed(() => `music-queue-provider-recovery-visibility-${props.visibility?.outcome ?? 'status'}`);
const statusMessage = computed(() => (
  props.visibility ? `${props.visibility.title}. ${props.visibility.copy}` : ''
));
</script>

<template>
  <p class="music-queue-provider-recovery-visibility__status" role="status" aria-atomic="true">
    {{ statusMessage }}
  </p>

  <section
    v-if="visibility"
    class="music-queue-provider-recovery-visibility"
    :aria-labelledby="headingId"
    :data-tone="visibility.tone"
  >
    <div>
      <h2 :id="headingId">{{ visibility.title }}</h2>
      <p>{{ visibility.copy }}</p>
    </div>
  </section>
</template>

<style scoped>
.music-queue-provider-recovery-visibility {
  background: var(--hx-bg-surface-muted);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  padding: var(--hx-space-3) var(--hx-space-4);
}

.music-queue-provider-recovery-visibility[data-tone='success'] {
  background: var(--hx-success-soft);
  border-color: var(--hx-success);
}

.music-queue-provider-recovery-visibility[data-tone='warning'] {
  background: var(--hx-warning-soft);
  border-color: var(--hx-warning);
}

.music-queue-provider-recovery-visibility h2,
.music-queue-provider-recovery-visibility p {
  margin: 0;
}

.music-queue-provider-recovery-visibility h2 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
}

.music-queue-provider-recovery-visibility p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin-top: var(--hx-space-1);
}

.music-queue-provider-recovery-visibility__status {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
</style>
