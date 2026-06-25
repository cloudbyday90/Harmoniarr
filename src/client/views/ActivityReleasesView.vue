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
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import ConfirmRequestModal from '../components/media/ConfirmRequestModal.vue';
import EmptyState from '../components/EmptyState.vue';
import ReleaseCard from '../components/media/ReleaseCard.vue';
import RequestButton from '../components/media/RequestButton.vue';
import { useArtworkGridRoving } from '../composables/useArtworkGridRoving.js';
import { useReleaseRequest } from '../composables/useReleaseRequest.js';
import { useReleaseRadar } from '../composables/useReleaseRadar.js';
import { useRequestUsers } from '../composables/useRequestUsers.js';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  buildRecentReleasesCardSubtitle,
  buildUpcomingReleasesCardSubtitle,
  getRadarWindowLabel,
} from '../lib/release-radar-normalization.js';
import { sessionStore } from '../state/session.js';

const radar = useReleaseRadar();

// Roving tabindex over the recent + upcoming release grids.
const recentGridEl = useTemplateRef('recentGrid');
useArtworkGridRoving(() => recentGridEl.value, {
  cellSelector: '.hx-media-card__link-area',
  count: () => radar.recent.value.length,
});
const upcomingGridEl = useTemplateRef('upcomingGrid');
useArtworkGridRoving(() => upcomingGridEl.value, {
  cellSelector: '.hx-media-card__link-area',
  count: () => radar.upcoming.value.length,
});

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

const recentLabel = computed(() =>
  getRadarWindowLabel('recent', radar.windows.value.recentDays),
);

const upcomingLabel = computed(() =>
  getRadarWindowLabel('upcoming', radar.windows.value.upcomingDays),
);

onMounted(() => radar.load());
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Releases</h1>
        <p class="hx-page-subtitle">New and upcoming releases from monitored artists.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="radar.load()" :disabled="radar.isLoading.value">
          {{ radar.isLoading.value ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="radar.errorMessage.value" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ radar.errorMessage.value }}</span>
      </div>
    </article>

    <!-- Recent releases section -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">{{ recentLabel }}</h2>
          <p class="hx-card-subtitle">
            {{ buildRecentReleasesCardSubtitle(radar.recent.value.length) }}
          </p>
        </div>
      </header>

      <div class="hx-card-body" v-if="radar.isLoading.value && radar.recent.value.length === 0">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 4" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body" v-else-if="radar.recent.value.length === 0 && !radar.isLoading.value">
        <EmptyState
          title="No new releases"
          body="No releases from monitored artists have appeared in this window. Monitor more artists or adjust the window."
          variant="default"
        />
      </div>

      <div v-else class="hx-card-body hx-card-body--flush">
        <ul ref="recentGrid" class="hx-artwork-grid" role="list" aria-label="Recent releases">
          <li v-for="(release, index) in radar.recent.value" :key="release.metadataReleaseGroupId ?? index">
            <ReleaseCard
              :release="release"
              :requested="isRequested(release)"
              :requesting="isRequesting(release)"
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
          </li>
        </ul>
      </div>
    </article>

    <!-- Upcoming releases section -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">{{ upcomingLabel }}</h2>
          <p class="hx-card-subtitle">
            {{ buildUpcomingReleasesCardSubtitle(radar.upcoming.value.length) }}
          </p>
        </div>
      </header>

      <div class="hx-card-body" v-if="radar.isLoading.value && radar.upcoming.value.length === 0">
        <div class="hx-skeleton-stack">
          <span class="hx-skeleton" v-for="i in 4" :key="i"></span>
        </div>
      </div>

      <div class="hx-card-body" v-else-if="radar.upcoming.value.length === 0 && !radar.isLoading.value">
        <EmptyState
          title="No upcoming releases"
          body="No releases from monitored artists are scheduled in this window."
          variant="default"
        />
      </div>

      <div v-else class="hx-card-body hx-card-body--flush">
        <ul ref="upcomingGrid" class="hx-artwork-grid" role="list" aria-label="Upcoming releases">
          <li v-for="(release, index) in radar.upcoming.value" :key="release.metadataReleaseGroupId ?? index">
            <ReleaseCard
              :release="release"
              :requested="isRequested(release)"
              :requesting="isRequesting(release)"
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
          </li>
        </ul>
      </div>
    </article>
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
