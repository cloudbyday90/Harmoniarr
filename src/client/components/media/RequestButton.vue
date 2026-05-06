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
 * RequestButton — presentational release request action button.
 *
 * Renders four visual states:
 *   - idle:       "Request"
 *   - loading:    "Requesting…"
 *   - requested:  "Requested"
 *   - unavailable: "Unavailable"
 *
 * Does not call any APIs. Emits `request` when clicked in the idle state.
 * Loading and requested states are disabled to prevent duplicate submissions.
 */
defineProps({
  /** Whether this release has already been successfully requested. */
  requested: {
    type: Boolean,
    default: false,
  },
  /** Whether a request operation is currently in progress. */
  loading: {
    type: Boolean,
    default: false,
  },
  /** Whether the button should be disabled (e.g. parent is busy). */
  disabled: {
    type: Boolean,
    default: false,
  },
  /**
   * Whether the release cannot be requested (e.g. missing artist or title).
   * When true, shows "Unavailable" instead of "Request".
   */
  unavailable: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['request']);

function handleClick() {
  emit('request');
}
</script>

<template>
  <button
    type="button"
    class="hx-btn"
    :data-variant="requested ? 'ghost' : 'primary'"
    :disabled="disabled || loading || requested || unavailable"
    :aria-busy="loading || undefined"
    @click="handleClick"
  >
    <template v-if="loading">Requesting…</template>
    <template v-else-if="requested">Requested</template>
    <template v-else-if="unavailable">Unavailable</template>
    <template v-else>Request</template>
  </button>
</template>
