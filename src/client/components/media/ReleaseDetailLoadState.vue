<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0. See LICENSE for details.
-->
<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  loading: Boolean,
  error: { type: String, default: null },
  canRetry: Boolean,
  retry: { type: Function, required: true },
  focusAfterRetry: { type: Function, required: true },
});
const retryButton = ref(null);
const retrying = ref(false);
const status = ref('');
let generation = 0;
onBeforeUnmount(() => { generation += 1; });

async function handleRetry() {
  if (!props.canRetry || retrying.value) return;
  const token = ++generation;
  status.value = '';
  retrying.value = true;
  await props.retry();
  if (token !== generation) return;
  const ownedFocus = globalThis.document?.activeElement === retryButton.value;
  retrying.value = false;
  if (!props.error) {
    status.value = 'Release details loaded.';
    await nextTick();
    if (token === generation && ownedFocus) props.focusAfterRetry();
  }
}
</script>

<template>
  <div class="hx-release-load-state">
    <p class="sr-only" role="status" aria-atomic="true">{{ loading ? 'Loading release details.' : status }}</p>
    <p v-if="loading && !retrying" class="hx-release-load-copy">Loading release details…</p>
    <div role="alert" aria-atomic="true">
      <template v-if="error">
        <h3 class="hx-release-load-title">Could not load release details</h3>
        <p class="hx-release-load-copy">The track list and edition details are unavailable. Try loading them again.</p>
      </template>
    </div>
    <div v-if="error || retrying" class="hx-release-load-actions">
      <button
        ref="retryButton"
        type="button"
        class="hx-btn"
        data-variant="primary"
        :aria-disabled="!canRetry || retrying"
        :aria-busy="retrying"
        @click="handleRetry"
      >{{ retrying ? 'Retrying…' : 'Retry' }}</button>
    </div>
  </div>
</template>

<style scoped>
.hx-release-load-title {
  margin: 0 0 var(--hx-space-2);
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}
.hx-release-load-copy {
  margin: 0;
  color: var(--hx-text-muted);
}
.hx-release-load-actions { margin-top: var(--hx-space-3); }
.hx-release-load-actions [aria-disabled="true"] { opacity: 0.65; cursor: wait; }
</style>
