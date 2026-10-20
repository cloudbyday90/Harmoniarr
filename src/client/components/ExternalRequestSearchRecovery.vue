<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useExternalRequestSearchRecovery } from '../composables/useExternalRequestSearchRecovery.js';
import { createUserCommandFocusTracker } from '../lib/user-command-focus.js';

const props = defineProps({ mediaRequestId: { type: String, required: true }, recipientId: { type: String, default: null },
  intent: { type: Object, required: true }, busy: Boolean, refreshReview: { type: Function, required: true } });
const emit = defineEmits(['pending', 'updated']);
const command = useExternalRequestSearchRecovery({ mediaRequestId: () => props.mediaRequestId,
  intentId: () => props.intent.id, recipientId: () => props.recipientId });
const heading = ref(null); const refreshFailed = ref(false);
const releaseName = computed(() => `${props.intent.artistName} — ${props.intent.releaseTitle}`);
let disposed = false; const trackers = new Set();
watch(command.isPending, value => emit('pending', value), { flush: 'sync' });
onBeforeUnmount(() => { disposed = true; command.destroy(); emit('pending', false); for (const tracker of trackers) tracker.dispose(); });

async function searchAgain() {
  if (props.busy || command.isPending.value) return;
  const identity = JSON.stringify([props.mediaRequestId, props.recipientId, props.intent.id]);
  const current = () => !disposed && identity === JSON.stringify([props.mediaRequestId, props.recipientId, props.intent.id]);
  const focus = createUserCommandFocusTracker({ document: globalThis.document }); trackers.add(focus);
  try {
    refreshFailed.value = false;
    const result = await command.searchAgain({ expectedOperationRunId: props.intent.searchRecovery?.expectedOperationRunId });
    if (!current()) return;
    if (result) {
      refreshFailed.value = await props.refreshReview() === false;
      if (!current()) return;
      emit('updated');
    }
    await nextTick();
    if (!current()) return;
    if (result && focus.ownsFocus()) heading.value?.focus();
    else if (!result) focus.restoreAfterFailure();
  } finally { focus.dispose(); trackers.delete(focus); }
}
</script>

<template>
  <section v-if="intent.searchRecovery || command.statusMessage.value || command.errorMessage.value" class="hx-external-search-recovery" :aria-label="`Search recovery for ${releaseName}`">
    <h4 ref="heading" tabindex="-1">Search recovery</h4>
    <p v-if="intent.searchRecovery" class="hx-text-muted">{{ intent.searchRecovery.message }}</p>
    <template v-if="intent.searchRecovery?.policy">
      <p v-if="intent.searchRecovery.policy.blockedReason === 'exhausted'" class="hx-text-muted">
        The fresh-search limit has been reached. Review the approved release and provider health.
      </p>
      <p v-else-if="intent.searchRecovery.policy.blockedReason === 'cooldown'" class="hx-text-muted">
        Search again is available after
        <time :datetime="intent.searchRecovery.policy.nextSearchAfter">{{ new Date(intent.searchRecovery.policy.nextSearchAfter).toLocaleString() }}</time>.
        Refresh the review after this time.
      </p>
      <p class="hx-text-muted">{{ intent.searchRecovery.policy.remainingSearches }} fresh {{ intent.searchRecovery.policy.remainingSearches === 1 ? 'search' : 'searches' }} remaining for this approved release.</p>
    </template>
    <div :aria-busy="command.isPending.value ? 'true' : undefined">
      <button v-if="intent.searchRecovery?.canSearchAgain || command.hasUncertainIntent.value" type="button" class="hx-btn"
        :disabled="busy || command.isPending.value"
        :aria-label="`${command.hasUncertainIntent.value ? 'Retry saved search request' : 'Search again'} for ${releaseName}`" @click="searchAgain">
        {{ command.isPending.value ? 'Queueing…' : command.hasUncertainIntent.value ? 'Retry saved search request' : 'Search again' }}
      </button>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true">{{ command.statusMessage.value }}</div>
    <p v-if="refreshFailed" class="hx-text-muted">The new search is queued. Refresh the review to see its latest status.</p>
    <div role="alert" aria-atomic="true">{{ command.errorMessage.value }}</div>
  </section>
</template>

<style scoped>
.hx-external-search-recovery { display: grid; gap: var(--hx-space-2); margin-top: var(--hx-space-2); }
.hx-external-search-recovery h4, .hx-external-search-recovery p { margin: 0; }
.hx-external-search-recovery [role='alert'] { color: var(--hx-danger); }
@media (max-width: 640px) { .hx-external-search-recovery .hx-btn { min-height: 44px; } }
</style>
