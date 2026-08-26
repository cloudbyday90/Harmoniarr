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
import ArtworkImage from '../ArtworkImage.vue';
import {
  buildDiscoverArtistInitial,
  buildDiscoverAvatarStyle,
} from '../../lib/discover-presentation.js';
import { buildArtistDetailLocation } from '../../lib/artist-detail-route.js';
import {
  calculateOperatorArtistCoveragePercent,
  formatOperatorArtistCoverageLine,
  formatOperatorArtistPolicySummary,
  formatOperatorArtistWantedSummary,
} from '../../lib/operator-artist-card-presentation.js';
import { buildOperatorArtistCardStatusPresentation } from '../../lib/operator-artist-card-status-presentation.js';

const props = defineProps({
  artwork: {
    type: Object,
    default: null,
  },
  projection: {
    type: Object,
    required: true,
  },
});

const artist = computed(() => props.projection.artist ?? {});
const musicBrainzArtistId = computed(() => artist.value.musicBrainzArtistId ?? null);
const cardArtist = computed(() => ({
  country: artist.value.country ?? null,
  disambiguation: artist.value.disambiguation ?? null,
  id: musicBrainzArtistId.value ?? artist.value.id,
  name: artist.value.name ?? 'Unknown artist',
  sortName: artist.value.sortName ?? artist.value.name ?? '',
  type: artist.value.type ?? null,
}));
const monitoring = computed(() => props.projection.operator?.monitoring ?? {});
const coverage = computed(() => props.projection.operator?.coverage ?? {});
const cardStatus = computed(() => buildOperatorArtistCardStatusPresentation(
  props.projection.operator?.reconciliation,
));
const coveragePercent = computed(() => calculateOperatorArtistCoveragePercent(coverage.value));
const detailLocation = computed(() => (musicBrainzArtistId.value
  ? buildArtistDetailLocation(musicBrainzArtistId.value, cardArtist.value.name)
  : null));
</script>

<template>
  <ArtistCard
    :artist="cardArtist"
    :monitored="true"
    :to="detailLocation"
    :dominant-color="artwork?.dominantColor ?? null"
    :artwork-asset-id="artwork?.assetId ?? null"
    variant="operator-home"
  >
    <template #artwork>
      <ArtworkImage :local-src="artwork?.url" :alt="cardArtist.name">
        <template #fallback>
          <div
            class="operator-artist-card__avatar"
            :style="buildDiscoverAvatarStyle(cardArtist.id, cardArtist.name)"
            aria-hidden="true"
          >
            <span class="operator-artist-card__initial">
              {{ buildDiscoverArtistInitial(cardArtist.id, cardArtist.name) }}
            </span>
          </div>
        </template>
      </ArtworkImage>
    </template>

    <template #eyebrow>
      <span
        v-if="cardStatus"
        class="hx-pill operator-artist-card__status"
        :data-tone="cardStatus.tone"
      >
        {{ cardStatus.label }}
      </span>
    </template>

    <template #meta>
      {{ formatOperatorArtistPolicySummary(monitoring) }}
    </template>

    <template #body-footer>
      <div class="operator-artist-card__summary">
        <p>{{ formatOperatorArtistCoverageLine(coverage) }}</p>
        <p>{{ formatOperatorArtistWantedSummary(monitoring) }}</p>
      </div>
      <div class="operator-artist-card__progress" aria-hidden="true">
        <span :style="{ width: `${coveragePercent}%` }" />
      </div>
    </template>

    <template #actions>
      <RouterLink
        v-if="detailLocation"
        :to="detailLocation"
        class="hx-btn"
        data-variant="ghost"
        :aria-label="`Manage ${cardArtist.name}`"
      >
        Manage
      </RouterLink>
    </template>
  </ArtistCard>
</template>

<style scoped>
.operator-artist-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.operator-artist-card__initial {
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.operator-artist-card__status {
  width: fit-content;
  margin-bottom: var(--hx-space-1);
}

.operator-artist-card__summary {
  display: grid;
  gap: var(--hx-space-1);
  margin-top: var(--hx-space-2);
}

.operator-artist-card__summary p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.45;
}

.operator-artist-card__progress {
  height: 4px;
  overflow: hidden;
  margin-top: var(--hx-space-3);
  border-radius: var(--hx-radius-pill);
  background: var(--hx-bg-surface-sunken);
}

.operator-artist-card__progress span {
  display: block;
  height: 100%;
  min-width: 4px;
  border-radius: inherit;
  background: var(--hx-success);
}
</style>
