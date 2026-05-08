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
import { computed, onMounted } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import GridControls from '../components/GridControls.vue';
import RequestCard from '../components/media/RequestCard.vue';
import RequestNotificationsPanel from '../components/RequestNotificationsPanel.vue';
import { useGridState } from '../composables/useGridState.js';
import { useMyRequestNotifications } from '../composables/useMyRequestNotifications.js';
import { useMyRequests } from '../composables/useMyRequests.js';
import { sessionStore } from '../state/session.js';

const viewerUserId = computed(() => sessionStore.state.user?.id ?? null);

const { errorMessage, hasRequests, isLoading, loadRequests, requests } = useMyRequests({ limit: 50 });

// ── Notification feed (delegated requests + fulfillment updates) ─────────────

const {
  checkedAt: notificationCheckedAt,
  counts: notificationCounts,
  load: loadNotifications,
  notifications,
} = useMyRequestNotifications();

const hasNotifications = computed(() => (notificationCounts.value?.total ?? 0) > 0);

// ── Sort / filter definitions ─────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'requested_at', label: 'Date requested' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'downloading', label: 'Downloading' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
];

const REQUESTS_DEFAULTS = {
  sort: { field: 'requested_at', order: 'desc' },
  filters: {},
};

// ── Grid state (URL-synced) ───────────────────────────────────────────────────

const {
  clearAll,
  filterState,
  isDefault,
  toggleSortOrder,
  updateState,
} = useGridState(REQUESTS_DEFAULTS, {
  filterGroupKeys: ['status'],
  sortOptions: SORT_OPTIONS,
  filterGroups: [{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }],
});

// ── Client-side filtered + sorted requests ────────────────────────────────────

const displayRequests = computed(() => {
  const all = requests.value ?? [];
  const statusFilter = filterState.value?.filters?.status;
  const filtered = statusFilter
    ? all.filter((r) => r.status === statusFilter)
    : all;
  const field = filterState.value?.sort?.field ?? 'requested_at';
  const order = filterState.value?.sort?.order ?? 'desc';
  return [...filtered].sort((a, b) => {
    let av, bv;
    if (field === 'title') {
      av = (a.releaseGroupTitle ?? a.title ?? '').toLowerCase();
      bv = (b.releaseGroupTitle ?? b.title ?? '').toLowerCase();
    } else if (field === 'artist') {
      av = (a.artistSortName ?? a.artistName ?? '').toLowerCase();
      bv = (b.artistSortName ?? b.artistName ?? '').toLowerCase();
    } else {
      av = a.requestedAt ?? a.createdAt ?? '';
      bv = b.requestedAt ?? b.createdAt ?? '';
    }
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });
});

onMounted(() => {
  void loadRequests();
  void loadNotifications();
});
</script>

<template>
  <section class="hx-page my-requests">

    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">My Requests</h1>
        <p class="hx-page-subtitle">Track the music you've asked Harmoniarr to find.</p>
      </div>
    </header>

    <!-- Notification feed: delegated-request receipts and fulfillment updates -->
    <RequestNotificationsPanel
      v-if="hasNotifications"
      :checked-at="notificationCheckedAt"
      :counts="notificationCounts"
      :notifications="notifications"
    />

    <!-- Loading state -->
    <p
      v-if="isLoading && !hasRequests"
      class="my-requests-loading"
      aria-live="polite"
      aria-busy="true"
    >
      Loading your requests…
    </p>

    <!-- Error state -->
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      body="Check your connection and try refreshing the page."
    />

    <!-- Empty state — no requests yet (and default filter) -->
    <EmptyState
      v-else-if="!isLoading && !hasRequests && isDefault"
      title="No requests yet"
      body="Search for music and request releases you want Harmoniarr to find."
      cta-label="Search music"
      :cta-to="{ name: 'search' }"
    />

    <!-- Populated state — controls + artwork-first request grid -->
    <template v-else>
      <div class="my-requests-controls">
        <GridControls
          :model-value="filterState"
          :sort-options="SORT_OPTIONS"
          :filter-groups="[{ key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }]"
          :is-default="isDefault"
          :is-loading="false"
          @update:model-value="updateState"
        />
      </div>

      <EmptyState
        v-if="displayRequests.length === 0"
        title="No requests match these filters"
        body="Try adjusting or clearing your filters."
        cta-label="Clear filters"
        @cta-click="clearAll"
        variant="default"
      />

      <section
        v-else
        class="hx-artwork-grid my-requests-grid"
        aria-label="Your requests"
      >
        <RequestCard
          v-for="request in displayRequests"
          :key="request.id"
          :request="request"
          :viewer-user-id="viewerUserId"
        />
      </section>
    </template>

  </section>
</template>

<style scoped>
.my-requests {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.my-requests-controls {
  padding: 0;
}

.my-requests-grid {
  --hx-artwork-grid-min: 160px;
}

/* ── Mobile ─────────────────────────────────────────────────────────────── */

@media (max-width: 640px) {
  /*
   * .my-requests-grid sets --hx-artwork-grid-min: 160px via scoped styles,
   * which wins over the global 640px rule due to scoped-attribute specificity.
   * Re-override here so two columns still render on narrow phones.
   */
  .my-requests-grid {
    --hx-artwork-grid-min: 140px;
  }
}
</style>
