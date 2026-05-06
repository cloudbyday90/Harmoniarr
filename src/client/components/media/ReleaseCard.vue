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
import ArtworkImage from '../ArtworkImage.vue';
import RequestButton from './RequestButton.vue';
import { canRequestRelease, getReleaseArtistName, getReleaseTitle, getReleaseYear } from '../../lib/release-normalization.js';
import { useArtworkColor } from '../../composables/useArtworkColor.js';

/**
 * ReleaseCard — presentational artwork-first release card.
 *
 * Displays release artwork, title, artist, and metadata. Exposes a default
 * request action via RequestButton and an `actions` slot for custom overrides.
 *
 * Does not call APIs or show toasts directly. All actions are surfaced as
 * events for the parent to handle.
 */
const props = defineProps({
  /** Release object from a MusicBrainz search result. */
  release: {
    type: Object,
    required: true,
  },
  /** Whether this release has already been successfully requested. */
  requested: {
    type: Boolean,
    default: false,
  },
  /** Whether a request operation is currently in progress for this release. */
  requesting: {
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
   * Whether this release can be requested. Defaults to the result of
   * `canRequestRelease(release)`. Override to force unavailable state.
   */
  requestable: {
    type: Boolean,
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

const emit = defineEmits(['request']);

/** Whether the release can actually be requested (has required fields). */
const isRequestable = computed(() => {
  if (props.requestable !== null) return props.requestable;
  return canRequestRelease(props.release);
});

/** MusicBrainz release MBID for artwork lookup. */
const releaseMbid = computed(() => {
  return props.release.id ?? props.release.musicbrainzReleaseId ?? null;
});

/** MusicBrainz release-group MBID for artwork fallback. */
const releaseGroupMbid = computed(() => {
  return props.release.releaseGroup?.id ?? props.release.releaseGroupId ?? null;
});

/** Artist name derived from the release object. */
const artistName = computed(() => getReleaseArtistName(props.release));

/** Release title. */
const releaseTitle = computed(() => getReleaseTitle(props.release));

/** Year extracted from the release date. */
const year = computed(() => getReleaseYear(props.release));

/** Readable metadata line built from available release fields. */
const meta = computed(() => {
  const parts = [];
  if (artistName.value) parts.push(artistName.value);
  if (year.value) parts.push(year.value);
  const type = props.release.releaseGroup?.primaryType ?? null;
  if (type) parts.push(type);
  if (props.release.status) parts.push(props.release.status);
  return parts.join(' · ');
});

function handleRequest() {
  emit('request', props.release);
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
    <div class="hx-media-card__artwork">
      <ArtworkImage
        ref="artworkImageComp"
        :mbid="releaseMbid || releaseGroupMbid || undefined"
        :mbid-type="releaseMbid ? 'release' : 'release-group'"
        :alt="releaseTitle || 'Release artwork'"
      />
    </div>
    <div class="hx-media-card__body">
      <p class="hx-media-card__title">{{ releaseTitle || '—' }}</p>
      <p v-if="meta" class="hx-media-card__meta">{{ meta }}</p>
    </div>
    <div class="hx-media-card__actions">
      <slot name="actions">
        <RequestButton
          :requested="requested"
          :loading="requesting"
          :disabled="disabled"
          :unavailable="!isRequestable"
          :aria-label="requested
            ? `${releaseTitle ?? 'This release'} — already requested`
            : `Request ${releaseTitle ?? 'this release'}`"
          @request="handleRequest"
        />
      </slot>
    </div>
  </article>
</template>

<style scoped>
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
