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
import MetadataTimestamp from './MetadataTimestamp.vue';

defineProps({
  canRefreshMetadata: {
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

const emit = defineEmits(['refresh-metadata']);
</script>

<template>
  <section class="hx-metadata-artist-summary" aria-label="Artist summary">
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
  </section>
</template>

<style scoped>
.hx-metadata-artist-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--hx-space-3);
}

.panel-light .hx-metadata-policy-time {
  display: grid;
  grid-column: 1 / -1;
  gap: var(--hx-space-1);
}

@media (max-width: 960px) {
  .hx-metadata-artist-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hx-metadata-artist-summary > :last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .hx-metadata-artist-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
