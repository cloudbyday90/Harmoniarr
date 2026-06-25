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
import RequestStatusPill from './RequestStatusPill.vue';
import { useArtworkColor } from '../../composables/useArtworkColor.js';
import { getComingSoonLabel, isComingSoon } from '../../lib/request-status.js';
import {
  formatRequestDate,
  getRequestAttributionLine,
  getRequestKindLabel,
} from '../../lib/my-requests-presentation.js';

/**
 * RequestCard — presentational artwork-first request tracking card.
 *
 * Displays a submitted media request as a requester-friendly card with
 * artwork, title, artist, status, and requested date. Shows safe fallback
 * text when optional fields are missing.
 *
 * Does not call APIs, poll, cancel, retry, or delete requests.
 */

const props = defineProps({
  /**
   * Media request object returned from the API.
   * Expected shape: { id, requestState, releaseTitle, artistName, requestKind,
   *   createdAt, updatedAt, existingMatch, matchedMetadataReleaseId,
   *   matchedMetadataReleaseGroupId, requestedByUser, requestedForUser }
   */
  request: {
    type: Object,
    required: true,
  },
  /** Optional visual variant forwarded to the card element. */
  variant: {
    type: String,
    default: null,
  },
  /**
   * The ID of the user currently viewing this card. When provided, the card
   * derives and displays an attribution line for delegated requests (where
   * the submitter and the beneficiary differ). Omitting this prop suppresses
   * attribution entirely for backward compatibility.
   */
  viewerUserId: {
    type: String,
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

/** Displayed release title with safe fallback. */
const releaseTitle = computed(() => {
  return props.request.releaseTitle
    || props.request.existingMatch?.releaseTitle
    || props.request.existingMatch?.releaseGroupTitle
    || props.request.trackTitle
    || 'Untitled release';
});

/** Displayed artist name with safe fallback. */
const artistName = computed(() => {
  return props.request.artistName
    || props.request.existingMatch?.artistName
    || 'Unknown artist';
});

/**
 * MusicBrainz release MBID for artwork lookup.
 * Prefer the matched release ID, fall back to the release-group level.
 */
const releaseMbid = computed(() => {
  return props.request.existingMatch?.releaseId
    || props.request.matchedMetadataReleaseId
    || null;
});

/** MusicBrainz release-group MBID for artwork fallback. */
const releaseGroupMbid = computed(() => {
  return props.request.existingMatch?.releaseGroupId
    || props.request.matchedMetadataReleaseGroupId
    || null;
});

/** Resolved MBID: prefer release-level, then release-group. */
const artworkMbid = computed(() => releaseMbid.value || releaseGroupMbid.value || undefined);

/** Entity type for ArtworkImage. */
const artworkMbidType = computed(() => (releaseMbid.value ? 'release' : 'release-group'));

/** Human-readable requested date. */
const requestedDate = computed(() => formatRequestDate(props.request.createdAt));

/** Human-readable last updated date, shown only if meaningfully different. */
const updatedDate = computed(() => {
  const updated = formatRequestDate(props.request.updatedAt);
  const requested = formatRequestDate(props.request.createdAt);
  return updated && updated !== requested ? updated : null;
});

/** Optional request kind label (release / track / external URL). */
const kindLabel = computed(() => getRequestKindLabel(props.request.requestKind));

/** Attribution line for delegated requests. */
const attributionLine = computed(() =>
  getRequestAttributionLine(props.request, props.viewerUserId),
);

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

/** True when this is a pre-request for an upcoming album. */
const comingSoon = computed(() => isComingSoon(props.request));
/** Human-readable "Coming soon" label for upcoming pre-requests. */
const comingSoonLabel = computed(() => getComingSoonLabel(props.request));
</script>

<template>
  <router-link
    :to="{ name: 'request-detail', params: { id: request.id } }"
    custom
    v-slot="{ navigate, href }"
  >
    <article
      class="hx-media-card request-card"
      :data-variant="variant || undefined"
      :style="accentStyle"
      role="link"
      tabindex="0"
      :aria-label="`${releaseTitle} by ${artistName}`"
      @click="navigate"
      @keydown.enter="navigate"
      @keydown.space.prevent="navigate"
    >
      <a :href="href" class="request-card__sr-link" tabindex="-1" aria-hidden="true"></a>
      <div class="hx-media-card__artwork">
        <ArtworkImage
          ref="artworkImageComp"
          :mbid="artworkMbid"
          :mbid-type="artworkMbidType"
          :alt="releaseTitle"
        />
      </div>

      <div class="hx-media-card__body">
        <p class="hx-media-card__title">{{ releaseTitle }}</p>
        <p class="hx-media-card__meta">{{ artistName }}</p>
        <p v-if="kindLabel" class="hx-media-card__meta request-card__kind">{{ kindLabel }}</p>
        <p v-if="attributionLine" class="hx-media-card__meta request-card__attribution">{{ attributionLine }}</p>
      </div>

      <div class="hx-media-card__actions request-card__status-row">
        <span v-if="comingSoon" class="hx-pill request-card__coming-soon-pill" data-tone="upcoming" :title="request.expectedReleaseDate">{{ comingSoonLabel }}</span>
        <RequestStatusPill :status="request.requestState" />

        <dl class="request-card__dates" aria-label="Request dates">
          <template v-if="requestedDate">
            <dt class="sr-only">Requested</dt>
            <dd class="request-card__date">Requested {{ requestedDate }}</dd>
          </template>
          <template v-if="updatedDate">
            <dt class="sr-only">Updated</dt>
            <dd class="request-card__date request-card__date--updated">Updated {{ updatedDate }}</dd>
          </template>
        </dl>
      </div>
    </article>
  </router-link>
</template>

<style scoped>
.request-card {
  display: grid;
  cursor: pointer;
  border: 1px solid color-mix(
    in oklch,
    oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0)) 40%,
    transparent
  );
  transition: border-color 0.2s ease;
}

.request-card:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

:global([data-theme="light"]) .request-card {
  border-color: color-mix(
    in oklch,
    oklch(0.38 var(--card-accent-c, 0) var(--card-accent-h, 0)) 50%,
    transparent
  );
}

.request-card:hover {
  border-color: oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0) / 0.85);
  grid-template-rows: auto 1fr auto;
}

.request-card__status-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--hx-space-1, 0.25rem);
}

.request-card__dates {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.request-card__date {
  margin: 0;
  font-size: var(--hx-text-xs, 0.75rem);
  color: var(--hx-text-faint, #666);
  line-height: 1.4;
}

.request-card__date--updated {
  color: var(--hx-text-muted, #888);
}

.request-card__kind {
  font-size: var(--hx-text-xs, 0.75rem);
  color: var(--hx-text-faint, #666);
}

.request-card__attribution {
  font-size: var(--hx-text-xs, 0.75rem);
  color: var(--hx-text-muted, #888);
  font-style: italic;
}

.request-card__sr-link {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

</style>
