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
import EmptyState from '../components/EmptyState.vue';
import MonitorButton from '../components/media/MonitorButton.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import { useArtistDetail } from '../composables/useArtistDetail.js';
import { useArtistMonitoring } from '../composables/useArtistMonitoring.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { buildArtistDetailLocation, groupReleaseGroupsByType, normalizeReleaseGroupForCard } from '../lib/artist-detail-route.js';
import { getArtistAvatar } from '../lib/artist-avatar.js';
import { getErrorMessage } from '../lib/error-utils.js';

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

function openConfirmModal(release) {
  confirmRelease.value = release;
  confirmError.value = null;
  confirmModalOpen.value = true;
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

async function handleConfirmRequest() {
  if (!confirmRelease.value) return;
  confirmError.value = null;
  const result = await requestRelease(confirmRelease.value);
  if (result.ok) {
    confirmModalOpen.value = false;
    confirmRelease.value = null;
  } else if (!result.skipped) {
    confirmError.value = getErrorMessage(result.error, 'Request failed. Please try again.');
  }
}

/** Displayed artist name — local metadata preferred, query hint as fallback. */
const artistName = computed(() => {
  return artist.value?.name ?? nameHint.value || 'Artist';
});

/** Short metadata line under the artist name. */
const artistMeta = computed(() => {
  if (!artist.value) return null;
  const parts = [];
  if (artist.value.type) parts.push(artist.value.type);
  if (artist.value.country) parts.push(artist.value.country);
  if (artist.value.disambiguation) parts.push(`(${artist.value.disambiguation})`);
  return parts.length ? parts.join(' · ') : null;
});

/** Whether the artist has a known MusicBrainz page. */
const musicBrainzUrl = computed(() => {
  if (!mbid.value) return null;
  return `https://musicbrainz.org/artist/${mbid.value}`;
});

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

async function handleMonitor() {
  const result = await monitorArtist({ id: mbid.value, name: artistName.value });
  if (result?.success) {
    setMonitoring({ monitored: true });
  }
}

function avatarStyle(relatedArtist) {
  const avatar = getArtistAvatar(relatedArtist.id, relatedArtist.name);
  return { background: avatar.bg, color: avatar.fg };
}

function artistInitial(relatedArtist) {
  return getArtistAvatar(relatedArtist.id, relatedArtist.name).initial;
}

// Load on mount and whenever the MBID changes (e.g. navigating between artists).
onMounted(() => {
  if (mbid.value) loadArtistDetail(mbid.value);
});

watch(mbid, (newMbid, oldMbid) => {
  if (newMbid && newMbid !== oldMbid) {
    loadArtistDetail(newMbid);
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
      :title="discographyError"
      body="Check your connection and try again."
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
      <header class="hx-page-header artist-detail-header">
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
              Open in MusicBrainz ↗
            </a>
          </div>
        </div>
      </header>

      <!-- Artist error (non-fatal — discography may still be present) -->
      <p v-if="artistError" class="artist-detail-soft-error" role="alert">
        {{ artistError }}
      </p>

      <!-- ── Discography ────────────────────────────────────────────────── -->
      <section class="artist-detail-section" aria-label="Discography">
        <h2 class="artist-detail-section-heading">Discography</h2>

        <p v-if="discographyError" class="artist-detail-soft-error" role="alert">
          {{ discographyError }}
        </p>

        <EmptyState
          v-else-if="!hasDiscography"
          title="No releases found"
          body="MusicBrainz has no release groups listed for this artist."
        />

        <template v-else>
          <div
            v-for="section in discographySections"
            :key="section.type"
            class="artist-detail-type-section"
          >
            <h3 class="artist-detail-type-heading">{{ section.type }}s</h3>
            <div class="hx-artwork-grid artist-detail-grid" :aria-label="`${section.type}s`">
              <ReleaseCard
                v-for="release in section.releases"
                :key="release.musicbrainzReleaseGroupId"
                :release="release"
                :requested="isRequested(release)"
                :requesting="isRequesting(release)"
                @request="openConfirmModal"
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
            <div
              class="artist-detail-related-avatar"
              :style="avatarStyle(related)"
              aria-hidden="true"
            >
              <span class="artist-detail-related-initial">{{ artistInitial(related) }}</span>
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
      @confirm="handleConfirmRequest"
      @close="closeConfirmModal"
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
</style>
