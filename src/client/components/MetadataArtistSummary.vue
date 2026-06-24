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
import {
  describeMonitoringDecision,
  describeWantedState,
  detectionEventLinkTarget,
} from '../lib/metadata-artist-presentation.js';

defineProps({
  detectionEventsErrorMessage: {
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
        <div><dt>Last refresh</dt><dd>{{ localArtist.monitoring?.lastRefreshedAt || 'Not yet recorded' }}</dd></div>
        <div><dt>Next refresh</dt><dd>{{ localArtist.monitoring?.nextRefreshAt || 'Not scheduled' }}</dd></div>
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
      <h3>Recent discoveries</h3>
      <p v-if="detectionEventsErrorMessage" class="error-copy metadata-card-copy">{{ detectionEventsErrorMessage }}</p>
      <ul v-if="(localArtist.detectionEvents ?? []).length" class="metadata-list">
        <li v-for="event in localArtist.detectionEvents" :key="event.id">
          <div class="metadata-detection-entry-header">
            <strong>{{ event.title }}</strong>
            <RouterLink
              v-if="detectionEventLinkTarget(localArtist, event)"
              class="secondary-button"
              :to="detectionEventLinkTarget(localArtist, event).to"
            >
              {{ detectionEventLinkTarget(localArtist, event).label }}
            </RouterLink>
          </div>
          <span>{{ event.primaryType || 'Unknown type' }} · {{ event.occurredAt }}</span>
          <span>{{ describeMonitoringDecision(event.monitoringDecision) }}</span>
          <span>Wanted state: {{ describeWantedState(event.resultingWantedStatus) }}</span>
        </li>
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
.metadata-detection-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.metadata-detection-entry-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}
</style>