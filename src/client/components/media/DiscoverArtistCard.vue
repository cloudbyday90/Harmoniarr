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
import { computed, ref, watch } from 'vue';
import ArtistCard from './ArtistCard.vue';
import {
  buildDiscoverArtistInitial,
  buildDiscoverAvatarStyle,
} from '../../lib/discover-presentation.js';
import { resolveDiscoverArtistCardActionState } from '../../lib/discover-artist-card-presentation.js';
import { resolveArtworkDisplayState } from '../../lib/artwork-display-state.js';

const props = defineProps({
  artist: {
    type: Object,
    required: true,
  },
  artwork: {
    type: Object,
    default: null,
  },
  // Whether artwork resolution is in flight for this card (the container's
  // global `isResolvingArtistArtwork` flag). Drives the loading skeleton via the
  // pure `resolveArtworkDisplayState` helper so the card never shows a misleading
  // "no artwork" avatar while an image is still being fetched.
  loading: {
    type: Boolean,
    default: false,
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
  strengthLabel: {
    type: String,
    default: '',
  },
  strengthTier: {
    type: String,
    default: '',
  },
  to: {
    type: [String, Object],
    default: null,
  },
});

const emit = defineEmits(['add']);

const artworkState = computed(() =>
  resolveArtworkDisplayState({
    url: props.artwork?.url ?? null,
    isResolving: props.loading,
  }),
);

// Tracks the resolved <img> paint lifecycle so the skeleton can cover the fetch
// gap and the image can fade in only once it has actually painted (not merely
// when its URL resolves). Reset whenever the URL changes so a new image re-fades.
const imageLoaded = ref(false);
const imageFailed = ref(false);
watch(
  () => props.artwork?.url,
  () => {
    imageLoaded.value = false;
    imageFailed.value = false;
  },
);

function handleImageLoad() {
  imageLoaded.value = true;
}

function handleImageError() {
  // Fall back to the avatar rather than a perpetual skeleton / broken image.
  imageFailed.value = true;
}

const showSkeleton = computed(
  () =>
    artworkState.value === 'loading' ||
    (artworkState.value === 'image' && !imageFailed.value),
);
const showImage = computed(() => artworkState.value === 'image' && !imageFailed.value);
const showAvatar = computed(() => artworkState.value === 'initial' || imageFailed.value);

const actionState = computed(() =>
  resolveDiscoverArtistCardActionState({
    artistName: props.artist?.name,
    monitored: props.monitored,
    monitoring: props.monitoring,
    disabled: props.disabled,
  }),
);

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
      <div
        v-if="showSkeleton"
        class="discover-artist-card__skeleton"
        :class="{ 'is-covered': imageLoaded }"
        aria-hidden="true"
      ></div>
      <img
        v-if="showImage"
        :src="artwork.url"
        :alt="artist.name"
        class="discover-artist-card__image"
        :class="{ 'is-loaded': imageLoaded }"
        loading="lazy"
        decoding="async"
        @load="handleImageLoad"
        @error="handleImageError"
      />
      <div
        v-if="showAvatar"
        class="hx-artwork discover-artist-card__avatar"
        :style="buildDiscoverAvatarStyle(artist.id, artist.name)"
        aria-hidden="true"
      >
        <span class="discover-artist-card__initial">{{ buildDiscoverArtistInitial(artist.id, artist.name) }}</span>
      </div>
    </template>

    <template v-if="badge || strengthLabel" #eyebrow>
      <span class="discover-artist-card__eyebrow">
        <span v-if="badge" class="discover-artist-card__badge hx-pill" :data-tone="badgeTone">{{ badge }}</span>
        <span
          v-if="strengthLabel"
          class="discover-artist-card__strength"
          :data-tier="strengthTier || undefined"
        >{{ strengthLabel }}</span>
      </span>
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
        :class="{ 'discover-artist-card__add-button--icon': actionState.iconOnly }"
        :data-state="actionState.state"
        :data-variant="actionState.buttonVariant"
        :disabled="actionState.buttonDisabled"
        :aria-busy="actionState.ariaBusy"
        :aria-label="actionState.ariaLabel"
        @click="handleAdd"
      >
        <template v-if="actionState.iconOnly">
          <span aria-hidden="true">+</span>
        </template>
        <template v-else>{{ actionState.visibleLabel }}</template>
      </button>
    </template>
  </ArtistCard>
</template>

<style scoped>
/* The image overlays the skeleton (absolute, inset:0) so it can cross-fade in
   on @load. Opacity 0 until .is-loaded; the transition is CLS-safe (geometry is
   reserved by the container's aspect-ratio) and only applied when the user has
   not set prefers-reduced-motion (WCAG 2.2.2 / technique C39). */
.discover-artist-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
}

.discover-artist-card__image.is-loaded {
  opacity: 1;
}

@media (prefers-reduced-motion: no-preference) {
  .discover-artist-card__image {
    transition: opacity 200ms ease;
  }
}

/* Loading skeleton — fills the reserved artwork box (the container's
   aspect-ratio already holds the geometry, so no reflow when the image lands).
   Purely visual: aria-hidden in the template because the panel-level
   "Refreshing" status conveys loading to assistive tech (avoids N simultaneous
   "loading" announcements across the grid). */
.discover-artist-card__skeleton {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--hx-bg-surface-muted) 0%,
    var(--hx-bg-surface-sunken) 50%,
    var(--hx-bg-surface-muted) 100%
  );
  background-size: 200% 100%;
  animation: hx-skeleton-pulse 1.4s ease-in-out infinite;
}

/* Once the image has loaded and starts fading in over the skeleton, stop the
   pulse so it's not animating invisibly underneath the opaque image. */
.discover-artist-card__skeleton.is-covered {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .discover-artist-card__skeleton {
    animation: none;
  }
}

.discover-artist-card__avatar {
  position: absolute;
  inset: 0;
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

.discover-artist-card__eyebrow {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--hx-space-1);
  margin-bottom: var(--hx-space-1);
}

.discover-artist-card__eyebrow .discover-artist-card__badge {
  margin-bottom: 0;
}

.discover-artist-card__strength {
  display: inline-flex;
  align-items: center;
  font-size: var(--hx-text-xs);
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--hx-text-muted);
}

.discover-artist-card__strength::before {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  margin-right: 0.35rem;
  border-radius: 50%;
  background: var(--hx-border-strong, var(--hx-border));
}

.discover-artist-card__strength[data-tier='strong']::before {
  background: var(--hx-success, var(--hx-accent));
}

.discover-artist-card__strength[data-tier='moderate']::before {
  background: var(--hx-accent);
}

.discover-artist-card__strength[data-tier='emerging']::before {
  background: var(--hx-text-muted);
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
