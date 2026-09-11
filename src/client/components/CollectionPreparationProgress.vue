<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed } from 'vue';
import { buildCollectionPreparationProgressPresentation } from '../lib/collection-preparation-progress-presentation.js';

const props = defineProps({
  collection: { type: Object, required: true },
  progress: { type: Object, default: null },
});
const presentation = computed(() => buildCollectionPreparationProgressPresentation(props));
</script>

<template>
  <section v-if="presentation" class="hx-collection-preparation" aria-labelledby="collection-preparation-heading">
    <h4 id="collection-preparation-heading" class="hx-card-title">Metadata preparation</h4>
    <p role="status" aria-atomic="true">
      <span class="hx-pill" :data-tone="presentation.tone">{{ presentation.label }}</span>
      <span class="hx-collection-preparation-counts">{{ presentation.workSummary }}</span>
    </p>
    <p v-if="presentation.operationsSummary" class="hx-text-muted">{{ presentation.operationsSummary }}</p>
    <p>{{ presentation.pagesSummary }}</p>
    <p>{{ presentation.sourceSummary }}</p>
    <p v-if="presentation.otherWorkSummary" class="hx-text-muted">{{ presentation.otherWorkSummary }}</p>
    <p class="hx-text-muted">{{ presentation.detail }} Use Refresh review to update these counts.</p>
  </section>
</template>

<style scoped>
.hx-collection-preparation { display: grid; gap: var(--hx-space-2); min-width: 0; }
.hx-collection-preparation p { margin: 0; overflow-wrap: anywhere; }
.hx-collection-preparation-counts { display: block; margin-top: var(--hx-space-2); }
</style>
