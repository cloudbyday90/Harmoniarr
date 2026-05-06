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
import { getRequestStatusLabel, getRequestStatusVariant } from '../../lib/request-status.js';

/**
 * RequestStatusPill — presentational request status badge.
 *
 * Maps a backend request_state value to a requester-friendly label and visual
 * variant. Does not call APIs, poll, or mutate requests.
 *
 * Accessible: the label text is always visible; variant is a visual
 * reinforcement only and never the sole indicator of meaning.
 */
const props = defineProps({
  /** Raw backend request_state value. */
  status: {
    type: String,
    default: null,
  },
});

const label = computed(() => getRequestStatusLabel(props.status));
const variant = computed(() => getRequestStatusVariant(props.status));
</script>

<template>
  <span
    class="hx-status-pill"
    :data-variant="variant"
    :title="label"
    :aria-label="`Request status: ${label}`"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.hx-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.2em 0.6em;
  border-radius: var(--hx-radius-full, 9999px);
  font-size: var(--hx-text-xs, 0.75rem);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  background: var(--hx-bg-surface-raised, #2a2a2a);
  color: var(--hx-text-muted, #888);
  border: 1px solid var(--hx-border, #333);
}

/* info — searching / downloading */
.hx-status-pill[data-variant='info'] {
  background: color-mix(in srgb, var(--hx-color-info, #3b82f6) 15%, transparent);
  color: var(--hx-color-info, #3b82f6);
  border-color: color-mix(in srgb, var(--hx-color-info, #3b82f6) 30%, transparent);
}

/* success — fulfilled / in library */
.hx-status-pill[data-variant='success'] {
  background: color-mix(in srgb, var(--hx-color-success, #22c55e) 15%, transparent);
  color: var(--hx-color-success, #22c55e);
  border-color: color-mix(in srgb, var(--hx-color-success, #22c55e) 30%, transparent);
}

/* warning — under review */
.hx-status-pill[data-variant='warning'] {
  background: color-mix(in srgb, var(--hx-color-warning, #f59e0b) 15%, transparent);
  color: var(--hx-color-warning, #f59e0b);
  border-color: color-mix(in srgb, var(--hx-color-warning, #f59e0b) 30%, transparent);
}

/* danger — failed */
.hx-status-pill[data-variant='danger'] {
  background: color-mix(in srgb, var(--hx-color-danger, #ef4444) 15%, transparent);
  color: var(--hx-color-danger, #ef4444);
  border-color: color-mix(in srgb, var(--hx-color-danger, #ef4444) 30%, transparent);
}

/* neutral — pending / queued */
.hx-status-pill[data-variant='neutral'] {
  background: var(--hx-bg-surface-raised, #2a2a2a);
  color: var(--hx-text-secondary, #aaa);
  border-color: var(--hx-border, #333);
}

/* muted — cancelled / unknown */
.hx-status-pill[data-variant='muted'] {
  background: transparent;
  color: var(--hx-text-faint, #555);
  border-color: var(--hx-border-subtle, #2a2a2a);
}
</style>
