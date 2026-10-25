<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { buildRecoveryDiagnosticEvents } from '../lib/recovery-diagnostic-events.js';
import { formatDiagnosticTimestamp } from '../lib/maintenance-lock-presentation.js';

const props = defineProps({ diagnostics: { type: Object, default: null } });
const events = computed(() => buildRecoveryDiagnosticEvents(props.diagnostics));
</script>

<template>
  <div class="recovery-diagnostic-events">
    <section aria-labelledby="recovery-failures-title">
      <h4 id="recovery-failures-title">Recent failures</h4>
      <ul v-if="events.failures.rows.length" role="list">
        <li v-for="row in events.failures.rows" :key="row.id">
          <strong>{{ row.title }}</strong>
          <p v-if="row.finishedAt">Finished <time :datetime="row.finishedAt">{{ formatDiagnosticTimestamp(row.finishedAt) }}</time></p>
          <p v-else>Finish time unavailable.</p>
          <p class="recovery-diagnostic-events__message">{{ row.message }}</p>
        </li>
      </ul>
      <p v-if="!events.failures.available">Some failure records are unavailable.</p>
      <p v-else-if="!events.failures.rows.length">No recent failures to display.</p>
    </section>
    <section aria-labelledby="recovery-actions-title">
      <h4 id="recovery-actions-title">Recent privileged actions</h4>
      <ul v-if="events.actions.rows.length" role="list">
        <li v-for="row in events.actions.rows" :key="row.id">
          <strong>{{ row.title }}</strong>
          <p v-if="row.occurredAt">Occurred <time :datetime="row.occurredAt">{{ formatDiagnosticTimestamp(row.occurredAt) }}</time></p>
          <p v-else>Event time unavailable.</p>
        </li>
      </ul>
      <p v-if="!events.actions.available">Some privileged action records are unavailable.</p>
      <p v-else-if="!events.actions.rows.length">No recent privileged actions to display.</p>
    </section>
  </div>
</template>

<style scoped>
.recovery-diagnostic-events { display: grid; gap: var(--hx-space-4); min-width: 0; }
.recovery-diagnostic-events section { border-top: 1px solid var(--hx-border-subtle); padding-top: var(--hx-space-3); }
.recovery-diagnostic-events h4 { color: var(--hx-text-strong); font-family: var(--hx-font-sans); font-size: var(--hx-text-sm); margin: 0 0 var(--hx-space-2); }
.recovery-diagnostic-events ul { display: grid; gap: var(--hx-space-3); list-style: none; margin: 0; padding: 0; }
.recovery-diagnostic-events li { border: 1px solid var(--hx-border-subtle); border-radius: var(--hx-radius-sm); min-width: 0; overflow-wrap: anywhere; padding: var(--hx-space-3); }
.recovery-diagnostic-events strong { color: var(--hx-text-strong); font-size: var(--hx-text-sm); }
.recovery-diagnostic-events p { color: var(--hx-text-muted); font-size: var(--hx-text-sm); margin: var(--hx-space-1) 0 0; }
.recovery-diagnostic-events__message { white-space: pre-wrap; }
</style>
