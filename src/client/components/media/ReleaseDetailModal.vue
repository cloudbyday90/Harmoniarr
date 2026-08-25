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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import ArtworkImage from '../ArtworkImage.vue';
import { useReleaseDetail } from '../../composables/useReleaseDetail.js';
import { useReleaseRequest } from '../../composables/useReleaseRequest.js';
import { useActiveUsers } from '../../composables/useActiveUsers.js';
import { sessionStore } from '../../state/session.js';
import { containDialogTabFocus } from '../../lib/dialog-focus-trap.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import {
  computeMediaTotalMs,
  formatAlbumRuntime,
  formatTrackDuration,
} from '../../lib/track-duration.js';
import {
  canBuildDraftTrackOverride,
  getDraftReleaseGroupTrackOverrides,
  getDraftReleaseGroupTrackOverrideReviewSummary,
  getDraftTrackOverride,
  getDraftTrackOverrideState,
} from '../../lib/operator-artist-detail-draft.js';
import {
  buildTrackOverrideRemapReviewSummaryText,
  getTrackOverrideRemapReviewPresentation,
  getTrackOverrideRemapReviewSummaryTone,
  isTrackOverrideRemapReviewStatus,
} from '../../lib/operator-track-override-remap-review.js';

/**
 * ReleaseDetailModal — full release detail modal with tracklist, edition
 * switcher, ownership callout, and request action.
 *
 * Props marked with (instant) are shown immediately from parent context while
 * the API call loads in the background.
 */
const props = defineProps({
  /** MusicBrainz release group MBID (required). */
  releaseGroupMbid: {
    type: String,
    required: true,
  },
  /** Local UUID hint used to pre-select an edition. */
  releaseGroupId: {
    type: String,
    default: null,
  },
  /** Release title for instant hero render (shown before API responds). */
  releaseTitle: {
    type: String,
    default: null,
  },
  /** Artist name for instant hero render. */
  artistName: {
    type: String,
    default: null,
  },
  /** Release year for instant hero render. */
  releaseYear: {
    type: String,
    default: null,
  },
  /** Artwork URL for instant hero render. */
  artworkUrl: {
    type: String,
    default: null,
  },
  /** Pre-select a specific edition by release MBID. */
  preferReleaseMbid: {
    type: String,
    default: null,
  },
  /** Whether the modal is open. */
  open: {
    type: Boolean,
    default: false,
  },
  /** Artist policy draft used for operator track override editing. */
  operatorDraft: {
    type: Object,
    default: null,
  },
  /** Whether track override controls should be shown. */
  operatorEditingEnabled: {
    type: Boolean,
    default: false,
  },
  /** Whether track override controls are visible but disabled. */
  operatorEditingDisabled: {
    type: Boolean,
    default: false,
  },
  /** Local release-group projection backing the active artist policy draft. */
  operatorReleaseGroup: {
    type: Object,
    default: null,
  },
  /** Whether the operator can persist the edition shown in this dialog. */
  operatorEditionSelectionEnabled: {
    type: Boolean,
    default: false,
  },
  /** Explains why the edition-selection action is currently unavailable. */
  operatorEditionSelectionDisabledReason: {
    type: String,
    default: '',
  },
  /** Parent-owned error for the edition-selection command. */
  operatorEditionSelectionError: {
    type: String,
    default: '',
  },
  /** Whether the operator edition-selection command is in flight. */
  operatorEditionSelectionSaving: {
    type: Boolean,
    default: false,
  },
  /** Local release ID explicitly selected by this operator, when present. */
  operatorSelectedReleaseId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits([
  'close',
  'manual-edition-selection',
  'requested',
  'track-override-change',
  'track-override-repair',
]);

const dialogRef = ref(null);
const closeButtonRef = ref(null);
const requestButtonRef = ref(null);
const editionMenuOpen = ref(false);
const requestError = ref(null);
const selectedForUserId = ref(null);
let previouslyFocusedElement = null;

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: activeUsers } = useActiveUsers({ enabled: isAdmin.value });

const {
  release,
  media,
  ownership,
  allReleases,
  requestState,
  source,
  loading,
  error,
  canonicalError,
  isSavingCanonical,
  load,
  switchEdition,
  setDefaultEdition,
} = useReleaseDetail();

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

// ── Computed ─────────────────────────────────────────────────────────────────

const displayTitle = computed(() => release.value?.title ?? props.releaseTitle ?? '');
const displayArtist = computed(() => props.artistName ?? '');
const displayYear = computed(() => {
  const d = release.value?.releaseDate ?? null;
  if (d) return d.slice(0, 4);
  return props.releaseYear ?? null;
});

const artworkMbid = computed(() => {
  const mbid = release.value?.musicbrainzReleaseId;
  if (mbid) return mbid;
  return props.preferReleaseMbid ?? props.releaseGroupMbid;
});

const artworkMbidType = computed(() => {
  return release.value?.musicbrainzReleaseId ? 'release' : 'release-group';
});

const totalRuntime = computed(() => formatAlbumRuntime(computeMediaTotalMs(media.value)));

const hasMultipleEditions = computed(() => allReleases.value.length > 1);
const editionInputName = computed(() => `rdm-edition-${props.releaseGroupMbid}`);

const showOwnershipCallout = computed(() => {
  const o = ownership.value;
  return o !== null && o.matchedTrackCount > 0 && o.matchedTrackCount < o.expectedTrackCount;
});

const currentRelease = computed(() => release.value);
const isCurrentEditionManuallySelected = computed(() =>
  props.operatorReleaseGroup?.operatorState?.selectionSource === 'manual'
  && props.operatorReleaseGroup?.operatorState?.selectionState === 'selected'
  && props.operatorSelectedReleaseId === currentRelease.value?.id,
);
const canSaveCurrentEdition = computed(() =>
  props.operatorEditionSelectionEnabled
  && Boolean(currentRelease.value?.id)
  && !props.operatorEditionSelectionSaving
  && !isCurrentEditionManuallySelected.value,
);
const currentEditionFacts = computed(() => {
  if (!currentRelease.value) return [];

  return [
    { label: 'Country', value: currentRelease.value.country ?? 'Not specified' },
    { label: 'Release date', value: currentRelease.value.releaseDate ?? 'Not specified' },
    { label: 'Tracks', value: currentRelease.value.trackCount ? String(currentRelease.value.trackCount) : 'Not specified' },
    { label: 'Media', value: currentRelease.value.mediumCount ? String(currentRelease.value.mediumCount) : 'Not specified' },
    { label: 'Status', value: currentRelease.value.status ?? 'Not specified' },
    { label: 'Global default', value: currentRelease.value.isCanonical ? 'Yes' : 'No' },
  ];
});

const releaseForRequest = computed(() => {
  if (!release.value) return null;
  return {
    id: release.value.musicbrainzReleaseId ?? release.value.id,
    musicbrainzReleaseId: release.value.musicbrainzReleaseId ?? null,
    releaseGroupId: props.releaseGroupMbid,
    title: release.value.title,
    artistCredit: displayArtist.value,
  };
});

const isCurrentlyRequesting = computed(() =>
  releaseForRequest.value ? isRequesting(releaseForRequest.value) : false,
);

const isCurrentlyRequested = computed(() =>
  requestState.value?.status === 'needs_fetch' ||
  requestState.value?.status === 'already_exists' ||
  (releaseForRequest.value ? isRequested(releaseForRequest.value) : false),
);

const musicBrainzReleaseUrl = computed(() => {
  const mbid = release.value?.musicbrainzReleaseId;
  if (!mbid) return null;
  return `https://musicbrainz.org/release/${mbid}`;
});

const canEditTrackOverrides = computed(() =>
  props.operatorEditingEnabled
    && props.operatorDraft
    && props.operatorReleaseGroup?.id,
);

const showTrackOverrideControls = computed(() =>
  canEditTrackOverrides.value && media.value.some((medium) =>
    (medium.tracks ?? []).some((track) => canBuildTrackOverride(medium, track)),
  ),
);

const trackOverrideReviewSummary = computed(() =>
  getDraftReleaseGroupTrackOverrideReviewSummary(
    props.operatorDraft,
    props.operatorReleaseGroup,
  ),
);

const showTrackOverrideReviewNote = computed(() =>
  canEditTrackOverrides.value && trackOverrideReviewSummary.value.hasReview,
);

const trackOverrideReviewSummaryText = computed(() =>
  buildTrackOverrideRemapReviewSummaryText(trackOverrideReviewSummary.value),
);

const trackOverrideReviewSummaryTone = computed(() =>
  getTrackOverrideRemapReviewSummaryTone(trackOverrideReviewSummary.value),
);

const visibleReviewTrackOverrides = computed(() => {
  const overrides = [];

  for (const medium of media.value) {
    for (const track of medium.tracks ?? []) {
      const override = getTrackOverrideForTrack(medium, track);
      if (override && isTrackOverrideRemapReviewStatus(override.remapStatus) && !overrides.includes(override)) {
        overrides.push(override);
      }
    }
  }

  return overrides;
});

const unresolvedReviewTrackOverrides = computed(() =>
  getDraftReleaseGroupTrackOverrides(props.operatorDraft, props.operatorReleaseGroup)
    .filter((override) => isTrackOverrideRemapReviewStatus(override.remapStatus)),
);

const unmatchedReviewTrackOverrides = computed(() =>
  unresolvedReviewTrackOverrides.value
    .filter((override) => !visibleReviewTrackOverrides.value.includes(override)),
);

watch(showTrackOverrideReviewNote, async (hasReview, hadReview) => {
  if (!hadReview || hasReview || !dialogRef.value?.open) {
    return;
  }

  await nextTick();
  globalThis.setTimeout(() => {
    closeButtonRef.value?.focus({ preventScroll: true });
  }, 0);
});

// ── Modal lifecycle ───────────────────────────────────────────────────────────

function openDialogSession() {
  if (!dialogRef.value) return;
  previouslyFocusedElement = globalThis.document?.activeElement instanceof HTMLElement
    ? globalThis.document.activeElement
    : null;
  if (!dialogRef.value.open) dialogRef.value.showModal();
  closeButtonRef.value?.focus({ preventScroll: true });
  selectedForUserId.value = null;
  requestError.value = null;
  editionMenuOpen.value = false;
  load(props.releaseGroupMbid, { preferReleaseMbid: props.preferReleaseMbid });
}

function closeDialogSession() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
  if (previouslyFocusedElement?.isConnected) {
    previouslyFocusedElement.focus({ preventScroll: true });
  }
  previouslyFocusedElement = null;
}

onMounted(() => {
  if (props.open) {
    openDialogSession();
  }
});

watch(
  () => props.open,
  (isOpen) => {
    if (!dialogRef.value) return;
    if (isOpen) {
      openDialogSession();
    } else {
      closeDialogSession();
    }
  },
);

// ── Event handlers ────────────────────────────────────────────────────────────

function handleCancel(event) {
  event.preventDefault();
  if (!isCurrentlyRequesting.value) {
    closeDialogSession();
    emit('close');
  }
}

function handleBackdropClick(event) {
  if (isCurrentlyRequesting.value) return;
  if (event.target === dialogRef.value) {
    closeDialogSession();
    emit('close');
  }
}

function handleClose() {
  if (!isCurrentlyRequesting.value) {
    closeDialogSession();
    emit('close');
  }
}

function handleKeydown(event) {
  containDialogTabFocus(event, dialogRef.value);
}

async function handleRequest() {
  if (!releaseForRequest.value) return;
  requestError.value = null;
  const result = await requestRelease(releaseForRequest.value, {
    requestedForUserId: selectedForUserId.value ?? null,
  });
  if (result.ok) {
    closeDialogSession();
    emit('requested', { releaseGroupMbid: props.releaseGroupMbid });
  } else if (!result.skipped) {
    requestError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
    await nextTick();
    requestButtonRef.value?.focus({ preventScroll: true });
  }
}

async function handleSwitchEdition(releaseRow) {
  editionMenuOpen.value = false;
  await switchEdition(props.releaseGroupMbid, releaseRow.id);
}

async function handleSetDefaultEdition(releaseRow) {
  editionMenuOpen.value = false;
  if (!releaseRow?.id) return;
  await setDefaultEdition(props.releaseGroupMbid, releaseRow.id);
}

function buildTrackOverrideContext(medium) {
  return {
    mediumPosition: medium?.position ?? null,
    metadataReleaseId: currentRelease.value?.id ?? null,
  };
}

function canBuildTrackOverride(medium, track) {
  return canBuildDraftTrackOverride(
    props.operatorReleaseGroup,
    track,
    buildTrackOverrideContext(medium),
  );
}

function getTrackOverrideState(medium, track) {
  return getDraftTrackOverrideState(
    props.operatorDraft,
    props.operatorReleaseGroup,
    track,
    buildTrackOverrideContext(medium),
  );
}

function getTrackOverrideForTrack(medium, track) {
  return getDraftTrackOverride(
    props.operatorDraft,
    props.operatorReleaseGroup,
    track,
    buildTrackOverrideContext(medium),
  );
}

function getTrackOverrideReviewPresentationForTrack(medium, track) {
  const override = getTrackOverrideForTrack(medium, track);

  return getTrackOverrideRemapReviewPresentation(override?.remapStatus);
}

function getTrackOverrideReviewPresentationForOverride(trackOverride) {
  return getTrackOverrideRemapReviewPresentation(trackOverride?.remapStatus);
}

function getTrackOverrideRepairTitle(trackOverride) {
  return trackOverride?.trackTitleSnapshot ?? 'Saved track override';
}

function getTrackOverrideLabel(track) {
  return `Desired state for ${track?.title ?? 'track'}`;
}

function buildEditionButtonLabel(edition) {
  const parts = ['Preview edition'];
  if (edition?.country) parts.push(edition.country);
  if (edition?.releaseDate) parts.push(edition.releaseDate.slice(0, 4));
  if (edition?.trackCount) parts.push(`${edition.trackCount} tracks`);
  return parts.join(', ');
}

function handleManualEditionSelection() {
  if (!canSaveCurrentEdition.value) return;
  emit('manual-edition-selection', { release: currentRelease.value });
}

function handleTrackOverrideChange(medium, track, event) {
  emit('track-override-change', {
    medium,
    overrideState: event.target.value,
    release: currentRelease.value,
    releaseGroup: props.operatorReleaseGroup,
    track,
  });
}

function handleTrackOverrideRepair(action, trackOverride) {
  if (!trackOverride || props.operatorEditingDisabled) {
    return;
  }

  emit('track-override-repair', {
    action,
    releaseGroup: props.operatorReleaseGroup,
    trackOverride,
  });
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="rdm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rdm-heading"
    tabindex="-1"
    @cancel="handleCancel"
    @click="handleBackdropClick"
    @keydown="handleKeydown"
  >
    <div class="rdm-shell">
      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <header class="rdm-header">
        <h2 id="rdm-heading" class="sr-only">Release detail</h2>
        <button
          ref="closeButtonRef"
          type="button"
          class="rdm-close hx-btn"
          data-variant="ghost"
          :disabled="isCurrentlyRequesting"
          aria-label="Close"
          @click="handleClose"
        >✕</button>
      </header>

      <div class="rdm-body">
        <!-- ── Hero row ──────────────────────────────────────────────── -->
        <div class="rdm-hero">
          <div class="rdm-artwork">
            <ArtworkImage
              :mbid="artworkMbid"
              :mbid-type="artworkMbidType"
              :local-src="artworkUrl || undefined"
              :alt="displayTitle || 'Release artwork'"
            />
          </div>
          <div class="rdm-hero-info">
            <p class="rdm-release-title">{{ displayTitle || '—' }}</p>
            <p v-if="displayArtist" class="rdm-artist-name">{{ displayArtist }}</p>
            <p class="rdm-meta-line">
              <span v-if="displayYear">{{ displayYear }}</span>
              <span v-if="currentRelease?.status" class="rdm-meta-sep"> · </span>
              <span v-if="currentRelease?.status">{{ currentRelease.status }}</span>
              <span v-if="currentRelease?.trackCount" class="rdm-meta-sep"> · </span>
              <span v-if="currentRelease?.trackCount">{{ currentRelease.trackCount }} tracks</span>
              <span v-if="totalRuntime" class="rdm-meta-sep"> · </span>
              <span v-if="totalRuntime">{{ totalRuntime }}</span>
            </p>
          </div>
        </div>

        <!-- ── Loading ───────────────────────────────────────────────── -->
        <p v-if="loading" class="rdm-loading" aria-live="polite" aria-busy="true">Loading…</p>

        <!-- ── Error ─────────────────────────────────────────────────── -->
        <p v-else-if="error" class="rdm-error" role="alert">{{ error }}</p>

        <template v-else>
          <!-- ── Ownership callout ───────────────────────────────────── -->
          <div v-if="showOwnershipCallout" class="rdm-ownership-callout" role="note">
            <span class="hx-pill" data-tone="warning">Partial</span>
            {{ ownership.matchedTrackCount }} of {{ ownership.expectedTrackCount }} tracks in library
          </div>

          <!-- ── Action row ──────────────────────────────────────────── -->
          <div class="rdm-action-row">
            <button
              v-if="!isCurrentlyRequested"
              ref="requestButtonRef"
              type="button"
              class="hx-btn"
              data-variant="primary"
              :disabled="isCurrentlyRequesting || !releaseForRequest"
              :aria-busy="isCurrentlyRequesting || undefined"
              @click="handleRequest"
            >
              {{ isCurrentlyRequesting ? 'Requesting…' : 'Request' }}
            </button>
            <span v-else class="hx-pill" data-tone="success">Requested</span>

            <div v-if="isAdmin && activeUsers.length >= 2" class="rdm-for-user">
              <label class="rdm-for-user__label" for="rdm-for-user-select">For</label>
              <select
                id="rdm-for-user-select"
                v-model="selectedForUserId"
                class="rdm-for-user__select"
                :disabled="isCurrentlyRequesting"
              >
                <option :value="null">Myself</option>
                <option v-for="u in activeUsers" :key="u.id" :value="u.id">{{ u.username }}</option>
              </select>
            </div>
          </div>

          <p v-if="requestError" class="rdm-error" role="alert">{{ requestError }}</p>

          <!-- ── Edition switcher ────────────────────────────────────── -->
          <div v-if="hasMultipleEditions" class="rdm-editions">
            <fieldset class="rdm-edition-picker">
              <legend class="rdm-edition-picker__legend">Preview an edition</legend>
              <div class="rdm-edition-options">
                <label
                  v-for="ed in allReleases.slice(0, 6)"
                  :key="ed.musicbrainzReleaseId ?? ed.id"
                  class="rdm-edition-option"
                  :class="{ 'is-active': ed.id === currentRelease?.id }"
                >
                  <input
                    type="radio"
                    :name="editionInputName"
                    :value="ed.id"
                    :checked="ed.id === currentRelease?.id"
                    :aria-label="buildEditionButtonLabel(ed)"
                    @change="handleSwitchEdition(ed)"
                  >
                  <span>{{ ed.country ?? 'Country not specified' }}</span>
                  <span v-if="ed.releaseDate"> · {{ ed.releaseDate.slice(0, 4) }}</span>
                  <span v-if="ed.trackCount"> · {{ ed.trackCount }} tracks</span>
                </label>
              </div>
            </fieldset>

            <!-- Global metadata default; separate from the operator's choice below. -->
            <div v-if="isAdmin && currentRelease?.id" class="rdm-edition-overflow">
              <button
                type="button"
                class="hx-btn"
                data-variant="ghost"
                aria-label="Edition actions"
                :aria-expanded="editionMenuOpen"
                @click="editionMenuOpen = !editionMenuOpen"
              >···</button>
              <ul v-if="editionMenuOpen" class="rdm-edition-menu">
                <li>
                  <button
                    type="button"
                    class="rdm-edition-menu__item"
                    :disabled="isSavingCanonical || currentRelease?.isCanonical"
                    @click="handleSetDefaultEdition(currentRelease)"
                  >
                    {{ isSavingCanonical ? 'Saving…' : 'Set as Default Edition' }}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <section
            v-if="operatorEditingEnabled && currentRelease"
            class="rdm-operator-edition"
            aria-labelledby="rdm-operator-edition-heading"
          >
            <div class="rdm-operator-edition__heading">
              <div>
                <h3 id="rdm-operator-edition-heading">Edition for this artist</h3>
                <p>Review the previewed edition, then save it for this artist. This does not change the default edition or start a download.</p>
              </div>
              <span v-if="isCurrentEditionManuallySelected" class="hx-pill" data-tone="info">
                Your selected edition
              </span>
            </div>

            <dl class="rdm-edition-facts">
              <div v-for="fact in currentEditionFacts" :key="fact.label">
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>

            <p v-if="operatorEditionSelectionDisabledReason" class="rdm-operator-edition__help" role="note">
              {{ operatorEditionSelectionDisabledReason }}
            </p>

            <button
              type="button"
              class="hx-btn"
              data-variant="primary"
              :disabled="!canSaveCurrentEdition"
              :aria-busy="operatorEditionSelectionSaving || undefined"
              @click="handleManualEditionSelection"
            >
              {{ operatorEditionSelectionSaving ? 'Saving edition…' : (isCurrentEditionManuallySelected ? 'Edition selected' : 'Save this edition') }}
            </button>

            <p v-if="operatorEditionSelectionError" class="rdm-error" role="alert">
              {{ operatorEditionSelectionError }}
            </p>
          </section>

          <p v-if="canonicalError" class="rdm-error" role="alert">{{ canonicalError }}</p>

          <div v-if="showTrackOverrideControls" class="rdm-operator-note" role="note">
            <span class="hx-pill" data-tone="info">Draft</span>
            Track overrides are saved with Artist Policy.
          </div>

          <div
            v-if="showTrackOverrideReviewNote"
            class="rdm-operator-note rdm-operator-note--review"
            role="note"
          >
            <span class="hx-pill" :data-tone="trackOverrideReviewSummaryTone">
              Track review
            </span>
            <span>{{ trackOverrideReviewSummaryText }} before saving Artist Policy.</span>
          </div>

          <div
            v-if="unmatchedReviewTrackOverrides.length > 0"
            class="rdm-remap-repair"
            aria-label="Saved track override repair"
          >
            <h3 class="rdm-remap-repair__title">Saved overrides not in this edition</h3>
            <p class="rdm-remap-repair__copy">
              Clear stale overrides here, then save Artist Policy to persist the change.
            </p>
            <ul class="rdm-remap-repair__list">
              <li
                v-for="trackOverride in unmatchedReviewTrackOverrides"
                :key="`${trackOverride.metadataReleaseGroupId}:${trackOverride.trackMbid ?? trackOverride.recordingMbid}:${trackOverride.trackPosition}`"
                class="rdm-remap-repair__item"
              >
                <span class="rdm-remap-repair__item-main">
                  <strong>{{ getTrackOverrideRepairTitle(trackOverride) }}</strong>
                  <span
                    class="hx-pill"
                    :data-tone="getTrackOverrideReviewPresentationForOverride(trackOverride)?.tone"
                  >
                    {{ getTrackOverrideReviewPresentationForOverride(trackOverride)?.label }}
                  </span>
                </span>
                <button
                  type="button"
                  class="hx-btn"
                  data-variant="ghost"
                  :disabled="operatorEditingDisabled"
                  :aria-label="`Clear override for ${getTrackOverrideRepairTitle(trackOverride)}`"
                  @mousedown.prevent
                  @click="handleTrackOverrideRepair('clear', trackOverride)"
                >
                  Clear override
                </button>
              </li>
            </ul>
          </div>

          <!-- ── Tracklist ───────────────────────────────────────────── -->
          <div v-if="media.length > 0" class="rdm-tracklist">
            <div
              v-for="medium in media"
              :key="medium.position"
              class="rdm-disc"
            >
              <p v-if="media.length > 1" class="rdm-disc-heading">
                {{ medium.format ?? 'Disc' }} {{ medium.position }}
                <span v-if="medium.title"> — {{ medium.title }}</span>
              </p>
              <ol class="rdm-track-list" :aria-label="`Disc ${medium.position} tracklist`">
                <li
                  v-for="track in medium.tracks"
                  :key="track.position"
                  class="rdm-track"
                  :class="{ 'has-track-override-controls': canEditTrackOverrides, 'is-owned': track.isOwned }"
                  >
                  <span class="rdm-track-owned" aria-label="In library">
                    {{ track.isOwned ? '●' : '○' }}
                  </span>
                  <span class="rdm-track-num">{{ track.numberText ?? track.position }}</span>
                  <span class="rdm-track-title">{{ track.title }}</span>
                  <span class="rdm-track-duration">{{ formatTrackDuration(track.lengthMs) ?? '' }}</span>
                  <select
                    v-if="canEditTrackOverrides"
                    class="hx-select rdm-track-override-select"
                    :value="getTrackOverrideState(medium, track)"
                    :disabled="operatorEditingDisabled || !canBuildTrackOverride(medium, track)"
                    :aria-label="getTrackOverrideLabel(track)"
                    @change="handleTrackOverrideChange(medium, track, $event)"
                  >
                    <option value="policy">Policy default</option>
                    <option value="desired">Desired</option>
                    <option value="suppressed">Suppressed</option>
                  </select>
                  <span
                    v-if="getTrackOverrideReviewPresentationForTrack(medium, track)"
                    class="rdm-track-review"
                  >
                    <span
                      class="hx-pill"
                      :data-tone="getTrackOverrideReviewPresentationForTrack(medium, track).tone"
                    >
                      {{ getTrackOverrideReviewPresentationForTrack(medium, track).label }}
                    </span>
                    <span class="rdm-track-review__copy">
                      {{ getTrackOverrideReviewPresentationForTrack(medium, track).description }}
                    </span>
                    <span class="rdm-track-review__actions">
                      <button
                        type="button"
                        class="hx-btn"
                        data-variant="ghost"
                        :disabled="operatorEditingDisabled"
                        :aria-label="`Keep this track for ${track.title ?? 'track override'}`"
                        @mousedown.prevent
                        @click="handleTrackOverrideRepair('resolve', getTrackOverrideForTrack(medium, track))"
                      >
                        Keep this track
                      </button>
                      <button
                        type="button"
                        class="hx-btn"
                        data-variant="ghost"
                        :disabled="operatorEditingDisabled"
                        :aria-label="`Clear override for ${track.title ?? 'track'}`"
                        @mousedown.prevent
                        @click="handleTrackOverrideRepair('clear', getTrackOverrideForTrack(medium, track))"
                      >
                        Clear override
                      </button>
                    </span>
                  </span>
                </li>
              </ol>
            </div>
          </div>

          <!-- ── Source note ─────────────────────────────────────────── -->
          <p v-if="source === 'musicbrainz'" class="rdm-source-note">
            Tracklist from MusicBrainz — not yet in local library.
          </p>

          <!-- ── Footer ─────────────────────────────────────────────── -->
          <div v-if="musicBrainzReleaseUrl" class="rdm-footer-links">
            <a
              :href="musicBrainzReleaseUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="hx-btn"
              data-variant="ghost"
            >Open in MusicBrainz ↗</a>
          </div>
        </template>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.rdm-dialog {
  border: none;
  border-radius: var(--hx-radius-lg);
  background: var(--hx-bg-surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.32);
  padding: 0;
  width: min(640px, 96vw);
  max-height: 90vh;
  overflow: hidden;
  color: var(--hx-text);
}

.rdm-dialog::backdrop {
  background: var(--hx-bg-overlay);
  backdrop-filter: blur(2px);
}

.rdm-shell {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.rdm-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: var(--hx-space-3) var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border-subtle);
  flex-shrink: 0;
}

.rdm-body {
  overflow-y: auto;
  padding: var(--hx-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-4);
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

.rdm-hero {
  display: flex;
  gap: var(--hx-space-4);
  align-items: flex-start;
}

.rdm-artwork {
  width: 6rem;
  height: 6rem;
  flex-shrink: 0;
  border-radius: var(--hx-radius-md);
  overflow: hidden;
  background: var(--hx-bg-muted);
}

.rdm-hero-info {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-1);
  min-width: 0;
}

.rdm-release-title {
  margin: 0;
  font-size: var(--hx-text-lg);
  font-weight: 700;
  color: var(--hx-text-strong);
  line-height: 1.2;
}

.rdm-artist-name {
  margin: 0;
  font-size: var(--hx-text-base);
  color: var(--hx-text);
}

.rdm-meta-line {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
}

.rdm-meta-sep {
  color: var(--hx-text-subtle);
}

/* ── Ownership callout ─────────────────────────────────────────────────── */

.rdm-ownership-callout {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  padding: var(--hx-space-2) var(--hx-space-3);
  background: var(--hx-bg-muted);
  border-radius: var(--hx-radius-md);
}

.rdm-operator-note {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  padding: var(--hx-space-2) var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-muted);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.rdm-operator-note--review {
  border-color: color-mix(in srgb, var(--hx-warning) 32%, var(--hx-border-subtle));
}

.rdm-remap-repair {
  display: grid;
  gap: var(--hx-space-2);
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-muted);
}

.rdm-remap-repair__title {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.rdm-remap-repair__copy {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.4;
}

.rdm-remap-repair__list {
  display: grid;
  gap: var(--hx-space-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.rdm-remap-repair__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-2);
}

.rdm-remap-repair__item-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  min-width: 0;
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

/* ── Action row ────────────────────────────────────────────────────────── */

.rdm-action-row {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.rdm-for-user {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
}

.rdm-for-user__label {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  white-space: nowrap;
}

.rdm-for-user__select {
  font-size: var(--hx-text-sm);
}

/* ── Edition switcher ──────────────────────────────────────────────────── */

.rdm-editions {
  display: flex;
  align-items: flex-start;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.rdm-edition-picker {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  flex: 1;
}

.rdm-edition-picker__legend {
  margin-bottom: var(--hx-space-2);
  padding: 0;
  color: var(--hx-text);
  font-size: var(--hx-text-xs);
  font-weight: 700;
}

.rdm-edition-options {
  display: flex;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.rdm-edition-option {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-1);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-full);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  padding: var(--hx-space-1) var(--hx-space-3);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.rdm-edition-option:hover {
  background: var(--hx-bg-muted);
  color: var(--hx-text);
}

.rdm-edition-option:has(input:focus-visible),
.rdm-edition-menu__item:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

.rdm-edition-option.is-active {
  background: var(--hx-color-accent-muted, var(--hx-bg-muted));
  border-color: var(--hx-color-accent, var(--hx-border));
  color: var(--hx-text-strong);
  font-weight: 600;
}

.rdm-edition-option input {
  accent-color: var(--hx-color-accent, var(--hx-accent));
}

.rdm-edition-overflow {
  position: relative;
}

.rdm-edition-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  list-style: none;
  padding: var(--hx-space-1);
  margin: 0;
  min-width: 12rem;
  z-index: 10;
}

.rdm-edition-menu__item {
  background: none;
  border: none;
  padding: var(--hx-space-2) var(--hx-space-3);
  width: 100%;
  text-align: left;
  font-size: var(--hx-text-sm);
  color: var(--hx-text);
  cursor: pointer;
  border-radius: var(--hx-radius-sm);
}

.rdm-edition-menu__item:hover:not(:disabled) {
  background: var(--hx-bg-muted);
}

.rdm-edition-menu__item:disabled {
  color: var(--hx-text-muted);
  cursor: not-allowed;
}

/* ── Tracklist ─────────────────────────────────────────────────────────── */

.rdm-tracklist {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-4);
}

.rdm-disc-heading {
  margin: 0 0 var(--hx-space-2);
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rdm-track-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rdm-track {
  display: grid;
  grid-template-columns: 1.2rem 2rem minmax(0, 1fr) auto;
  gap: var(--hx-space-2);
  align-items: center;
  padding: var(--hx-space-1) var(--hx-space-2);
  border-radius: var(--hx-radius-sm);
  font-size: var(--hx-text-sm);
}

.rdm-operator-edition {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-muted);
}

.rdm-operator-edition__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.rdm-operator-edition__heading h3,
.rdm-operator-edition__heading p {
  margin: 0;
}

.rdm-operator-edition__heading h3 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
}

.rdm-operator-edition__heading p,
.rdm-operator-edition__help {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.45;
}

.rdm-operator-edition__heading p {
  margin-top: var(--hx-space-1);
}

.rdm-operator-edition__help {
  margin: 0;
}

.rdm-edition-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: var(--hx-space-2);
  margin: 0;
}

.rdm-edition-facts div {
  min-width: 0;
}

.rdm-edition-facts dt {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}

.rdm-edition-facts dd {
  margin: var(--hx-space-1) 0 0;
  overflow-wrap: anywhere;
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.rdm-track.has-track-override-controls {
  grid-template-columns: 1.2rem 2rem minmax(0, 1fr) auto auto minmax(9rem, 0.85fr);
}

.rdm-track.is-owned {
  background: var(--hx-bg-muted);
}

.rdm-track-owned {
  font-size: 0.5rem;
  color: var(--hx-text-subtle);
  text-align: center;
}

.rdm-track.is-owned .rdm-track-owned {
  color: var(--hx-color-success, #22c55e);
}

.rdm-track-num {
  color: var(--hx-text-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rdm-track-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--hx-text);
}

.rdm-track-duration {
  color: var(--hx-text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rdm-track-override-select {
  min-width: 8.5rem;
  font-size: var(--hx-text-xs);
}

.rdm-track-review {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.rdm-track-review .hx-pill {
  justify-self: start;
}

.rdm-track-review__copy {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  line-height: 1.3;
}

.rdm-track-review__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-1);
}

.rdm-track-review__actions .hx-btn,
.rdm-remap-repair__item .hx-btn {
  min-height: 28px;
  padding: 0 var(--hx-space-2);
  font-size: var(--hx-text-xs);
}

/* ── Misc ──────────────────────────────────────────────────────────────── */

.rdm-loading {
  text-align: center;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-6) 0;
}

.rdm-error {
  color: var(--hx-text-danger, var(--hx-text-muted));
  font-size: var(--hx-text-sm);
  margin: 0;
}

.rdm-source-note {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
  margin: 0;
}

.rdm-footer-links {
  display: flex;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

/* ── Mobile ─────────────────────────────────────────────────────────────── */

/*
 * The dialog is width: min(640px, 96vw).  On a phone (≤~430px) that equals
 * ~96vw, leaving the body ~96vw - 40px of usable width after padding.
 * Stack artwork above the info text so neither is cramped.
 */
@media (max-width: 640px) {
  .rdm-hero {
    flex-direction: column;
    gap: var(--hx-space-3);
  }

  .rdm-artwork {
    width: 5rem;
    height: 5rem;
  }

  .rdm-body {
    padding: var(--hx-space-4);
  }

  .rdm-track,
  .rdm-track.has-track-override-controls {
    grid-template-columns: 1rem 1.8rem minmax(0, 1fr) auto;
  }

  .rdm-track-override-select {
    grid-column: 3 / -1;
    width: 100%;
  }

  .rdm-track-review {
    grid-column: 3 / -1;
  }

  .rdm-remap-repair__item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
