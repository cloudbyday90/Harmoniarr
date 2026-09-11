<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed } from 'vue';

const props = defineProps({
  collection: { type: Object, default: null },
  canStartCollection: { type: Boolean, default: false },
  preparation: { type: Object, required: true },
  pagination: { type: Object, required: true },
  pageNumber: { type: Number, default: 1 },
  canGoPrevious: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  targetName: { type: String, required: true },
});
defineEmits(['start', 'restart', 'recover', 'finalize', 'next', 'previous']);
const statusLabel = computed(() => ({
  pending: 'Preparation pending', preparing: 'Preparing collection', running: 'Preparing collection',
  ready: 'Ready for decisions', blocked: 'Preparation blocked', failed: 'Preparation failed',
  reviewed: 'Reviewed collection selection', finalized: 'Reviewed collection selection',
  cancelled: 'Preparation cancelled',
})[props.collection?.status] ?? 'Collection preparation');
</script>

<template>
  <section v-if="collection || canStartCollection" class="hx-collection-review" aria-labelledby="external-collection-heading">
    <h3 id="external-collection-heading" class="hx-card-title">Collection selection</h3>
    <p class="hx-text-muted">Review the captured collection for {{ targetName }}. Provider contents can change after preparation. Every item needs an inclusion or a reason for exclusion.</p>
    <template v-if="collection">
      <div role="status" aria-atomic="true" class="hx-collection-review-summary">
        <span class="hx-pill">{{ statusLabel }}</span>
        <span>{{ collection.pagesCompleted }} pages prepared · {{ collection.itemsSeen }} source entries seen</span>
        <span>{{ collection.leafCount }} items · {{ collection.includedCount }} included · {{ collection.excludedCount }} excluded · {{ collection.pendingCount }} pending</span>
      </div>
      <p v-if="collection.blockedReason" class="hx-collection-review-error" role="alert">{{ collection.blockedReason }}</p>
      <p v-if="collection.targetMatches === false" class="hx-collection-review-error">This collection belongs to a previous target. Create a separate request for the current target; accepted work keeps its original target.</p>
      <p v-if="collection.reviewedAt" class="hx-text-muted">This reviewed collection selection is final. Fulfillment requires successful import of every included release.</p>
      <template v-else>
        <p v-if="collection.status === 'ready' && !collection.canFinalize" class="hx-text-muted">Decide every captured item and include at least one release before finalizing.</p>
        <button v-if="collection.status === 'ready'" type="button" class="hx-btn" data-variant="primary" :disabled="busy || !collection.canFinalize || collection.targetMatches === false" @click="$emit('finalize')">Finalize collection selection</button>
        <div v-if="collection.canRestart" class="hx-collection-review-restart">
          <p class="hx-text-muted">Restart captures the provider collection again. Previously accepted searches keep their original target.</p>
          <button type="button" class="hx-btn" :disabled="busy" @click="$emit('restart')">Restart collection preparation</button>
        </div>
      </template>
    </template>
    <div v-else>
      <p class="hx-text-muted">This older request has no complete collection record. Start preparation to capture and review its items.</p>
      <button type="button" class="hx-btn" :disabled="busy" @click="$emit('start')">Start collection preparation</button>
    </div>
    <div v-if="collection && preparation.canRecover" class="hx-collection-review-recovery">
      <p class="hx-text-muted">Pending or failed provider items need preparation. Continue explicitly in batches of up to 10 work items, then refresh to check progress.</p>
      <button type="button" class="hx-btn" :disabled="busy" @click="$emit('recover')">Prepare next collection batch</button>
    </div>
    <nav v-if="collection" aria-label="Collection review pages" class="hx-collection-review-pagination">
      <button type="button" class="hx-btn" :disabled="busy || !canGoPrevious" @click="$emit('previous')">Previous review page</button>
      <span class="hx-text-muted">Page {{ pageNumber }}</span>
      <button type="button" class="hx-btn" :disabled="busy || !pagination.hasMore" @click="$emit('next')">Next review page</button>
    </nav>
  </section>
</template>

<style scoped>
.hx-collection-review,
.hx-collection-review-summary,
.hx-collection-review-restart,
.hx-collection-review-recovery { display: grid; gap: var(--hx-space-3); min-width: 0; }
.hx-collection-review { border-bottom: 1px solid var(--hx-border); padding-bottom: var(--hx-space-4); }
.hx-collection-review .hx-btn,
.hx-collection-review .hx-pill { justify-self: start; }
.hx-collection-review-error { color: var(--hx-danger); overflow-wrap: anywhere; }
.hx-collection-review-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: var(--hx-space-2); }
.hx-collection-review p { margin: 0; }
@media (max-width: 640px) { .hx-collection-review .hx-btn { min-height: 44px; } }
</style>
