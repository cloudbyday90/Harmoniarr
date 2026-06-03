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
// Direct catalog search results for Discover. Receives ready-to-render card
// view models from the container and re-emits add intents upward.
import DiscoverArtistCard from './DiscoverArtistCard.vue';
import PaginatedArtworkGrid from './PaginatedArtworkGrid.vue';

defineProps({
  cards: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['add']);
</script>

<template>
  <article class="hx-card discover-results-card">
    <header class="hx-card-header">
      <div>
        <h2 class="hx-card-title">Search results</h2>
        <p class="hx-card-subtitle">
          Direct catalog matches stay separate from recommendations so you can add with intent.
        </p>
      </div>
    </header>

    <div class="hx-card-body">
      <PaginatedArtworkGrid
        :items="cards"
        :initial-visible="12"
        :step="12"
        aria-label="Artist search results"
      >
        <template #default="{ item: card }">
          <DiscoverArtistCard
            :artist="card.artist"
            :artwork="card.artwork"
            :badge="card.badge"
            :badge-tone="card.badgeTone"
            :meta-text="card.metaText"
            :supporting-text="card.supportingText"
            :monitored="card.monitored"
            :monitoring="card.monitoring"
            :disabled="card.disabled"
            :to="card.to"
            @add="$emit('add', $event)"
          />
        </template>
      </PaginatedArtworkGrid>
    </div>
  </article>
</template>
