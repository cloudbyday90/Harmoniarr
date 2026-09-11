<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed } from 'vue';
import { formatSourceProvider } from '../lib/import-candidate-presentation.js';

const props = defineProps({
  item: { type: Object, required: true },
  targetName: { type: String, required: true },
  busy: { type: Boolean, default: false },
  canExclude: { type: Boolean, default: false },
});
const draft = defineModel('draft', { type: Object, required: true });
defineEmits(['search', 'approve', 'exclude']);
const title = computed(() => [props.item.artistName, props.item.title || 'Provider item'].filter(Boolean).join(' · '));
const selectedEdition = computed(() => draft.value.releases.find((release) => release.id === draft.value.selectedReleaseId));
function releaseLabel(release) {
  return [release.artistName, release.title, release.releaseDate, release.country,
    release.trackCount != null ? `${release.trackCount} tracks` : null].filter(Boolean).join(' · ');
}
</script>

<template>
  <section class="hx-external-review-item" :aria-labelledby="`external-item-${item.id}`">
    <h3 :id="`external-item-${item.id}`" class="hx-card-title">{{ title }}</h3>
    <template v-if="item.collectionItemId">
      <span class="hx-pill">{{ item.decision === 'included' ? 'Included' : item.decision === 'excluded' ? 'Excluded' : 'Decision pending' }}</span>
      <p v-if="item.decision === 'included'" class="hx-text-muted">Included through an accepted release search. Search completion still requires import review.</p>
      <p v-if="item.decision === 'excluded'" class="hx-text-muted">Reason: {{ item.exclusionReason }}</p>
      <p v-if="item.decision === 'pending' && item.status === 'failed'" class="hx-external-review-error">Metadata preparation failed. Prepare the next collection batch to retry, then refresh.</p>
      <p v-if="item.decision === 'pending' && !item.reviewable" class="hx-text-muted">{{ item.itemKind === 'unsupported' ? 'This provider entry cannot be prepared as an album. Record a reason to exclude it.' : 'This item is awaiting collection preparation or is not eligible for an album search.' }}</p>
    </template>
    <form v-if="item.reviewable" @submit.prevent="$emit('approve')">
        <fieldset :disabled="busy">
          <legend>Choose a local release edition</legend>
          <p class="hx-text-muted">
            {{ formatSourceProvider(item.sourceProvider) }}<template v-if="item.releaseDate"> · {{ item.releaseDate }}</template><template v-if="item.trackCount != null"> · {{ item.trackCount }} tracks</template>
          </p>
          <div class="hx-form-row">
            <div class="hx-field">
              <label :for="`external-artist-${item.id}`" class="hx-field-label">Artist in local catalog</label>
              <input :id="`external-artist-${item.id}`" v-model="draft.artistName" class="hx-input" maxlength="300" :disabled="draft.isSearching" />
            </div>
            <div class="hx-field">
              <label :for="`external-release-${item.id}`" class="hx-field-label">Release in local catalog</label>
              <input :id="`external-release-${item.id}`" v-model="draft.releaseTitle" class="hx-input" maxlength="300" :disabled="draft.isSearching" />
            </div>
          </div>
          <button type="button" class="hx-btn" :disabled="draft.isSearching || !draft.artistName.trim() || !draft.releaseTitle.trim()" @click="$emit('search')">
            {{ draft.isSearching ? 'Finding editions…' : 'Find local editions' }}
          </button>
          <div role="status" aria-atomic="true" class="hx-text-muted">{{ draft.statusMessage }}</div>
          <div role="alert" aria-atomic="true" class="hx-external-review-error">{{ draft.errorMessage }}</div>
          <p v-if="draft.searchComplete && !draft.releases.length" class="hx-text-muted">No matching local editions. Adjust the search or add catalog metadata before continuing.</p>
          <div v-if="draft.releases.length" class="hx-field">
            <label :for="`external-edition-${item.id}`" class="hx-field-label">Matching local edition</label>
            <select :id="`external-edition-${item.id}`" v-model="draft.selectedReleaseId" class="hx-select" required :disabled="draft.isSearching" :aria-describedby="`external-edition-detail-${item.id}`">
              <option value="" disabled>Choose an edition</option>
              <option v-for="release in draft.releases" :key="release.id" :value="release.id">{{ releaseLabel(release) }}</option>
            </select>
            <p :id="`external-edition-detail-${item.id}`" class="hx-text-muted hx-external-review-edition">{{ selectedEdition ? releaseLabel(selectedEdition) : '' }}</p>
          </div>
          <button type="submit" class="hx-btn" data-variant="primary" :disabled="!draft.selectedReleaseId || draft.isSearching">
            {{ busy ? 'Saving…' : `Search this release for ${targetName}` }}
          </button>
        </fieldset>
      </form>
    <form v-if="canExclude" @submit.prevent="$emit('exclude')">
      <fieldset :disabled="busy">
        <legend class="hx-field-label">Exclude from this collection selection</legend>
        <div class="hx-field">
          <label :for="`external-exclusion-${item.id}`" class="hx-field-label">Reason for exclusion</label>
          <textarea :id="`external-exclusion-${item.id}`" v-model="draft.exclusionReason" class="hx-textarea" required maxlength="500" rows="2" />
        </div>
        <button type="submit" class="hx-btn" :disabled="!draft.exclusionReason.trim()">Exclude this item</button>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.hx-external-review-item,
.hx-external-review-item fieldset { display: grid; gap: var(--hx-space-3); min-width: 0; }
.hx-external-review-item { border: 1px solid var(--hx-border); border-radius: var(--hx-radius-sm); padding: var(--hx-space-4); }
.hx-external-review-item fieldset { border: 0; margin: 0; padding: 0; }
.hx-external-review-item legend { margin-bottom: var(--hx-space-2); }
.hx-external-review-item .hx-btn,
.hx-external-review-item .hx-pill { justify-self: start; }
.hx-external-review-item .hx-select { max-width: 100%; }
.hx-external-review-error { color: var(--hx-danger); }
.hx-external-review-edition,
.hx-external-review-item .hx-card-title,
.hx-external-review-item p { overflow-wrap: anywhere; }
.hx-external-review-item p { margin: 0; }
@media (max-width: 640px) {
  .hx-external-review-item .hx-form-row { display: grid; grid-template-columns: 1fr; }
  .hx-external-review-item .hx-btn,
  .hx-external-review-item .hx-select,
  .hx-external-review-item .hx-input { min-height: 44px; }
}
</style>
