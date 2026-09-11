<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import { useExternalRequestReview } from '../composables/useExternalRequestReview.js';
import ExternalCollectionReviewControls from './ExternalCollectionReviewControls.vue';
import ExternalRequestReviewItem from './ExternalRequestReviewItem.vue';

const props = defineProps({ mediaRequest: { type: Object, required: true } });
const emit = defineEmits(['updated']);
const {
  items, intents, preparation, collection, canStartCollection, pagination, pageNumber, canGoPrevious,
  drafts, isLoading, isMutating,
  errorMessage, statusMessage, load, search, approve, recover, reset,
  nextPage, previousPage, exclude, startCollection, finalizeCollection,
} = useExternalRequestReview();
const targetName = computed(() => props.mediaRequest.requestedForUser?.username ?? 'the request target');
const visibleItems = computed(() => collection.value ? items.value : items.value.filter((item) => item.reviewable
  && !intents.value.some((intent) => intent.providerKey === item.providerKey)));

const canDecide = computed(() => collection.value?.status === 'ready'
  && !collection.value.reviewedAt && collection.value.targetMatches !== false);

watch([() => props.mediaRequest.id, () => props.mediaRequest.requestedForUser?.id], () => {
  reset();
  void refresh();
}, { immediate: true });
onBeforeUnmount(reset);

function refresh() {
  return load({ mediaRequestId: props.mediaRequest.id });
}

async function save(action, ...args) {
  if (await action(...args)) emit('updated');
}

function intentStatus(status) {
  return ({
    pending: 'Search queued', queued: 'Search queued', running: 'Searching',
    completed: 'Search completed', failed: 'Search failed', cancelled: 'Search cancelled',
  })[status] ?? 'Search accepted';
}

function belongsToPreviousTarget(intent) {
  return Boolean(intent.requestedForUserId
    && intent.requestedForUserId !== props.mediaRequest.requestedForUser?.id);
}
</script>

<template>
  <article class="hx-card hx-external-review" aria-labelledby="external-review-heading">
    <header class="hx-card-header">
      <div>
        <h2 id="external-review-heading" class="hx-card-title">Review external music</h2>
        <p class="hx-card-subtitle">Choose the matching local catalog edition to search for {{ targetName }}. Import candidates require review before download or import.</p>
      </div>
      <button type="button" class="hx-btn" :disabled="isLoading || isMutating" @click="refresh">Refresh review</button>
    </header>
    <div class="hx-card-body hx-external-review-body">
      <div role="status" aria-atomic="true" class="hx-text-muted">{{ statusMessage }}</div>
      <div role="alert" aria-atomic="true" class="hx-external-review-error">{{ errorMessage }}</div>
      <p v-if="isLoading" class="hx-text-muted" aria-busy="true">Loading prepared music.</p>
      <ExternalCollectionReviewControls
        :collection="collection" :can-start-collection="canStartCollection" :preparation="preparation"
        :pagination="pagination" :page-number="pageNumber" :can-go-previous="canGoPrevious"
        :busy="isLoading || isMutating" :target-name="targetName"
        @start="save(startCollection)" @restart="save(startCollection, true)" @recover="save(recover)"
        @finalize="save(finalizeCollection)" @next="nextPage" @previous="previousPage"
      />
      <div v-if="!collection && !canStartCollection && preparation.canRecover" class="hx-external-review-recovery">
        <p class="hx-text-muted">{{ preparation.action === 'execute' ? 'Pending or failed provider items need metadata preparation before they can be reviewed.' : 'This request needs provider planning before music can be reviewed.' }}</p>
        <button type="button" class="hx-btn" :disabled="isMutating || isLoading" @click="save(recover)">
          {{ isMutating ? 'Saving…' : preparation.action === 'execute' ? 'Prepare provider metadata' : 'Plan this external request' }}
        </button>
      </div>
      <p v-if="!isLoading && !visibleItems.length && !intents.length" class="hx-text-muted">
        {{ collection ? 'No captured items on this review page. Check preparation and refresh after queued work finishes.' : 'No prepared albums are ready for review. Tracks and videos are not converted into album searches. Refresh after preparation finishes.' }}
      </p>
      <ExternalRequestReviewItem
        v-for="item in visibleItems" :key="item.collectionItemId || item.id" v-model:draft="drafts[item.id]"
        :item="item" :target-name="targetName" :busy="isMutating || isLoading"
        :can-exclude="canDecide && Boolean(item.collectionItemId) && item.decision === 'pending'"
        @search="search(item.id)" @approve="save(approve, item.id)" @exclude="save(exclude, item.id)"
      />
      <section v-if="intents.length" aria-labelledby="external-accepted-heading">
        <h3 id="external-accepted-heading" class="hx-card-title">Accepted release searches{{ collection ? ' on this page' : '' }}</h3>
        <ul class="hx-external-review-intents">
          <li v-for="intent in intents" :key="intent.id">
            <span>{{ intent.artistName }} · {{ intent.releaseTitle }}</span>
            <span class="hx-pill">{{ intentStatus(intent.status) }}</span>
            <p v-if="belongsToPreviousTarget(intent)" class="hx-text-muted">Accepted for a previous target. Create a separate request to search for the current target.</p>
          </li>
        </ul>
        <p class="hx-text-muted">Accepted searches retain their original target. Search completion does not mean music has been imported.</p>
      </section>
    </div>
  </article>
</template>

<style scoped>
.hx-external-review-body { display: grid; gap: var(--hx-space-3); min-width: 0; }
.hx-external-review .hx-card-header > .hx-btn { flex-shrink: 0; }
.hx-external-review-error { color: var(--hx-danger); }
.hx-external-review-intents { padding-left: var(--hx-space-5); }
.hx-external-review-intents li { padding: var(--hx-space-2) 0; overflow-wrap: anywhere; }
.hx-external-review-intents .hx-pill { margin-left: var(--hx-space-2); }
.hx-external-review p { margin: 0; }
@media (max-width: 640px) {
  .hx-external-review .hx-card-header { flex-wrap: wrap; }
  .hx-external-review .hx-btn { min-height: 44px; }
}
</style>
