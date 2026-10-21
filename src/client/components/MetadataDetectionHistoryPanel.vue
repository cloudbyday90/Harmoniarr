<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { ref, useId } from 'vue';
import MetadataDetectionHistoryEntry from './MetadataDetectionHistoryEntry.vue';

defineProps({
  localArtist: { type: Object, required: true },
  detectionEventsErrorMessage: { type: String, default: '' },
  detectionEventsStatusMessage: { type: String, default: '' },
  detectionEventsPageInfo: { type: Object, default: () => ({ hasMore: false, nextCursor: null }) },
  isLoadingDetectionEvents: { type: Boolean, default: false },
});
const emit = defineEmits(['load-more']);
const headingId = useId();
const historyHeading = ref(null);
defineExpose({ getHistoryHeading: () => historyHeading.value });
</script>

<template>
  <section class="panel-light" :aria-labelledby="headingId">
    <p class="eyebrow">Release detection</p>
    <h3 :id="headingId" ref="historyHeading" tabindex="-1" class="hx-metadata-history-heading">Recent discoveries</h3>
    <div role="status" aria-label="Detection history status" aria-live="polite" aria-atomic="true">
      <p v-if="detectionEventsErrorMessage" class="error-copy metadata-card-copy">Could not load more history. {{ detectionEventsErrorMessage }}</p>
      <p v-else-if="detectionEventsStatusMessage" class="metadata-card-copy">{{ detectionEventsStatusMessage }}</p>
    </div>
    <ul v-if="(localArtist.detectionEvents ?? []).length" class="metadata-list" :aria-busy="isLoadingDetectionEvents">
      <MetadataDetectionHistoryEntry v-for="event in localArtist.detectionEvents" :key="event.id" :event="event" :local-artist="localArtist" />
    </ul>
    <p v-else class="metadata-card-copy">No release detections have been recorded for this artist yet.</p>
    <div v-if="detectionEventsPageInfo?.hasMore" class="hx-metadata-history-actions">
      <button type="button" class="secondary-button hx-metadata-history-more" :disabled="isLoadingDetectionEvents" @click="emit('load-more')">
        {{ isLoadingDetectionEvents ? 'Loading more...' : 'Load more history' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.hx-metadata-history-heading:focus-visible,
.hx-metadata-history-more:focus-visible {
  outline: 2px solid var(--hx-accent-strong);
  outline-offset: 2px;
}

.hx-metadata-history-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--hx-space-4);
}

.hx-metadata-history-more {
  scroll-margin-block: var(--hx-space-2);
  scroll-margin-inline: var(--hx-space-2);
}

</style>
