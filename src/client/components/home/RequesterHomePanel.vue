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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ArtistCard from '../media/ArtistCard.vue';
import ConfirmRequestModal from '../media/ConfirmRequestModal.vue';
import EmptyState from '../EmptyState.vue';
import GridControls from '../GridControls.vue';
import ReleaseCard from '../media/ReleaseCard.vue';
import RequestButton from '../media/RequestButton.vue';
import { useGridState } from '../../composables/useGridState.js';
import { useActivityFeed } from '../../composables/useActivityFeed.js';
import { useMonitoredArtistSummaries } from '../../composables/useMonitoredArtistSummaries.js';
import { useReleaseRadar } from '../../composables/useReleaseRadar.js';
import { useReleaseRequest } from '../../composables/useReleaseRequest.js';
import { useRequestUsers } from '../../composables/useRequestUsers.js';
import { buildArtistDetailLocation } from '../../lib/artist-detail-route.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { formatActivityEventTime, getActivityEventDetail, getActivityEventLabel } from '../../lib/activity-event-normalization.js';
import { getRadarWindowLabel } from '../../lib/release-radar-normalization.js';
import { sessionStore } from '../../state/session.js';

const {
  artists,
  errorMessage,
  isLoading,
  loadMonitoredArtistSummaries: loadMonitoredArtists,
  destroy: destroyArtists,
  attachVisibilityListener: attachArtistsVisibility,
} = useMonitoredArtistSummaries({ limit: 25, pollIntervalMs: 30000, revalidateOnFocus: true });

const activityFeed = useActivityFeed({ limit: 10, pollIntervalMs: 30000, revalidateOnFocus: true });
const currentUserId = sessionStore.state.user?.id ?? null;

const radar = useReleaseRadar({ pollIntervalMs: 30000, revalidateOnFocus: true });
const radarStrip = computed(() => [
  ...radar.recent.value.slice(0, 4),
  ...radar.upcoming.value.slice(0, 4),
].slice(0, 8));
const hasRadar = computed(() => radarStrip.value.length > 0);

const {
  isRequested,
  isRequesting,
  requestRelease,
} = useReleaseRequest();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const { users: requestForUsers, loadUsers: loadRequestForUsers } = useRequestUsers();

const confirmModalOpen = ref(false);
const confirmRelease = ref(null);
const confirmError = ref(null);

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

const radarStripLabel = computed(() => {
  if (radar.hasRecent.value && radar.hasUpcoming.value) return 'New and upcoming releases';
  if (radar.hasRecent.value) return getRadarWindowLabel('recent', radar.windows.value.recentDays);
  return getRadarWindowLabel('upcoming', radar.windows.value.upcomingDays);
});

const hasArtists = computed(() => artists.value.length > 0);

// ── Sort definitions ──────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'added', label: 'Recently added' },
];

const ARTIST_DEFAULTS = {
  sort: { field: 'name', order: 'asc' },
  filters: {},
};

// ── Grid state (URL-synced) ───────────────────────────────────────────────────

const {
  clearAll,
  filterState,
  isDefault,
  updateState,
} = useGridState(ARTIST_DEFAULTS, {
  filterGroupKeys: [],
  sortOptions: SORT_OPTIONS,
  filterGroups: [],
});

// ── Client-side sorted artists ────────────────────────────────────────────────

const sortedArtists = computed(() => {
  const field = filterState.value?.sort?.field ?? 'name';
  const order = filterState.value?.sort?.order ?? 'asc';
  return [...artists.value].sort((a, b) => {
    let av, bv;
    if (field === 'added') {
      av = a.addedAt ?? a.createdAt ?? '';
      bv = b.addedAt ?? b.createdAt ?? '';
    } else {
      av = (a.sortName ?? a.name ?? '').toLowerCase();
      bv = (b.sortName ?? b.name ?? '').toLowerCase();
    }
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });
});

onMounted(() => {
  void loadMonitoredArtists();
  void radar.load();
  void activityFeed.load();
  attachArtistsVisibility();
  radar.attachVisibilityListener();
  activityFeed.attachVisibilityListener();
});

onBeforeUnmount(() => {
  destroyArtists();
  radar.destroy();
  activityFeed.destroy();
});
</script>

<template>
  <section class="hx-page requester-home">

    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Home</h1>
        <p class="hx-page-subtitle">Artists you're monitoring and music you care about.</p>
      </div>
      <div class="hx-page-actions">
        <RouterLink :to="{ name: 'discover' }" class="hx-btn">Discover artists</RouterLink>
      </div>
    </header>

    <!-- Loading state -->
    <p
      v-if="isLoading && !hasArtists"
      class="requester-home-loading"
      aria-live="polite"
      aria-busy="true"
    >
      Loading your artists…
    </p>

    <!-- Error state -->
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      body="Check your connection and try refreshing the page."
    />

    <!-- Empty state — no monitored artists yet -->
    <EmptyState
      v-else-if="!isLoading && !hasArtists"
      title="Start building your music home"
      body="Discover artists you love and Harmoniarr will keep them close for future requests."
      cta-label="Discover artists"
      :cta-to="{ name: 'discover' }"
      variant="discover"
    />

    <!-- Monitored artists grid -->
    <template v-else>

      <!-- Release Radar strip (shown when radar data exists) -->
      <section v-if="hasRadar" class="radar-strip" aria-label="Release radar">
        <div class="radar-strip-header">
          <h2 class="radar-strip-title">{{ radarStripLabel }}</h2>
          <RouterLink :to="{ name: 'activity-releases' }" class="radar-strip-link">See all</RouterLink>
        </div>
        <div class="radar-strip-scroll">
          <ReleaseCard
            v-for="(release, index) in radarStrip"
            :key="release.metadataReleaseGroupId ?? index"
            :release="release"
            :requested="isRequested(release)"
            :requesting="isRequesting(release)"
            class="radar-strip-card"
            @request="openConfirmModal(release)"
          >
            <template #actions>
              <RequestButton
                :requested="isRequested(release)"
                :loading="isRequesting(release)"
                :aria-label="isRequested(release)
                  ? `${release.title ?? 'Release'} — already requested`
                  : `Request ${release.title ?? 'this release'}`"
                @request="openConfirmModal(release)"
              />
            </template>
          </ReleaseCard>
        </div>
      </section>
      <div class="requester-home-controls">
        <GridControls
          :model-value="filterState"
          :sort-options="SORT_OPTIONS"
          :filter-groups="[]"
          :is-default="isDefault"
          :is-loading="false"
          @clear-all="clearAll"
          @update:model-value="updateState"
        />
      </div>

      <section
        class="hx-artwork-grid requester-home-grid"
        aria-label="Monitored artists"
      >
        <ArtistCard
          v-for="artist in sortedArtists"
        :key="artist.id"
        :artist="artist"
        :monitored="true"
        :to="artist.id ? buildArtistDetailLocation(artist.id, artist.name) : undefined"
      />

      <!-- "Find more artists" tail card — always visible when artists exist -->
      <RouterLink
        :to="{ name: 'discover' }"
        class="hx-media-card requester-home-discover-card"
        aria-label="Find more artists"
      >
        <div class="hx-artwork hx-artwork--dashed requester-home-discover-art">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
        </div>
        <div class="hx-media-card-body">
          <p class="hx-media-card-title">Find more artists</p>
        </div>
      </RouterLink>
    </section>

      <!-- Recent Household Activity (compact, last 10 events) -->
      <section
        v-if="activityFeed.hasEvents.value || activityFeed.isLoading.value"
        class="requester-home-activity"
        aria-label="Recent household activity"
      >
        <h2 class="requester-home-activity-title">Recent Activity</h2>
        <p
          v-if="activityFeed.isLoading.value"
          class="requester-home-activity-loading"
          aria-live="polite"
          aria-busy="true"
        >
          Loading activity…
        </p>
        <ul v-else class="requester-home-activity-list">
          <li
            v-for="event in activityFeed.events.value"
            :key="event.id"
            class="requester-home-activity-item"
          >
            <span class="requester-home-activity-dot" aria-hidden="true" />
            <span class="requester-home-activity-label-wrap">
              <span class="requester-home-activity-label">
                {{ getActivityEventLabel(event, currentUserId) }}
              </span>
              <span v-if="getActivityEventDetail(event)" class="requester-home-activity-detail">
                {{ getActivityEventDetail(event) }}
              </span>
            </span>
            <time
              v-if="event.occurredAt"
              :datetime="event.occurredAt"
              class="requester-home-activity-time"
            >
              {{ formatActivityEventTime(event.occurredAt) }}
            </time>
          </li>
        </ul>
      </section>

    </template>

  </section>

  <ConfirmRequestModal
    :open="confirmModalOpen"
    :release="confirmRelease"
    :is-requesting="confirmIsRequesting"
    :is-requested="confirmIsRequested"
    :error="confirmError"
    :users="isAdmin ? requestForUsers : []"
    @confirm="handleConfirmRequest"
    @close="closeConfirmModal"
  />
</template>

<style scoped>
.requester-home {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.requester-home-loading {
  text-align: center;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-6) 0;
}

.requester-home-controls {
  padding: 0;
}

.requester-home-grid {
  --hx-artwork-grid-min: 160px;
}

/* ── Release Radar strip ─────────────────────────────────────────────────── */
.radar-strip {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-3);
}

.radar-strip-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.radar-strip-title {
  font-size: var(--hx-text-base);
  font-weight: var(--hx-font-semibold, 600);
  margin: 0;
}

.radar-strip-link {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  text-decoration: none;
  flex-shrink: 0;
}

.radar-strip-link:hover {
  color: var(--hx-text);
}

.radar-strip-scroll {
  display: flex;
  gap: var(--hx-space-4);
  overflow-x: auto;
  padding-bottom: var(--hx-space-1);
  scrollbar-width: thin;
}

.radar-strip-card {
  flex: 0 0 160px;
  min-width: 0;
}

/* Monitored cards are not interactive at the card level — cursor stays default */
.requester-home-grid .hx-media-card {
  cursor: default;
}

/* The tail discover card is a RouterLink and should have pointer cursor */
.requester-home-discover-card {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.requester-home-discover-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hx-text-muted);
}

.requester-home-discover-art svg {
  width: 40%;
  height: 40%;
  max-width: 64px;
}

/* ── Recent Activity panel ───────────────────────────────────────────────── */
.requester-home-activity {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-3);
}

.requester-home-activity-title {
  font-size: var(--hx-text-base);
  font-weight: var(--hx-font-semibold, 600);
  margin: 0;
}

.requester-home-activity-loading {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
}

.requester-home-activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.requester-home-activity-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--hx-surface-raised, #1e1e1e);
}

.requester-home-activity-dot {
  flex-shrink: 0;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: var(--hx-accent, #6ea8fe);
  align-self: center;
}

.requester-home-activity-label-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-1);
}

.requester-home-activity-label {
  font-size: var(--hx-text-sm);
}

.requester-home-activity-detail {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}

.requester-home-activity-time {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--hx-text-muted);
  white-space: nowrap;
}

/* ── Mobile ─────────────────────────────────────────────────────────────── */

@media (max-width: 640px) {
  /*
   * .requester-home-grid overrides --hx-artwork-grid-min: 160px via scoped
   * styles, winning over the global 640px rule.  Re-override so two columns
   * still fit on narrow phones.
   */
  .requester-home-grid {
    --hx-artwork-grid-min: 140px;
  }

  /*
   * The radar strip scrolls horizontally.  Hide the scrollbar on mobile
   * (the scroll affordance is implied by the card edge peeking at the right).
   */
  .radar-strip-scroll {
    scrollbar-width: none;
  }

  .radar-strip-scroll::-webkit-scrollbar {
    display: none;
  }

  /*
   * Slightly narrower cards so two-and-a-half cards peek on a 360px phone,
   * giving a clear horizontal-scroll affordance.
   */
  .radar-strip-card {
    flex: 0 0 140px;
  }
}
</style>
