<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import { useExternalRequestReview } from '../composables/useExternalRequestReview.js';
import { formatSourceProvider } from '../lib/import-candidate-presentation.js';

const props = defineProps({ mediaRequest: { type: Object, required: true } });
const emit = defineEmits(['updated']);
const {
  items, intents, preparation, drafts, isLoading, isMutating,
  errorMessage, statusMessage, load, search, approve, recover, reset,
} = useExternalRequestReview();
const targetName = computed(() => props.mediaRequest.requestedForUser?.username ?? 'the request target');
const reviewableItems = computed(() => items.value.filter((item) => item.reviewable
  && !intents.value.some((intent) => intent.providerKey === item.providerKey)));

watch([() => props.mediaRequest.id, () => props.mediaRequest.requestedForUser?.id], () => {
  reset();
  void refresh();
}, { immediate: true });
onBeforeUnmount(reset);

function refresh() {
  return load({ mediaRequestId: props.mediaRequest.id });
}

async function handleApprove(itemId) {
  if (await approve(itemId)) emit('updated');
}

async function handleRecover() {
  if (await recover()) emit('updated');
}

function releaseLabel(release) {
  return [
    release.artistName, release.title, release.releaseDate, release.country,
    release.trackCount != null ? `${release.trackCount} tracks` : null,
  ].filter(Boolean).join(' · ');
}

function selectedEditionLabel(itemId) {
  const draft = drafts.value[itemId];
  const release = draft?.releases.find((candidate) => candidate.id === draft.selectedReleaseId);
  return release ? releaseLabel(release) : '';
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
      <div v-if="preparation.canRecover" class="hx-external-review-recovery">
        <p class="hx-text-muted">{{ preparation.action === 'execute' ? 'Pending or failed provider items need metadata preparation before they can be reviewed.' : 'This request needs provider planning before music can be reviewed.' }}</p>
        <button type="button" class="hx-btn" :disabled="isMutating || isLoading" @click="handleRecover">
          {{ isMutating ? 'Saving…' : preparation.action === 'execute' ? 'Prepare provider metadata' : 'Plan this external request' }}
        </button>
      </div>
      <p v-if="!isLoading && !reviewableItems.length && !intents.length" class="hx-text-muted">
        No prepared albums are ready for review. Tracks and videos are not converted into album searches. Refresh after preparation finishes.
      </p>
      <form v-for="item in reviewableItems" :key="item.id" class="hx-external-review-item" @submit.prevent="handleApprove(item.id)">
        <fieldset :disabled="isMutating || isLoading">
          <legend>{{ item.artistName ? `${item.artistName} · ` : '' }}{{ item.title || 'Prepared album' }}</legend>
          <p class="hx-text-muted">
            {{ formatSourceProvider(item.sourceProvider) }}<template v-if="item.releaseDate"> · {{ item.releaseDate }}</template><template v-if="item.trackCount != null"> · {{ item.trackCount }} tracks</template>
          </p>
          <div class="hx-form-row">
            <div class="hx-field">
              <label :for="`external-artist-${item.id}`" class="hx-field-label">Artist in local catalog</label>
              <input :id="`external-artist-${item.id}`" v-model="drafts[item.id].artistName" class="hx-input" maxlength="300" :disabled="drafts[item.id].isSearching" />
            </div>
            <div class="hx-field">
              <label :for="`external-release-${item.id}`" class="hx-field-label">Release in local catalog</label>
              <input :id="`external-release-${item.id}`" v-model="drafts[item.id].releaseTitle" class="hx-input" maxlength="300" :disabled="drafts[item.id].isSearching" />
            </div>
          </div>
          <button type="button" class="hx-btn" :disabled="drafts[item.id].isSearching || !drafts[item.id].artistName.trim() || !drafts[item.id].releaseTitle.trim()" @click="search(item.id)">
            {{ drafts[item.id].isSearching ? 'Finding editions…' : 'Find local editions' }}
          </button>
          <div role="status" aria-atomic="true" class="hx-text-muted">{{ drafts[item.id].statusMessage }}</div>
          <div role="alert" aria-atomic="true" class="hx-external-review-error">{{ drafts[item.id].errorMessage }}</div>
          <p v-if="drafts[item.id].searchComplete && !drafts[item.id].releases.length" class="hx-text-muted">No matching local editions. Adjust the search or add catalog metadata before continuing.</p>
          <div v-if="drafts[item.id].releases.length" class="hx-field">
            <label :for="`external-edition-${item.id}`" class="hx-field-label">Matching local edition</label>
            <select :id="`external-edition-${item.id}`" v-model="drafts[item.id].selectedReleaseId" class="hx-select" required :disabled="drafts[item.id].isSearching" :aria-describedby="`external-edition-detail-${item.id}`">
              <option value="" disabled>Choose an edition</option>
              <option v-for="release in drafts[item.id].releases" :key="release.id" :value="release.id">{{ releaseLabel(release) }}</option>
            </select>
            <p :id="`external-edition-detail-${item.id}`" class="hx-text-muted hx-external-review-edition">{{ selectedEditionLabel(item.id) }}</p>
          </div>
          <button type="submit" class="hx-btn" data-variant="primary" :disabled="!drafts[item.id].selectedReleaseId || drafts[item.id].isSearching">
            {{ isMutating ? 'Saving…' : `Search this release for ${targetName}` }}
          </button>
        </fieldset>
      </form>
      <section v-if="intents.length" aria-labelledby="external-accepted-heading">
        <h3 id="external-accepted-heading" class="hx-card-title">Accepted release searches</h3>
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
.hx-external-review-body,
.hx-external-review-item fieldset {
  display: grid;
  gap: var(--hx-space-3);
  min-width: 0;
}
.hx-external-review-item fieldset {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  padding: var(--hx-space-4);
  margin: 0;
}
.hx-external-review-item legend { color: var(--hx-text-strong); font-weight: 600; }
.hx-external-review-item .hx-btn,
.hx-external-review-recovery .hx-btn { justify-self: start; }
.hx-external-review .hx-card-header > .hx-btn { flex-shrink: 0; }
.hx-external-review-error { color: var(--hx-danger); }
.hx-external-review-intents { padding-left: var(--hx-space-5); }
.hx-external-review-intents li { padding: var(--hx-space-2) 0; overflow-wrap: anywhere; }
.hx-external-review-intents .hx-pill { margin-left: var(--hx-space-2); }
.hx-external-review .hx-select { max-width: 100%; }
.hx-external-review-edition { overflow-wrap: anywhere; }
.hx-external-review p { margin: 0; }
@media (max-width: 640px) {
  .hx-external-review .hx-card-header { flex-wrap: wrap; }
  .hx-external-review .hx-form-row { display: grid; grid-template-columns: 1fr; }
  .hx-external-review .hx-btn,
  .hx-external-review .hx-select,
  .hx-external-review .hx-input { min-height: 44px; }
}
</style>
