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
import ArtistCard from './ArtistCard.vue';
import {
  buildDiscoverArtistInitial,
  buildDiscoverAvatarStyle,
} from '../../lib/discover-presentation.js';

const props = defineProps({
  artist: {
    type: Object,
    required: true,
  },
  artwork: {
    type: Object,
    default: null,
  },
  badge: {
    type: String,
    default: '',
  },
  badgeTone: {
    type: String,
    default: 'info',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  metaText: {
    type: String,
    default: '',
  },
  monitored: {
    type: Boolean,
    default: false,
  },
  monitoring: {
    type: Boolean,
    default: false,
  },
  supportingText: {
    type: String,
    default: '',
  },
  to: {
    type: [String, Object],
    default: null,
  },
});

const emit = defineEmits(['add']);

function handleAdd() {
  emit('add', props.artist);
}
</script>

<template>
  <ArtistCard
    :artist="artist"
    :monitored="monitored"
    :monitoring="monitoring"
    :disabled="disabled"
    :to="to"
    :dominant-color="artwork?.dominantColor ?? null"
    :artwork-asset-id="artwork?.assetId ?? null"
    variant="discover"
  >
    <template #artwork>
      <img
        v-if="artwork?.url"
        :src="artwork.url"
        :alt="artist.name"
        class="discover-artist-card__image"
        loading="lazy"
      />
      <div
        v-else
        class="hx-artwork discover-artist-card__avatar"
        :style="buildDiscoverAvatarStyle(artist.id, artist.name)"
        aria-hidden="true"
      >
        <span class="discover-artist-card__initial">{{ buildDiscoverArtistInitial(artist.id, artist.name) }}</span>
      </div>
    </template>

    <template v-if="badge" #eyebrow>
      <span class="discover-artist-card__badge hx-pill" :data-tone="badgeTone">{{ badge }}</span>
    </template>

    <template v-if="metaText" #meta>
      {{ metaText }}
    </template>

    <template v-if="supportingText" #body-footer>
      <p class="discover-artist-card__supporting">{{ supportingText }}</p>
    </template>

    <template #actions>
      <button
        type="button"
        class="hx-btn discover-artist-card__add-button"
        :class="{ 'discover-artist-card__add-button--icon': !monitored }"
        :data-variant="monitored ? 'ghost' : 'primary'"
        :disabled="disabled || monitoring || monitored"
        :aria-busy="monitoring || undefined"
        :aria-label="monitored ? `${artist.name} is already monitored` : `Add ${artist.name}`"
        @click="handleAdd"
      >
        <template v-if="monitoring">Adding...</template>
        <template v-else-if="monitored">Already monitored</template>
        <template v-else>
          <span aria-hidden="true">+</span>
        </template>
      </button>
    </template>
  </ArtistCard>
</template>

<style scoped>
.discover-artist-card__image {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.discover-artist-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
}

.discover-artist-card__initial {
  font-size: clamp(1.8rem, 5vw, 2.4rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  user-select: none;
}

.discover-artist-card__badge {
  width: fit-content;
  margin-bottom: var(--hx-space-1);
}

.discover-artist-card__supporting {
  margin: var(--hx-space-1) 0 0;
  font-size: var(--hx-text-xs);
  line-height: 1.5;
  color: var(--hx-text-muted);
}

.discover-artist-card__add-button {
  min-height: 40px;
}

.discover-artist-card__add-button--icon {
  width: 40px;
  padding-inline: 0;
  font-size: 1.35rem;
  line-height: 1;
}
</style>
