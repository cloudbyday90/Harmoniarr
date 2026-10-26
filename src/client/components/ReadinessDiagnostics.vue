<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { buildReadinessDiagnostics } from '../lib/readiness-diagnostics-presentation.js';
import { formatDiagnosticTimestamp } from '../lib/maintenance-lock-presentation.js';
const props = defineProps({ snapshot: { type: Object, default: null } });
const presentation = computed(() => buildReadinessDiagnostics(props.snapshot));
</script>

<template>
  <section class="readiness-diagnostics" aria-label="Readiness checks">
    <h4>Readiness checks</h4>
    <p class="hx-text-muted">History from this web process only; it resets on restart. A failed stage shows where a check stopped, not its root cause.</p>
    <template v-if="presentation">
      <dl class="readiness-diagnostics__values">
        <div><dt>Latest completed check</dt><dd>{{ presentation.outcome }}</dd></div>
        <div><dt>Failures in this process</dt><dd>{{ presentation.failureCount ?? 'Unavailable' }}</dd></div>
        <div><dt>Log records written</dt><dd>{{ presentation.loggedCount ?? 'Unavailable' }}</dd></div>
        <div><dt>Log records suppressed</dt><dd>{{ presentation.suppressedCount ?? 'Unavailable' }}</dd></div>
      </dl>
      <p v-if="presentation.observedAt" class="hx-text-muted">Last completion: <time :datetime="presentation.observedAt">{{ formatDiagnosticTimestamp(presentation.observedAt) }}</time></p>
      <p v-if="presentation.outputUnavailable" class="hx-text-muted">Diagnostic log output is unavailable. Failure history remains available in this process.</p>
      <p v-else-if="presentation.backpressured" class="hx-text-muted">Log output is waiting to drain. Failure history remains available in this process.</p>
      <ol v-if="presentation.failures.length" class="readiness-diagnostics__history">
        <li v-for="(failure, index) in presentation.failures.slice(0, 5)" :key="failure.reference ?? index">
          <strong>{{ failure.stage }}</strong>
          <p>{{ failure.category }} · HTTP {{ failure.httpStatus }} · Code {{ failure.code }}</p>
          <p v-if="failure.reference" class="hx-text-muted">Reference: {{ failure.reference }}</p>
          <time v-if="failure.observedAt" :datetime="failure.observedAt">{{ formatDiagnosticTimestamp(failure.observedAt) }}</time>
        </li>
      </ol>
      <p v-else class="hx-text-muted">No retained readiness failures in this process.</p>
      <p v-if="presentation.failures.length" class="hx-text-muted">Showing up to five of the last sixteen failures. Refresh diagnostics for the latest snapshot.</p>
    </template>
    <p v-else class="hx-text-muted">Readiness diagnostics are unavailable.</p>
  </section>
</template>

<style scoped>
.readiness-diagnostics { border-top: 1px solid var(--hx-border-subtle); display: grid; gap: var(--hx-space-2); min-width: 0; padding-top: var(--hx-space-3); }
.readiness-diagnostics h4, .readiness-diagnostics p { margin: 0; }
.readiness-diagnostics h4 { color: var(--hx-text-strong); font-size: var(--hx-text-sm); }
.readiness-diagnostics__values { display: grid; gap: var(--hx-space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); margin: 0; }
.readiness-diagnostics__values dt { color: var(--hx-text-muted); font-size: var(--hx-text-xs); }
.readiness-diagnostics__values dd { margin: var(--hx-space-1) 0 0; }
.readiness-diagnostics__history { display: grid; gap: var(--hx-space-3); margin: 0; padding-left: var(--hx-space-5); }
.readiness-diagnostics__history li { min-width: 0; overflow-wrap: anywhere; }
</style>
