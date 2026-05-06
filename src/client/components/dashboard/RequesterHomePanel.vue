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
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import ArtistCard from '../media/ArtistCard.vue';
import EmptyState from '../EmptyState.vue';
import { useMonitoredArtists } from '../../composables/useMonitoredArtists.js';

const { artists, errorMessage, isLoading } = useMonitoredArtists({ limit: 25 });

const hasArtists = computed(() => artists.value.length > 0);
</script>

<template>
  <section class="hx-page requester-home">

    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Home</h1>
        <p class="hx-page-subtitle">Artists you're monitoring and music you care about.</p>
      </div>
      <div class="hx-page-actions">
        <RouterLink :to="{ name: 'discover' }" class="hx-btn">Discover artists</RouterLink>
      </div>
    </header>

    <!-- Loading state -->
    <p
      v-if="isLoading && !hasArtists"
      class="requester-home-loading"
      aria-live="polite"
      aria-busy="true"
    >
      Loading your artists…
    </p>

    <!-- Error state -->
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      body="Check your connection and try refreshing the page."
    />

    <!-- Empty state — no monitored artists yet -->
    <EmptyState
      v-else-if="!isLoading && !hasArtists"
      title="Start building your music home"
      body="Discover artists you love and Harmoniarr will keep them close for future requests."
      cta-label="Discover artists"
      :cta-to="{ name: 'discover' }"
      variant="discover"
    />

    <!-- Monitored artists grid -->
    <section
      v-else
      class="hx-artwork-grid requester-home-grid"
      aria-label="Monitored artists"
    >
      <ArtistCard
        v-for="artist in artists"
        :key="artist.id"
        :artist="artist"
        :monitored="true"
      />
    </section>

  </section>
</template>

<style scoped>
.requester-home {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.requester-home-loading {
  text-align: center;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-6) 0;
}

.requester-home-grid {
  --hx-artwork-grid-min: 160px;
}

/* Monitored cards are not interactive at the card level — cursor stays default */
.requester-home-grid .hx-media-card {
  cursor: default;
}
</style>
