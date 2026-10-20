<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { buildExternalRequestSearchDiagnostics } from '../lib/external-request-search-diagnostics-presentation.js';

const props = defineProps({ intent: { type: Object, required: true } });
const result = computed(() => buildExternalRequestSearchDiagnostics(props.intent.searchDiagnostics));
</script>

<template>
  <section v-if="result" class="hx-external-search-diagnostics" :aria-label="`Search result details for ${intent.artistName} — ${intent.releaseTitle}`">
    <h4>No usable candidates</h4>
    <p>{{ result.summary }}</p>
    <ul><li v-for="detail in result.details" :key="detail">{{ detail }}</li></ul>
    <p>Confirm the approved artist and edition above. If a different edition is needed, create a separate request.</p>
    <p>After an intentional source-policy correction, Retry in Background Jobs rechecks the saved search. It does not start a new provider search.</p>
    <nav aria-label="Search result review">
      <RouterLink v-for="link in result.links" :key="link.to.name" :to="link.to">{{ link.label }}</RouterLink>
      <RouterLink :to="{ name: 'activity-operations', query: { runId: intent.operationRunId } }">Review background job</RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.hx-external-search-diagnostics { display: grid; gap: var(--hx-space-2); margin-top: var(--hx-space-2); color: var(--hx-text-muted); }
.hx-external-search-diagnostics h4 { color: var(--hx-text-strong); }
.hx-external-search-diagnostics h4, .hx-external-search-diagnostics p, .hx-external-search-diagnostics ul { margin: 0; }
.hx-external-search-diagnostics ul { padding-left: var(--hx-space-5); }
.hx-external-search-diagnostics nav { display: flex; flex-wrap: wrap; gap: var(--hx-space-3); }
.hx-external-search-diagnostics a { display: inline-flex; align-items: center; min-height: 24px; border-radius: var(--hx-radius-xs); }
.hx-external-search-diagnostics a:focus-visible { outline: 2px solid var(--hx-accent-strong); outline-offset: 2px; }
@media (max-width: 640px) { .hx-external-search-diagnostics a { display: inline-flex; align-items: center; min-height: 44px; } }
</style>
