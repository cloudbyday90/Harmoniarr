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
import { useRoute } from 'vue-router';
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import ReleaseDetailModal from '../components/media/ReleaseDetailModal.vue';
import EmptyState from '../components/EmptyState.vue';
import MonitorButton from '../components/media/MonitorButton.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useArtistDetail } from '../composables/useArtistDetail.js';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { useRequestUsers } from '../composables/useRequestUsers.js';
import { resolveArtwork, batchResolveArtwork } from '../lib/artwork-api.js';
import { buildArtistDetailLocation, groupReleaseGroupsByType, normalizeReleaseGroupForCard } from '../lib/artist-detail-route.js';
import {
  buildArtistDetailErrorBody,
  buildArtistMetaLine,
  buildArtistMusicBrainzLabel,
  buildArtistMusicBrainzUrl,
  buildNoDiscographyBody,
  buildRelatedArtistAvatarStyle,
  buildRelatedArtistInitial,
  formatArtistDetailError,
  formatDiscographyError,
  pluralizeReleaseType,
} from '../lib/artist-detail-presentation.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();

/** MBID from route params. */
const mbid = computed(() => String(route.params.mbid ?? ''));

/**
 * Artist name hint from query string — used as a display placeholder while the
 * API response is in flight. Populated when navigating from ArtistCard via
 * buildArtistDetailLocation(mbid, nameHint).
 */
const nameHint = computed(() => String(route.query.name ?? ''));

const {
  artist,
  releaseGroups,
  relatedArtists,
  isLoading,
  isMonitored,
  artistError,
  discographyError,
  relatedError,
  loadArtistDetail,
  setMonitoring,
} = useArtistDetail();

const {
  isMonitoring,
  monitorArtist,
} = useArtistMonitoring();

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

// ── Confirm request modal state ──────────────────────────────────────────────

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: requestForUsers, loadUsers: loadRequestForUsers } = useRequestUsers();

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
  if (isAdmin.value) void loadRequestForUsers();
}

function closeConfirmModal() {
  if (!isRequesting(confirmRelease.value)) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
    confirmError.value = null;
  }
}

const confirmIsRequesting = computed(() =>
  confirmRelease.value ? isRequesting(confirmRelease.value) : false,
);

const confirmIsRequested = computed(() =>
  confirmRelease.value ? isRequested(confirmRelease.value) : false,
);

async function handleConfirmRequest({ requestedForUserId = null } = {}) {
  if (!confirmRelease.value) return;
  confirmError.value = null;
  const result = await requestRelease(confirmRelease.value, { requestedForUserId });
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

// ── Release detail modal ─────────────────────────────────────────────────────

const detailModalOpen = ref(false);
const detailRelease = ref(null);

function openDetailModal(release) {
  detailRelease.value = release;
  detailModalOpen.value = true;
}

function closeDetailModal() {
  detailModalOpen.value = false;
  detailRelease.value = null;
}

/** Displayed artist name — local metadata preferred, query hint as fallback. */
const artistName = computed(() => {
  return (artist.value?.name ?? nameHint.value) || 'Artist';
});

/** Short metadata line under the artist name. */
const artistMeta = computed(() => buildArtistMetaLine(artist.value));

/** Whether the artist has a known MusicBrainz page. */
const musicBrainzUrl = computed(() => buildArtistMusicBrainzUrl(mbid.value));

/** Discography grouped into sections by primary type, newest first within each. */
const discographySections = computed(() => {
  return groupReleaseGroupsByType(releaseGroups.value).map((section) => ({
    type: section.type,
    releases: section.items.map(normalizeReleaseGroupForCard),
  }));
});

/** Whether there is at least one release group to show. */
const hasDiscography = computed(() => releaseGroups.value.length > 0);

/** Whether this artist is monitored (tracked in useArtistMonitoring or from local data). */
const isArtistMonitored = computed(() => isMonitored.value);

const heroBackgroundUrl = ref(null);
const heroThumbnailUrl = ref(null);
const isRefreshingArtwork = ref(false);

async function loadArtistArtwork(artistMbid, refresh = false) {
  if (!artistMbid) return;
  if (!refresh) {
    heroBackgroundUrl.value = null;
    heroThumbnailUrl.value = null;
  }
  isRefreshingArtwork.value = true;
  try {
    const [bgResult, thumbResult] = await Promise.all([
      resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: artistMbid, artworkRole: 'artist_background', refresh }),
      resolveArtwork({ ownerType: 'musicbrainz_artist', ownerId: artistMbid, artworkRole: 'artist_thumbnail', refresh }),
    ]);
    heroBackgroundUrl.value = bgResult?.url ?? null;
    heroThumbnailUrl.value = thumbResult?.url ?? null;
  } catch {
    // Hero artwork is decorative — silently degrade
  } finally {
    isRefreshingArtwork.value = false;
  }
}

const heroStyle = computed(() => {
  if (!heroBackgroundUrl.value) return {};
  return {
    'background-image': `linear-gradient(to bottom, color-mix(in oklch, var(--hx-bg-base) 40%, transparent), var(--hx-bg-base)), url(${heroBackgroundUrl.value})`,
  };
});

const discographyArtwork = ref({});

async function loadDiscographyArtwork(sections) {
  const requests = [];
  for (const section of sections) {
    for (const release of section.releases) {
      const rgMbid = release.musicbrainzReleaseGroupId;
      if (rgMbid && !discographyArtwork.value[`musicbrainz_release_group:${rgMbid}:cover_front`]) {
        requests.push({ ownerType: 'musicbrainz_release_group', ownerId: rgMbid, artworkRole: 'cover_front' });
      }
    }
  }
  if (requests.length === 0) return;
  try {
    const { resolved } = await batchResolveArtwork(requests);
    discographyArtwork.value = { ...discographyArtwork.value, ...resolved };
  } catch {
    // silently degrade
  }
}

function getReleaseArtwork(rgMbid) {
  const key = `musicbrainz_release_group:${rgMbid}:cover_front`;
  return discographyArtwork.value[key] ?? null;
}

watch(discographySections, (sections) => {
  if (sections.length > 0) void loadDiscographyArtwork(sections);
}, { immediate: true });

const relatedArtwork = ref({});

async function loadRelatedArtwork(artists) {
  const requests = [];
  for (const related of artists) {
    const relatedMbid = related.id;
    if (relatedMbid && !relatedArtwork.value[`musicbrainz_artist:${relatedMbid}:artist_thumbnail`]) {
      requests.push({ ownerType: 'musicbrainz_artist', ownerId: relatedMbid, artworkRole: 'artist_thumbnail' });
    }
  }
  if (requests.length === 0) return;
  try {
    const { resolved } = await batchResolveArtwork(requests);
    relatedArtwork.value = { ...relatedArtwork.value, ...resolved };
  } catch {
    // silently degrade
  }
}

function getRelatedArtwork(artistMbid) {
  const key = `musicbrainz_artist:${artistMbid}:artist_thumbnail`;
  return relatedArtwork.value[key]?.url ?? null;
}

watch(relatedArtists, (artists) => {
  if (artists.length > 0) void loadRelatedArtwork(artists);
}, { immediate: true });

async function handleMonitor() {
  const result = await monitorArtist({ id: mbid.value, name: artistName.value });
  if (result?.success) {
    setMonitoring({ monitored: true });
  }
}

// Load on mount and whenever the MBID changes (e.g. navigating between artists).
onMounted(() => {
  if (mbid.value) {
    loadArtistDetail(mbid.value);
    void loadArtistArtwork(mbid.value);
  }
});

watch(mbid, (newMbid, oldMbid) => {
  if (newMbid && newMbid !== oldMbid) {
    loadArtistDetail(newMbid);
    void loadArtistArtwork(newMbid);
  }
});
</script>

<template>
  <div class="hx-page artist-detail-page">
    <!-- Loading indicator -->
    <div v-if="isLoading" class="artist-detail-loading" aria-live="polite" aria-busy="true">
      <p class="artist-detail-loading-text">Loading…</p>
    </div>

    <!-- Hard error (discography failed AND no artist name fallback) -->
    <EmptyState
      v-else-if="discographyError && !artist && !nameHint"
      :title="formatDiscographyError(discographyError)"
      :body="buildArtistDetailErrorBody()"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
      </template>
    </EmptyState>

    <!-- Artist page content -->
    <template v-else>
      <!-- ── Artist header ──────────────────────────────────────────────── -->
      <header class="hx-page-header artist-detail-header" :style="heroStyle">
        <img
          v-if="heroThumbnailUrl"
          :src="heroThumbnailUrl"
          :alt="`${artistName} artwork`"
          class="artist-detail-hero-thumb"
          loading="lazy"
        />
        <div class="artist-detail-hero-thumb artist-detail-hero-thumb-placeholder" v-else aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="artist-detail-header-body">
          <h1 class="hx-page-title artist-detail-name">{{ artistName }}</h1>
          <p v-if="artistMeta" class="artist-detail-artist-meta">{{ artistMeta }}</p>
          <div class="artist-detail-header-actions">
            <MonitorButton
              :monitored="isArtistMonitored"
              :loading="isMonitoring(mbid)"
              @monitor="handleMonitor"
            />
            <a
              v-if="musicBrainzUrl"
              :href="musicBrainzUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="hx-btn"
              data-variant="ghost"
            >
              {{ buildArtistMusicBrainzLabel() }}
            </a>
            <button
              type="button"
              class="hx-btn hx-btn-icon"
              data-variant="ghost"
              :disabled="isRefreshingArtwork"
              aria-label="Refresh artwork"
              title="Refresh artwork"
              @click="loadArtistArtwork(mbid, true)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" :class="{ 'is-spinning': isRefreshingArtwork }" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3.2-6.8"/>
                <polyline points="21 3 21 9 15 9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <!-- Artist error (non-fatal — discography may still be present) -->
      <p v-if="artistError" class="artist-detail-soft-error" role="alert">
        {{ formatArtistDetailError(artistError) }}
      </p>

      <!-- ── Discography ────────────────────────────────────────────────── -->
      <section class="artist-detail-section" aria-label="Discography">
        <h2 class="artist-detail-section-heading">Discography</h2>

        <p v-if="discographyError" class="artist-detail-soft-error" role="alert">
          {{ formatDiscographyError(discographyError) }}
        </p>

        <EmptyState
          v-else-if="!hasDiscography"
          title="No releases found"
          :body="buildNoDiscographyBody()"
        />

        <template v-else>
          <div
            v-for="section in discographySections"
            :key="section.type"
            class="artist-detail-type-section"
          >
            <h3 class="artist-detail-type-heading">{{ pluralizeReleaseType(section.type) }}</h3>
            <div class="hx-artwork-grid artist-detail-grid" :aria-label="`${section.type}s`">
              <ReleaseCard
                v-for="release in section.releases"
                :key="release.musicbrainzReleaseGroupId"
                :release="release"
                :requested="isRequested(release)"
                :requesting="isRequesting(release)"
                :local-src="getReleaseArtwork(release.musicbrainzReleaseGroupId)?.url ?? null"
                :dominant-color="getReleaseArtwork(release.musicbrainzReleaseGroupId)?.dominantColor ?? null"
                :artwork-asset-id="getReleaseArtwork(release.musicbrainzReleaseGroupId)?.assetId ?? null"
                @request="openConfirmModal"
                @detail="openDetailModal"
              />
            </div>
          </div>
        </template>
      </section>

      <!-- ── Related artists ───────────────────────────────────────────── -->
      <section
        v-if="relatedArtists.length > 0"
        class="artist-detail-section"
        aria-label="Related artists"
      >
        <h2 class="artist-detail-section-heading">Related artists</h2>

        <div class="artist-detail-related-strip" role="list">
          <RouterLink
            v-for="related in relatedArtists"
            :key="related.id"
            :to="buildArtistDetailLocation(related.id, related.name)"
            class="artist-detail-related-card"
            role="listitem"
          >
            <img
              v-if="getRelatedArtwork(related.id)"
              :src="getRelatedArtwork(related.id)"
              :alt="related.name"
              class="artist-detail-related-avatar-img"
              loading="lazy"
            />
            <div
              v-else
              class="artist-detail-related-avatar"
              :style="buildRelatedArtistAvatarStyle(related.id, related.name)"
              aria-hidden="true"
            >
              <span class="artist-detail-related-initial">{{ buildRelatedArtistInitial(related.id, related.name) }}</span>
            </div>
            <span class="artist-detail-related-name">{{ related.name }}</span>
          </RouterLink>
        </div>

        <p v-if="relatedError" class="artist-detail-soft-error" role="alert">
          {{ relatedError }}
        </p>
      </section>
    </template>

    <!-- ── Confirm request modal ─────────────────────────────────────── -->
    <ConfirmRequestModal
      :open="confirmModalOpen"
      :release="confirmRelease"
      :loading="confirmIsRequesting"
      :requested="confirmIsRequested"
      :error-message="confirmError"
      :users="isAdmin ? requestForUsers : []"
      @confirm="handleConfirmRequest"
      @close="closeConfirmModal"
    />

    <!-- Release detail modal -->
    <ReleaseDetailModal
      v-if="detailRelease"
      :open="detailModalOpen"
      :release-group-mbid="detailRelease?.releaseGroup?.id ?? detailRelease?.releaseGroupId ?? ''"
      :release-title="detailRelease?.title ?? null"
      :artist-name="artist?.name ?? null"
      :release-year="detailRelease?.date ? String(detailRelease.date).slice(0, 4) : null"
      @close="closeDetailModal"
      @requested="closeDetailModal"
    />
  </div>
</template>

<style scoped>
.artist-detail-page {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-8);
}

.artist-detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20rem;
}

.artist-detail-loading-text {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.artist-detail-header {
  display: flex;
  align-items: flex-start;
  gap: var(--hx-space-6);
  background-size: cover;
  background-position: center 30%;
  background-repeat: no-repeat;
  border-radius: var(--hx-radius-lg);
  padding: var(--hx-space-8) var(--hx-space-6);
  min-height: 4rem;
}

.artist-detail-hero-thumb {
  width: 5rem;
  height: 5rem;
  border-radius: var(--hx-radius-md);
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.artist-detail-hero-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hx-bg-surface-sunken);
  box-shadow: none;
}

.artist-detail-hero-thumb-placeholder svg {
  width: 50%;
  height: 50%;
  opacity: 0.4;
  color: var(--hx-text-faint);
}

.artist-detail-header-body {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-3);
  flex: 1;
  min-width: 0;
}

.artist-detail-name {
  margin: 0;
}

.artist-detail-artist-meta {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
}

.artist-detail-header-actions {
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
  flex-wrap: wrap;
}

.is-spinning {
  animation: artist-detail-spin 0.8s linear infinite;
}

@keyframes artist-detail-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.artist-detail-soft-error {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-danger, var(--hx-text-muted));
  margin: 0;
}

.artist-detail-section {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-4);
}

.artist-detail-section-heading {
  margin: 0;
  font-size: var(--hx-text-strong);
  font-weight: 700;
  color: var(--hx-text-strong);
}

.artist-detail-type-section {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-3);
}

.artist-detail-type-heading {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.artist-detail-grid {
  /* Inherits hx-artwork-grid layout. */
}

/* ── Related artists strip ─────────────────────────────────────────────── */

.artist-detail-related-strip {
  display: flex;
  gap: var(--hx-space-3);
  overflow-x: auto;
  padding-bottom: var(--hx-space-2);
  scrollbar-width: thin;
}

.artist-detail-related-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hx-space-2);
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
  width: 6rem;
  cursor: pointer;
}

.artist-detail-related-card:hover .artist-detail-related-name,
.artist-detail-related-card:focus-visible .artist-detail-related-name {
  text-decoration: underline;
}

.artist-detail-related-avatar {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  flex-shrink: 0;
}

.artist-detail-related-avatar-img {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.artist-detail-related-initial {
  line-height: 1;
  user-select: none;
}

.artist-detail-related-name {
  font-size: var(--hx-text-xs);
  font-weight: 500;
  color: var(--hx-text-strong);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */

@media (max-width: 640px) {
  .artist-detail-header {
    flex-direction: column;
    gap: var(--hx-space-4);
    padding: var(--hx-space-6) var(--hx-space-4);
  }

  .artist-detail-hero-thumb {
    width: 4rem;
    height: 4rem;
  }

  .artist-detail-header-actions {
    width: 100%;
  }
}
</style>
