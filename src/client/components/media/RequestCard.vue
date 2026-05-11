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

/**
 * Format an ISO date string into a locale-appropriate short date.
 * Returns null for missing or unparseable values.
 */
function formatDate(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return null;
  }
}

/** Human-readable requested date. */
const requestedDate = computed(() => formatDate(props.request.createdAt));

/** Human-readable last updated date, shown only if meaningfully different. */
const updatedDate = computed(() => {
  const updated = formatDate(props.request.updatedAt);
  const requested = formatDate(props.request.createdAt);
  // Only show if updated differs from created — avoids redundant information.
  return updated && updated !== requested ? updated : null;
});

/** Optional request kind label (release / track / external URL). */
const kindLabel = computed(() => {
  const k = props.request.requestKind;
  if (k === 'external_url') return 'External URL';
  if (k === 'track') return 'Track';
  if (k === 'release') return 'Release';
  return null;
});

/**
 * Attribution line for delegated requests — shown when the submitter and the
 * beneficiary differ and `viewerUserId` is provided.
 *
 * Returns null when no attribution should be displayed.
 *
 * Cases:
 * - Viewer is the beneficiary: "Requested by [submitter]" (admin requested for me)
 * - Viewer is the submitter:   "For [beneficiary]" (I requested on behalf of someone)
 * - Neither (operator view):   "By [submitter] · For [beneficiary]"
 */
const attributionLine = computed(() => {
  if (!props.viewerUserId) return null;

  const by = props.request.requestedByUser;
  const forUser = props.request.requestedForUser;

  if (!by?.id || !forUser?.id) return null;
  if (by.id === forUser.id) return null;

  const byName = by.username ?? 'Unknown';
  const forName = forUser.username ?? 'Unknown';

  if (props.viewerUserId === forUser.id) {
    return `Requested by ${byName}`;
  }

  if (props.viewerUserId === by.id) {
    return `For ${forName}`;
  }

  return `By ${byName} · For ${forName}`;
});

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
  <article class="hx-media-card request-card" :data-variant="variant || undefined" :style="accentStyle">
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
</template>

<style scoped>
.request-card {
  display: grid;
  border: 1px solid color-mix(
    in oklch,
    oklch(0.72 var(--card-accent-c, 0) var(--card-accent-h, 0)) 40%,
    transparent
  );
  transition: border-color 0.2s ease;
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

/* Screen-reader-only utility (matches Tailwind's sr-only if present). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
