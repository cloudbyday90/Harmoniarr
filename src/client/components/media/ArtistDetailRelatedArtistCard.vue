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
  buildRelatedArtistAvatarStyle,
  buildRelatedArtistInitial,
} from '../../lib/artist-detail-presentation.js';

defineProps({
  artist: {
    type: Object,
    required: true,
  },
  artworkUrl: {
    type: String,
    default: null,
  },
  metaText: {
    type: String,
    default: '',
  },
  supportingText: {
    type: String,
    default: '',
  },
  to: {
    type: [String, Object],
    required: true,
  },
});
</script>

<template>
  <RouterLink :to="to" class="artist-detail-related-card">
    <img
      v-if="artworkUrl"
      :src="artworkUrl"
      :alt="artist.name"
      class="artist-detail-related-card__image"
      loading="lazy"
    />
    <div
      v-else
      class="artist-detail-related-card__avatar"
      :style="buildRelatedArtistAvatarStyle(artist.id, artist.name)"
      aria-hidden="true"
    >
      <span class="artist-detail-related-card__initial">{{ buildRelatedArtistInitial(artist.id, artist.name) }}</span>
    </div>
    <div class="artist-detail-related-card__body">
      <span class="artist-detail-related-card__name">{{ artist.name }}</span>
      <span v-if="metaText" class="artist-detail-related-card__meta">{{ metaText }}</span>
      <span v-if="supportingText" class="artist-detail-related-card__supporting">{{ supportingText }}</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.artist-detail-related-card {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: var(--hx-space-3);
  align-items: center;
  min-width: 260px;
  padding: var(--hx-space-3);
  border-radius: var(--hx-radius-lg);
  background: color-mix(in srgb, var(--hx-bg-surface-muted) 82%, transparent);
  border: 1px solid var(--hx-border-subtle);
  text-decoration: none;
  color: inherit;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.artist-detail-related-card:hover,
.artist-detail-related-card:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--hx-accent) 34%, var(--hx-border));
  box-shadow: var(--hx-shadow-sm);
  outline: none;
}

.artist-detail-related-card__image,
.artist-detail-related-card__avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  flex-shrink: 0;
}

.artist-detail-related-card__image {
  object-fit: cover;
}

.artist-detail-related-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
}

.artist-detail-related-card__initial {
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1;
}

.artist-detail-related-card__body {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.artist-detail-related-card__name {
  font-size: var(--hx-text-sm);
  font-weight: 700;
  color: var(--hx-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-detail-related-card__meta,
.artist-detail-related-card__supporting {
  font-size: var(--hx-text-xs);
  line-height: 1.45;
  color: var(--hx-text-muted);
}
</style>
