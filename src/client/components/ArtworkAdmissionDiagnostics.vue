<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { projectArtworkAdmissionObservation } from '../../shared/artwork-admission-diagnostics.js';
import { formatDiagnosticMiB } from '../lib/artwork-admission-presentation.js';
import { formatDiagnosticTimestamp } from '../lib/maintenance-lock-presentation.js';

const props = defineProps({ runtime: { type: Object, default: null } });
const admission = computed(() => projectArtworkAdmissionObservation(props.runtime?.artworkAdmission));
const memory = computed(() => props.runtime?.processMemory ?? null);
</script>

<template>
  <section class="artwork-admission-diagnostics" aria-labelledby="artwork-admission-title">
    <h4 id="artwork-admission-title">Artwork processing</h4>
    <p class="hx-text-muted">Reserved capacity controls admission. It is not measured memory use.</p>
    <template v-if="admission">
      <p class="hx-text-muted">Admission snapshot: <time :datetime="admission.capturedAt">{{ formatDiagnosticTimestamp(admission.capturedAt) }}</time></p>
      <dl class="artwork-admission-diagnostics__values">
        <div><dt>Active jobs</dt><dd>{{ admission.active }} / {{ admission.concurrencyLimit }}</dd></div>
        <div><dt>Queued jobs</dt><dd>{{ admission.queued }} / {{ admission.queueLimit }}</dd></div>
        <div><dt>Reserved capacity</dt><dd>{{ formatDiagnosticMiB(admission.reservedBytes) }}</dd></div>
        <div><dt>Admission budget</dt><dd>{{ formatDiagnosticMiB(admission.budgetBytes) }}</dd></div>
        <div><dt>Queued input</dt><dd>{{ formatDiagnosticMiB(admission.queuedInputBytes) }}</dd></div>
        <div><dt>Queued input limit</dt><dd>{{ formatDiagnosticMiB(admission.queuedInputLimitBytes) }}</dd></div>
        <div><dt>Queue wait limit</dt><dd>{{ admission.queueTimeoutMs / 1000 }} seconds</dd></div>
      </dl>
    </template>
    <p v-else class="hx-text-muted">Artwork admission counters are unavailable.</p>

    <h5>Web process memory</h5>
    <p class="hx-text-muted">This sample excludes artwork workers, FFmpeg and PostgreSQL. ArrayBuffers are included in external memory; do not add these figures.</p>
    <template v-if="memory">
      <p class="hx-text-muted">Process sample: <time :datetime="memory.capturedAt">{{ formatDiagnosticTimestamp(memory.capturedAt) }}</time></p>
      <dl class="artwork-admission-diagnostics__values">
        <div><dt>Process RSS</dt><dd>{{ formatDiagnosticMiB(memory.rssBytes) }}</dd></div>
        <div><dt>V8 heap used</dt><dd>{{ formatDiagnosticMiB(memory.heapUsedBytes) }}</dd></div>
        <div><dt>External memory</dt><dd>{{ formatDiagnosticMiB(memory.externalBytes) }}</dd></div>
        <div><dt>ArrayBuffers</dt><dd>{{ formatDiagnosticMiB(memory.arrayBuffersBytes) }}</dd></div>
      </dl>
    </template>
    <p v-else class="hx-text-muted">Process memory has no available sample.</p>
  </section>
</template>

<style scoped>
.artwork-admission-diagnostics { border-top: 1px solid var(--hx-border-subtle); display: grid; gap: var(--hx-space-2); min-width: 0; padding-top: var(--hx-space-3); }
.artwork-admission-diagnostics h4, .artwork-admission-diagnostics h5, .artwork-admission-diagnostics p { margin: 0; }
.artwork-admission-diagnostics h4, .artwork-admission-diagnostics h5 { color: var(--hx-text-strong); font-size: var(--hx-text-sm); }
.artwork-admission-diagnostics__values { display: grid; gap: var(--hx-space-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); margin: 0; }
.artwork-admission-diagnostics__values dt { color: var(--hx-text-muted); font-size: var(--hx-text-xs); }
.artwork-admission-diagnostics__values dd { color: var(--hx-text-strong); font-size: var(--hx-text-sm); margin: var(--hx-space-1) 0 0; overflow-wrap: anywhere; }
</style>
