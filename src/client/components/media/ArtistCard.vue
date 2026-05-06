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
import { computed, toRef, useTemplateRef } from 'vue';
import { RouterLink } from 'vue-router';
import ArtworkImage from '../ArtworkImage.vue';
import MonitorButton from './MonitorButton.vue';
import { useArtworkColor } from '../../composables/useArtworkColor.js';

/**
 * ArtistCard — presentational artwork-first artist card.
 *
 * Displays artist artwork, name, and metadata. Exposes a default monitor
 * action via MonitorButton and an `actions` slot for custom action overrides.
 *
 * When the optional `to` prop is provided, the artwork and body area are
 * wrapped in a RouterLink to make the card navigable (e.g. to ArtistDetailView).
 * The actions area remains outside the link so interactive controls still work.
 *
 * Does not call APIs or show toasts directly. All actions are surfaced as
 * events for the parent to handle.
 */
const props = defineProps({
  /** Artist object from a MusicBrainz search result. */
  artist: {
    type: Object,
    required: true,
  },
  /** Whether this artist is already monitored. */
  monitored: {
    type: Boolean,
    default: false,
  },
  /** Whether a monitor operation is in progress for this artist. */
  monitoring: {
    type: Boolean,
    default: false,
  },
  /** Whether all card actions should be disabled. */
  disabled: {
    type: Boolean,
    default: false,
  },
  /** Optional visual variant forwarded to the card element. */
  variant: {
    type: String,
    default: null,
  },
  /**
   * Optional Vue Router location. When provided, the artwork and body area
   * are wrapped in a RouterLink. Accepts any value valid for RouterLink's
   * `to` prop (string or route location object).
   */
  to: {
    type: [String, Object],
    default: null,
  },
  /**
   * Server-extracted dominant OKLCH color for accent theming.
   * Shape: { hue, chroma, lightness, hex } | null
   */
  dominantColor: {
    type: Object,
    default: null,
  },
  /** Artwork asset UUID for client-side color write-back. */
  artworkAssetId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['monitor']);

/** Readable metadata line built from available artist fields. Computed once per render. */
const meta = computed(() => {
  const parts = [];
  if (props.artist.type) parts.push(props.artist.type);
  if (props.artist.country) parts.push(props.artist.country);
  if (props.artist.disambiguation) parts.push(props.artist.disambiguation);
  return parts.join(' · ');
});

function handleMonitor() {
  emit('monitor', props.artist);
}

const artworkImageComp = useTemplateRef('artworkImageComp');
const imgElRef = computed(() => artworkImageComp.value?.imgRef ?? null);
const isSameOriginFn = () => {
  const src = artworkImageComp.value?.activeSrc?.value ?? artworkImageComp.value?.activeSrc;
  if (!src) return false;
  if (src.startsWith('/')) return true;
  try { return new URL(src).origin === window.location.origin; } catch { return false; }
};
const { accent } = useArtworkColor(imgElRef, {
  dominantColor: toRef(props, 'dominantColor'),
  isSameOriginFn,
  artworkAssetId: toRef(props, 'artworkAssetId'),
});

const accentStyle = computed(() => {
  if (!accent.value || accent.value.hue === null) return {};
  return {
    '--card-accent-h': accent.value.hue,
    '--card-accent-c': accent.value.chroma,
    '--card-accent-ref-l': accent.value.lightness,
  };
});
</script>

<template>
  <article class="hx-media-card" :data-variant="variant || undefined" :style="accentStyle">
    <!-- When `to` is set, artwork and body are a navigable block link. -->
    <RouterLink v-if="to" :to="to" class="hx-media-card__link-area">
      <div class="hx-media-card__artwork">
        <slot name="artwork">
          <ArtworkImage ref="artworkImageComp" :alt="artist.name" />
        </slot>
      </div>
      <div class="hx-media-card__body">
        <p class="hx-media-card__title">{{ artist.name }}</p>
        <p v-if="meta" class="hx-media-card__meta">{{ meta }}</p>
      </div>
    </RouterLink>
    <template v-else>
      <div class="hx-media-card__artwork">
        <slot name="artwork">
          <ArtworkImage ref="artworkImageComp" :alt="artist.name" />
        </slot>
      </div>
      <div class="hx-media-card__body">
        <p class="hx-media-card__title">{{ artist.name }}</p>
        <p v-if="meta" class="hx-media-card__meta">{{ meta }}</p>
      </div>
    </template>
    <div class="hx-media-card__actions">
      <slot name="actions">
        <MonitorButton
          :monitored="monitored"
          :loading="monitoring"
          :disabled="disabled"
          :aria-label="monitored ? `${artist.name} — already monitored` : `Monitor ${artist.name}`"
          @monitor="handleMonitor"
        />
      </slot>
    </div>
  </article>
</template>

<style scoped>
/*
 * When `to` is set, the link area wraps artwork + body as a flex column
 * so the card's existing gap and layout are preserved. The link itself has
 * no visible decoration.
 */
.hx-media-card__link-area {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
  text-decoration: none;
  color: inherit;
}

.hx-media-card {
  border: 1px solid color-mix(
    in oklch,
    oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0)) 40%,
    transparent
  );
  transition: border-color 0.2s ease;
}

:global([data-theme="light"]) .hx-media-card {
  border-color: color-mix(
    in oklch,
    oklch(0.38 var(--card-accent-c, 0) var(--card-accent-h, 0)) 50%,
    transparent
  );
}

.hx-media-card:hover {
  border-color: oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0) / 0.85);
}
</style>
