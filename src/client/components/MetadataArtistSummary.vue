<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { RouterLink } from 'vue-router';
import { ref } from 'vue';
import MetadataDetectionHistoryEntry from './MetadataDetectionHistoryEntry.vue';
import MetadataTimestamp from './MetadataTimestamp.vue';

defineProps({
  canRefreshMetadata: {
    type: Boolean,
    default: false,
  },
  detectionEventsErrorMessage: {
    type: String,
    default: '',
  },
  detectionEventsStatusMessage: {
    type: String,
    default: '',
  },
  detectionEventsPageInfo: {
    type: Object,
    default: () => ({ hasMore: false, nextCursor: null }),
  },
  isLoadingDetectionEvents: {
    type: Boolean,
    default: false,
  },
  isRefreshingMetadata: {
    type: Boolean,
    default: false,
  },
  localArtist: {
    type: Object,
    required: true,
  },
  queuedRefreshRun: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['load-more-detection-events', 'refresh-metadata']);
const historyHeading = ref(null);
defineExpose({ getHistoryHeading: () => historyHeading.value });
</script>

<template>
  <section class="stats-grid">
    <article class="panel-light">
      <p class="eyebrow">Local artist</p>
      <h3>{{ localArtist.artist.name }}</h3>
      <RouterLink
        v-if="localArtist.artist?.source?.musicbrainzArtistId"
        class="secondary-button"
        :to="{ name: 'artist-detail', params: { mbid: localArtist.artist.source.musicbrainzArtistId } }"
      >
        Manage monitoring
      </RouterLink>
      <button
        v-if="canRefreshMetadata"
        type="button"
        class="secondary-button"
        :disabled="isRefreshingMetadata"
        @click="emit('refresh-metadata')"
      >
        {{ isRefreshingMetadata ? 'Queueing refresh...' : 'Refresh artist metadata' }}
      </button>
      <p class="metadata-card-copy" v-if="queuedRefreshRun?.id">
        Refresh queued as run {{ queuedRefreshRun.id }}.
      </p>
      <dl>
        <div><dt>Country</dt><dd>{{ localArtist.artist.country || 'Unknown' }}</dd></div>
        <div><dt>Disambiguation</dt><dd>{{ localArtist.artist.disambiguation || 'None' }}</dd></div>
        <div><dt>Stored release groups</dt><dd>{{ localArtist.releaseGroups.length }}</dd></div>
        <div><dt>Stored releases</dt><dd>{{ localArtist.releases.length }}</dd></div>
      </dl>
    </article>

    <article class="panel-light">
      <p class="eyebrow">Monitoring</p>
      <h3>Artist policy</h3>
      <dl>
        <div><dt>Monitored</dt><dd>{{ localArtist.monitoring?.isMonitored ? 'Yes' : 'No' }}</dd></div>
        <div><dt>Release types</dt><dd>{{ (localArtist.monitoring?.monitoredReleaseGroupTypes ?? []).join(', ') }}</dd></div>
        <div class="hx-metadata-policy-time"><dt>Last refresh</dt><dd><MetadataTimestamp :value="localArtist.monitoring?.lastRefreshedAt" fallback="Not yet recorded" /></dd></div>
        <div class="hx-metadata-policy-time"><dt>Next refresh</dt><dd><MetadataTimestamp :value="localArtist.monitoring?.nextRefreshAt" fallback="Not scheduled" /></dd></div>
        <div><dt>Aliases</dt><dd>{{ localArtist.aliases.length }}</dd></div>
      </dl>
    </article>

    <article class="panel-light">
      <p class="eyebrow">Identity</p>
      <h3>Canonical mapping</h3>
      <dl>
        <div><dt>Local ID</dt><dd>{{ localArtist.artist.id }}</dd></div>
        <div><dt>MusicBrainz MBID</dt><dd>{{ localArtist.artist.source.musicbrainzArtistId }}</dd></div>
      </dl>
    </article>

    <article class="panel-light">
      <p class="eyebrow">Release detection</p>
      <h3 ref="historyHeading" tabindex="-1" class="hx-metadata-history-heading">Recent discoveries</h3>
      <div role="status" aria-label="Detection history status" aria-live="polite" aria-atomic="true">
        <p v-if="detectionEventsErrorMessage" class="error-copy metadata-card-copy">Could not load more history. {{ detectionEventsErrorMessage }}</p>
        <p v-else-if="detectionEventsStatusMessage" class="metadata-card-copy">{{ detectionEventsStatusMessage }}</p>
      </div>
      <ul v-if="(localArtist.detectionEvents ?? []).length" class="metadata-list" :aria-busy="isLoadingDetectionEvents">
        <MetadataDetectionHistoryEntry v-for="event in localArtist.detectionEvents" :key="event.id" :event="event" :local-artist="localArtist" />
      </ul>
      <p v-else class="metadata-card-copy">No release detections have been recorded for this artist yet.</p>
      <div v-if="detectionEventsPageInfo?.hasMore" class="metadata-detection-actions">
        <button
          type="button"
          class="secondary-button"
          :disabled="isLoadingDetectionEvents"
          @click="emit('load-more-detection-events')"
        >
          {{ isLoadingDetectionEvents ? 'Loading more...' : 'Load more history' }}
        </button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.panel-light .hx-metadata-policy-time {
  display: grid;
  grid-column: 1 / -1;
  gap: var(--hx-space-1);
}

.hx-metadata-history-heading:focus-visible {
  outline: 2px solid var(--hx-accent-strong);
  outline-offset: 2px;
}

.metadata-detection-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}
</style>