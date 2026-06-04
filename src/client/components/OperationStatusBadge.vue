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
import { getOperationRunStatusLabel } from '../lib/operation-run-status.js';
import {
  formatOperationRunStatusTone,
  formatQueueRunStatusLabel,
  formatQueueRunStatusTone,
} from '../lib/operation-run-presentation.js';

/**
 * Single source of truth for rendering an operation/run status as a design-system
 * pill. Centralises the tone + label mapping that was previously hand-assembled at
 * every call site, guaranteeing consistent colour and wording across the queue
 * table, the job-detail panel, and the activity queue.
 *
 * Two status vocabularies are supported:
 *  - `run`   — lifecycle states (completed/running/pending/cancelled/failed)
 *  - `queue` — extended queue states (succeeded/in_progress/claimed/queued/...)
 */
const props = defineProps({
  status: {
    type: String,
    default: null,
  },
  variant: {
    type: String,
    default: 'run',
    validator: (value) => value === 'run' || value === 'queue',
  },
  unknownLabel: {
    type: String,
    default: 'Unknown',
  },
});

const tone = computed(() => (props.variant === 'queue'
  ? formatQueueRunStatusTone(props.status)
  : formatOperationRunStatusTone(props.status)));

const label = computed(() => (props.variant === 'queue'
  ? formatQueueRunStatusLabel(props.status)
  : getOperationRunStatusLabel(props.status, { defaultLabel: props.unknownLabel })));
</script>

<template>
  <span class="hx-pill" :data-tone="tone || undefined">{{ label }}</span>
</template>
