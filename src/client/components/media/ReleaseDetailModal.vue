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
import { computed, onMounted, ref, watch } from 'vue';
import ArtworkImage from '../ArtworkImage.vue';
import { useReleaseDetail } from '../../composables/useReleaseDetail.js';
import { useReleaseRequest } from '../../composables/useReleaseRequest.js';
import { useActiveUsers } from '../../composables/useActiveUsers.js';
import { sessionStore } from '../../state/session.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import {
  computeMediaTotalMs,
  formatAlbumRuntime,
  formatTrackDuration,
} from '../../lib/track-duration.js';
import {
  canBuildDraftTrackOverride,
  getDraftTrackOverrideState,
} from '../../lib/operator-artist-detail-draft.js';

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
});

const emit = defineEmits(['close', 'requested', 'track-override-change']);

const dialogRef = ref(null);
const editionMenuOpen = ref(false);
const requestError = ref(null);
const selectedForUserId = ref(null);

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: activeUsers } = useActiveUsers();

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

const showOwnershipCallout = computed(() => {
  const o = ownership.value;
  return o !== null && o.matchedTrackCount > 0 && o.matchedTrackCount < o.expectedTrackCount;
});

const currentRelease = computed(() => release.value);

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

// ── Modal lifecycle ───────────────────────────────────────────────────────────

function openDialogSession() {
  if (!dialogRef.value) return;
  if (!dialogRef.value.open) dialogRef.value.showModal();
  selectedForUserId.value = null;
  requestError.value = null;
  editionMenuOpen.value = false;
  load(props.releaseGroupMbid, { preferReleaseMbid: props.preferReleaseMbid });
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
      if (dialogRef.value.open) dialogRef.value.close();
    }
  },
);

// ── Event handlers ────────────────────────────────────────────────────────────

function handleCancel(event) {
  event.preventDefault();
  if (!isCurrentlyRequesting.value) emit('close');
}

function handleBackdropClick(event) {
  if (isCurrentlyRequesting.value) return;
  if (event.target === dialogRef.value) emit('close');
}

function handleClose() {
  if (!isCurrentlyRequesting.value) emit('close');
}

async function handleRequest() {
  if (!releaseForRequest.value) return;
  requestError.value = null;
  const result = await requestRelease(releaseForRequest.value, {
    requestedForUserId: selectedForUserId.value ?? null,
  });
  if (result.ok) {
    emit('requested', { releaseGroupMbid: props.releaseGroupMbid });
  } else if (!result.skipped) {
    requestError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
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

function getTrackOverrideLabel(track) {
  return `Desired state for ${track?.title ?? 'track'}`;
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
</script>

<template>
  <dialog
    ref="dialogRef"
    class="rdm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rdm-heading"
    @cancel="handleCancel"
    @click="handleBackdropClick"
  >
    <div class="rdm-shell">
      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <header class="rdm-header">
        <h2 id="rdm-heading" class="rdm-sr-only">Release detail</h2>
        <button
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
            <div class="rdm-edition-pills">
              <button
                v-for="ed in allReleases.slice(0, 6)"
                :key="ed.musicbrainzReleaseId ?? ed.id"
                type="button"
                class="rdm-edition-pill"
                :class="{ 'is-active': ed.id === currentRelease?.id }"
                @click="handleSwitchEdition(ed)"
              >
                {{ ed.country ?? '??' }}
                <span v-if="ed.releaseDate"> · {{ ed.releaseDate.slice(0, 4) }}</span>
                <span v-if="ed.trackCount"> · {{ ed.trackCount }}tr</span>
              </button>
            </div>

            <!-- ··· overflow menu with "Set as Default Edition" -->
            <div v-if="isAdmin && currentRelease?.id" class="rdm-edition-overflow">
              <button
                type="button"
                class="hx-btn"
                data-variant="ghost"
                :aria-expanded="editionMenuOpen"
                @click="editionMenuOpen = !editionMenuOpen"
              >···</button>
              <ul v-if="editionMenuOpen" class="rdm-edition-menu" role="menu">
                <li role="menuitem">
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

          <p v-if="canonicalError" class="rdm-error" role="alert">{{ canonicalError }}</p>

          <div v-if="showTrackOverrideControls" class="rdm-operator-note" role="note">
            <span class="hx-pill" data-tone="info">Draft</span>
            Track overrides are saved with Artist Policy.
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

.rdm-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
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
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.rdm-edition-pills {
  display: flex;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
  flex: 1;
}

.rdm-edition-pill {
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-full);
  background: none;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  padding: var(--hx-space-1) var(--hx-space-3);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.rdm-edition-pill:hover {
  background: var(--hx-bg-muted);
  color: var(--hx-text);
}

.rdm-edition-pill.is-active {
  background: var(--hx-color-accent-muted, var(--hx-bg-muted));
  border-color: var(--hx-color-accent, var(--hx-border));
  color: var(--hx-text-strong);
  font-weight: 600;
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

.rdm-track.has-track-override-controls {
  grid-template-columns: 1.2rem 2rem minmax(0, 1fr) auto auto;
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
}
</style>
