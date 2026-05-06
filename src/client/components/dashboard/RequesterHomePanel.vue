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
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import ArtistCard from '../media/ArtistCard.vue';
import EmptyState from '../EmptyState.vue';
import { useMonitoredArtists } from '../../composables/useMonitoredArtists.js';

const { artists, errorMessage, isLoading, loadMonitoredArtists } = useMonitoredArtists({ limit: 25 });

const hasArtists = computed(() => artists.value.length > 0);

onMounted(() => {
  void loadMonitoredArtists();
});
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

      <!-- "Find more artists" tail card — always visible when artists exist -->
      <RouterLink
        :to="{ name: 'discover' }"
        class="hx-media-card requester-home-discover-card"
        aria-label="Find more artists"
      >
        <div class="hx-artwork hx-artwork--dashed requester-home-discover-art">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
        </div>
        <div class="hx-media-card-body">
          <p class="hx-media-card-title">Find more artists</p>
        </div>
      </RouterLink>
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

/* The tail discover card is a RouterLink and should have pointer cursor */
.requester-home-discover-card {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.requester-home-discover-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hx-text-muted);
}

.requester-home-discover-art svg {
  width: 40%;
  height: 40%;
  max-width: 64px;
}
</style>
