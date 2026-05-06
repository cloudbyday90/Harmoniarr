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
/**
 * MonitorButton — presentational monitor action button.
 *
 * Renders three visual states: idle (Monitor), in-progress (Monitoring…),
 * and complete (Monitored). Does not call any APIs directly.
 *
 * Emits `monitor` when the button is clicked in the idle state.
 */
defineProps({
  /** Whether this artist is already monitored. */
  monitored: {
    type: Boolean,
    default: false,
  },
  /** Whether a monitor operation is in progress. */
  loading: {
    type: Boolean,
    default: false,
  },
  /** Whether the button should be disabled (e.g. parent is busy). */
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['monitor']);

function handleClick() {
  emit('monitor');
}
</script>

<template>
  <button
    type="button"
    class="hx-btn"
    :data-variant="monitored ? 'ghost' : 'primary'"
    :disabled="disabled || loading || monitored"
    :aria-busy="loading || undefined"
    @click="handleClick"
  >
    <template v-if="loading">Monitoring…</template>
    <template v-else-if="monitored">Monitored</template>
    <template v-else>Monitor</template>
  </button>
</template>
