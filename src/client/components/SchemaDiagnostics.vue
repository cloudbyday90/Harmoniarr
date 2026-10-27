<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { useId } from 'vue';
import { useSchemaDiagnostics } from '../composables/useSchemaDiagnostics.js';
import { formatDiagnosticTimestamp } from '../lib/maintenance-lock-presentation.js';
const id = useId();
const { state, report, message, refresh } = useSchemaDiagnostics();
const labels = { current: 'Current', not_current: 'Needs attention', unavailable: 'Unavailable', drift: 'Needs attention' };
const differences = [
  ['pendingCount', 'Pending migrations'], ['unknownAppliedCount', 'Unexpected applied records'],
  ['checksumDriftCount', 'Checksum changes'], ['migrationKeyDriftCount', 'Migration key changes'], ['nonAppliedCount', 'Failed or unfinished records'],
];
</script>

<template>
  <section class="hx-schema-diagnostics" :aria-labelledby="`${id}-title`">
    <h4 :id="`${id}-title`">Database schema</h4>
    <p :id="`${id}-help`" class="hx-text-muted">Compare migration records and critical schema checks. This does not repair the database.</p>
    <div><button type="button" class="hx-btn" :aria-controls="`${id}-results`" :aria-describedby="`${id}-help`" :aria-disabled="state === 'loading' ? 'true' : undefined" @click="refresh">Refresh schema checks</button></div>
    <p role="status" aria-live="polite" aria-atomic="true">{{ message }}</p>
    <div :id="`${id}-results`" :aria-busy="state === 'loading' ? 'true' : 'false'">
      <template v-if="report">
        <p v-if="report.checkedAt" class="hx-text-muted">Last completed check: <time :datetime="report.checkedAt">{{ formatDiagnosticTimestamp(report.checkedAt) }}</time></p>
        <dl class="hx-schema-diagnostics__values">
          <div><dt>Migration records</dt><dd>{{ labels[report.lineage.state] }}</dd></div>
          <div><dt>Critical schema checks</dt><dd>{{ labels[report.anchors.state] }}</dd></div>
          <div><dt>Checks completed</dt><dd>{{ report.anchors.checkedCount }}</dd></div>
          <div><dt>Missing</dt><dd>{{ report.anchors.missingCount }}</dd></div>
          <div><dt>Altered</dt><dd>{{ report.anchors.alteredCount }}</dd></div>
        </dl>
        <p v-if="report.lineage.incomplete" class="hx-text-muted">Migration records exceeded the observation limit. The record count is incomplete.</p>
        <dl v-else-if="report.lineage.state === 'not_current'" class="hx-schema-diagnostics__values">
          <div v-for="[key, label] in differences" :key="key"><dt>{{ label }}</dt><dd>{{ report.lineage[key] ?? 'Unavailable' }}</dd></div>
        </dl>
        <p v-if="state === 'attention'" class="hx-text-muted">Review database migration and schema diagnostics before considering a repair. These checks cover selected schema facts.</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.hx-schema-diagnostics { border-top: 1px solid var(--hx-border-subtle); display: grid; gap: var(--hx-space-3); min-width: 0; padding-top: var(--hx-space-3); }
.hx-schema-diagnostics h4, .hx-schema-diagnostics p { margin: 0; }
.hx-schema-diagnostics h4 { color: var(--hx-text-strong); font-size: var(--hx-text-sm); }
.hx-schema-diagnostics .hx-btn { min-height: 44px; }
.hx-schema-diagnostics .hx-btn[aria-disabled='true'] { cursor: progress; opacity: 0.6; }
.hx-schema-diagnostics__values { display: grid; gap: var(--hx-space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); margin: var(--hx-space-3) 0; }
.hx-schema-diagnostics__values dt { color: var(--hx-text-muted); font-size: var(--hx-text-xs); }
.hx-schema-diagnostics__values dd { color: var(--hx-text-strong); margin: var(--hx-space-1) 0 0; overflow-wrap: anywhere; }
</style>
