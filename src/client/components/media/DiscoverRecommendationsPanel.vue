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
// Recommendations section for Discover. Receives ready-to-render view models
// (monitored chips and recommendation cards) from the container and stays free
// of business logic. Static copy is sourced from the presentation library so
// the wording lives in one tested place.
import DiscoverArtistCard from './DiscoverArtistCard.vue';
import PaginatedArtworkGrid from './PaginatedArtworkGrid.vue';
import {
  buildDiscoverMonitoredBandCopy,
  buildDiscoverNoSimilarArtistsMessage,
  buildDiscoverRecommendationsSubtitle,
  buildDiscoverSuggestionsCopy,
} from '../../lib/discover-presentation.js';

defineProps({
  chips: {
    type: Array,
    default: () => [],
  },
  cards: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  monitoredAriaLabel: {
    type: String,
    default: '',
  },
});

defineEmits(['add']);

// Map of artist id -> seed-chip element, so the container can return focus to a
// freshly added artist's chip after the add dialog closes (APG dialog pattern:
// when the invoking control is gone/disabled, focus a logical follow-on element).
const chipRefs = new Map();

function setChipRef(id, el) {
  if (el) {
    chipRefs.set(id, el.$el ?? el);
  } else {
    chipRefs.delete(id);
  }
}

function focusArtistChip(artistId) {
  const el = chipRefs.get(artistId);
  if (el && typeof el.focus === 'function') {
    el.focus();
    return true;
  }
  return false;
}

defineExpose({ focusArtistChip });
</script>

<template>
  <article class="hx-card discover-graph-card" aria-label="Recommended artists">
    <header class="hx-card-header discover-graph-card__header">
      <div>
        <h2 class="hx-card-title">Recommended artists</h2>
        <p class="hx-card-subtitle">{{ buildDiscoverRecommendationsSubtitle() }}</p>
      </div>
      <span v-if="isLoading" class="hx-pill" data-tone="warning">Refreshing recommendations</span>
    </header>

    <div class="hx-card-body discover-graph-card__body">
      <section class="discover-seed-band">
        <div class="discover-seed-band__header">
          <span class="discover-summary-card__label">Your monitored artists</span>
          <p class="discover-seed-band__copy">{{ buildDiscoverMonitoredBandCopy() }}</p>
        </div>

        <div class="discover-seeds" role="list" :aria-label="monitoredAriaLabel">
          <RouterLink
            v-for="chip in chips"
            :key="chip.id"
            :ref="(el) => setChipRef(chip.id, el)"
            :to="chip.to"
            class="discover-seed-chip"
            role="listitem"
            :aria-label="chip.ariaLabel"
          >
            <img
              v-if="chip.artworkUrl"
              :src="chip.artworkUrl"
              :alt="chip.name"
              class="discover-seed-chip__avatar"
              loading="lazy"
            />
            <span v-else class="discover-seed-chip__initial" aria-hidden="true">{{ chip.initial }}</span>
            <span class="discover-seed-chip__name">{{ chip.name }}</span>
          </RouterLink>
        </div>
      </section>

      <p v-if="errorMessage" class="discover-graph-card__error" role="alert">
        {{ errorMessage }}
      </p>

      <section v-if="cards.length > 0" class="discover-suggestions">
        <div class="discover-suggestions__header">
          <span class="discover-summary-card__label">Recommended for you</span>
          <p class="discover-suggestions__copy">{{ buildDiscoverSuggestionsCopy() }}</p>
        </div>

        <PaginatedArtworkGrid
          :items="cards"
          :initial-visible="8"
          :step="8"
          aria-label="Recommended artists"
        >
          <template #default="{ item: card }">
            <DiscoverArtistCard
              :artist="card.artist"
              :artwork="card.artwork"
              :badge="card.badge"
              :badge-tone="card.badgeTone"
              :strength-label="card.strengthLabel"
              :strength-tier="card.strengthTier"
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
      </section>

      <p v-else-if="!isLoading" class="discover-graph-card__empty">
        {{ buildDiscoverNoSimilarArtistsMessage() }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.discover-summary-card__label {
  display: inline-block;
  margin-bottom: var(--hx-space-2);
  font-size: var(--hx-text-xs);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
}

.discover-graph-card__header {
  align-items: flex-start;
}

.discover-graph-card__body {
  display: grid;
  gap: var(--hx-space-4);
}

.discover-seed-band {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3);
  border-radius: var(--hx-radius-lg);
  background: color-mix(in srgb, var(--hx-bg-surface-muted) 84%, transparent);
  border: 1px solid var(--hx-border-subtle);
}

.discover-seed-band__header {
  display: grid;
  gap: var(--hx-space-1);
}

.discover-seed-band__copy,
.discover-suggestions__copy {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.55;
}

.discover-seeds {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.discover-seed-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-2);
  min-height: 40px;
  padding: 0.4rem 0.7rem 0.4rem 0.45rem;
  border-radius: var(--hx-radius-pill);
  border: 1px solid var(--hx-border);
  background: var(--hx-bg-surface);
  color: var(--hx-text-strong);
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.discover-seed-chip:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--hx-accent) 40%, var(--hx-border));
  background: color-mix(in srgb, var(--hx-accent-soft) 18%, var(--hx-bg-surface));
}

.discover-seed-chip:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

.discover-seed-chip__avatar,
.discover-seed-chip__initial {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.discover-seed-chip__avatar {
  object-fit: cover;
}

.discover-seed-chip__initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hx-bg-surface-sunken);
  color: var(--hx-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.discover-seed-chip__name {
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.discover-suggestions {
  display: grid;
  gap: var(--hx-space-3);
}

.discover-suggestions__header {
  display: grid;
  gap: var(--hx-space-1);
}

.discover-graph-card__error {
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
}

.discover-graph-card__empty {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}
</style>
