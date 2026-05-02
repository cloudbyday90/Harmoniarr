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
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MetadataArtistSearchPanel from '../components/MetadataArtistSearchPanel.vue';
import MetadataArtistSummary from '../components/MetadataArtistSummary.vue';
import MetadataLocalSearchPanel from '../components/MetadataLocalSearchPanel.vue';
import MetadataLocalReleaseGroupList from '../components/MetadataLocalReleaseGroupList.vue';
import MetadataLocalReleaseList from '../components/MetadataLocalReleaseList.vue';
import MetadataProviderReleaseList from '../components/MetadataProviderReleaseList.vue';
import MetadataReleaseDetail from '../components/MetadataReleaseDetail.vue';
import MetadataReleaseGroupBrowser from '../components/MetadataReleaseGroupBrowser.vue';
import MetadataSelectedReleaseGroupSummary from '../components/MetadataSelectedReleaseGroupSummary.vue';
import { useMetadataArtistWorkflow } from '../composables/useMetadataArtistWorkflow.js';
import {
  buildMetadataRouteHydrationPlan,
  buildMetadataRouteQuery,
  getMetadataRouteStateKey,
  normalizeMetadataRouteState,
  resolveMetadataRouteReleaseGroupId,
} from '../lib/metadata-route-state.js';

const route = useRoute();
const router = useRouter();

const {
  artistActionError,
  detectionEventsErrorMessage,
  detectionEventsPageInfo,
  importArtist,
  importRelease,
  importReleaseGroup,
  isImportingArtist,
  isImportingReleaseGroup,
  isImportingRelease,
  isLoadingArtist,
  isLoadingMoreDetectionEvents,
  isLoadingReleaseGroup,
  isOpeningLocalReleaseGroup,
  isOpeningLocalRelease,
  isRefreshingArtist,
  isSearchingLocal,
  isSearching,
  isUpdatingArtistMonitoring,
  localArtist,
  localArtistResults,
  localRelease,
  localReleaseGroup,
  localReleaseGroupResults,
  localReleaseResults,
  localSearchError,
  localSearchQuery,
  loadMoreDetectionEvents,
  loadReleaseGroupWorkspace,
  openLocalArtist,
  openLocalReleaseGroup,
  openLocalRelease,
  providerReleaseGroups,
  providerReleases,
  queuedRefreshRun,
  refreshArtistMetadata,
  releaseActionError,
  releaseGroupActionError,
  runLocalSearch,
  runArtistSearch,
  searchError,
  searchQuery,
  searchResults,
  selectedArtist,
  updateArtistMonitoring,
  hasSearchedLocal,
} = useMetadataArtistWorkflow();

const metadataRouteState = computed(() => normalizeMetadataRouteState(route.query));

async function replaceMetadataRouteState(nextState) {
  const normalizedNextState = normalizeMetadataRouteState({
    ...metadataRouteState.value,
    ...nextState,
  });

  if (getMetadataRouteStateKey(normalizedNextState) === getMetadataRouteStateKey(metadataRouteState.value)) {
    return;
  }

  await router.replace({
    name: 'metadata',
    query: buildMetadataRouteQuery(normalizedNextState),
  });
}

async function handleOpenArtist(artist) {
  await replaceMetadataRouteState({
    artistId: artist.id,
    releaseGroupId: '',
    releaseId: '',
  });
}

async function handleOpenLocalReleaseGroup(releaseGroup) {
  await replaceMetadataRouteState({
    artistId: localArtist.value?.artist?.id ?? releaseGroup.artistId ?? metadataRouteState.value.artistId,
    releaseGroupId: releaseGroup.id,
    releaseId: '',
  });
}

async function handleOpenProviderReleaseGroup(releaseGroup) {
  const routeReleaseGroupId = resolveMetadataRouteReleaseGroupId({
    localReleaseGroups: localArtist.value?.releaseGroups ?? [],
    releaseGroup,
  });

  if (!routeReleaseGroupId) {
    await loadReleaseGroupWorkspace(releaseGroup);
    return;
  }

  await replaceMetadataRouteState({
    artistId: localArtist.value?.artist?.id ?? metadataRouteState.value.artistId,
    releaseGroupId: routeReleaseGroupId,
    releaseId: '',
  });
}

async function handleOpenLocalRelease(release) {
  await replaceMetadataRouteState({
    artistId: localArtist.value?.artist?.id ?? metadataRouteState.value.artistId,
    releaseGroupId: release.releaseGroupId ?? metadataRouteState.value.releaseGroupId,
    releaseId: release.id,
  });
}

async function syncMetadataRouteState(plan) {
  if (plan.artistId) {
    await openLocalArtist({ id: plan.artistId });
  }

  if (plan.release) {
    await openLocalRelease({
      id: plan.release.releaseId,
      releaseGroupId: plan.release.releaseGroupId,
    });
    return;
  }

  if (plan.releaseGroupId) {
    await openLocalReleaseGroup({ id: plan.releaseGroupId });
  }
}

watch(
  () => [
    metadataRouteState.value.artistId,
    metadataRouteState.value.releaseGroupId,
    metadataRouteState.value.releaseId,
  ],
  ([nextArtistId, nextReleaseGroupId, nextReleaseId], [previousArtistId, previousReleaseGroupId, previousReleaseId] = []) => {
    if (
      nextArtistId === previousArtistId
      && nextReleaseGroupId === previousReleaseGroupId
      && nextReleaseId === previousReleaseId
    ) {
      return;
    }

    const plan = buildMetadataRouteHydrationPlan({
      currentArtistId: localArtist.value?.artist?.id,
      currentReleaseGroupId: localReleaseGroup.value?.releaseGroup?.id,
      currentReleaseId: localRelease.value?.release?.id,
      nextState: metadataRouteState.value,
    });

    if (!plan.artistId && !plan.releaseGroupId && !plan.release) {
      return;
    }

    void syncMetadataRouteState(plan);
  },
  { immediate: true },
);
</script>

<template>
  <section class="page-stack">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">Canonical metadata</p>
      <h2>MusicBrainz artist flow</h2>
      <p>Search an artist, import it once, then operate on local canonical metadata and selected release groups.</p>
    </article>

    <MetadataArtistSearchPanel
      :is-importing-artist="isImportingArtist"
      :is-loading-artist="isLoadingArtist"
      :is-searching="isSearching"
      :search-error="searchError"
      :search-query="searchQuery"
      :search-results="searchResults"
      :selected-artist-id="selectedArtist?.id ?? null"
      @import-artist="importArtist"
      @open-artist="handleOpenArtist"
      @run-search="runArtistSearch"
      @update:search-query="searchQuery = $event"
    />

    <MetadataLocalSearchPanel
      :has-searched-local="hasSearchedLocal"
      :is-searching-local="isSearchingLocal"
      :local-artist-results="localArtistResults"
      :local-release-group-results="localReleaseGroupResults"
      :local-release-results="localReleaseResults"
      :local-search-error="localSearchError"
      :local-search-query="localSearchQuery"
      @open-artist="handleOpenArtist"
      @open-release-group="handleOpenLocalReleaseGroup"
      @open-release="handleOpenLocalRelease"
      @run-search="runLocalSearch"
      @update:local-search-query="localSearchQuery = $event"
    />

    <article class="panel-light error-panel" v-if="artistActionError">
      <h3>Artist flow failed</h3>
      <p>{{ artistActionError }}</p>
    </article>

    <article class="panel-light" v-if="isLoadingArtist">
      <h3>Loading local artist workspace</h3>
      <p>Resolving the imported artist from local metadata and loading release-group candidates.</p>
    </article>

    <template v-else-if="localArtist">
      <MetadataArtistSummary
        :detection-events-error-message="detectionEventsErrorMessage"
        :detection-events-page-info="detectionEventsPageInfo"
        :is-loading-detection-events="isLoadingMoreDetectionEvents"
        :is-refreshing-metadata="isRefreshingArtist"
        :is-updating-monitoring="isUpdatingArtistMonitoring"
        :local-artist="localArtist"
        :queued-refresh-run="queuedRefreshRun"
        @load-more-detection-events="loadMoreDetectionEvents"
        @refresh-metadata="refreshArtistMetadata"
        @update-monitoring="updateArtistMonitoring"
      />

      <MetadataReleaseGroupBrowser
        :error-message="releaseGroupActionError"
        :is-loading-release-group="isLoadingReleaseGroup"
        :is-mutating-release-group="isImportingReleaseGroup"
        :local-release-groups="localArtist.releaseGroups"
        :provider-release-groups="providerReleaseGroups"
        @import-release-group="importReleaseGroup"
        @open-release-group="handleOpenProviderReleaseGroup"
      />

      <MetadataLocalReleaseGroupList
        :is-opening-local-release-group="isOpeningLocalReleaseGroup"
        :release-groups="localArtist.releaseGroups"
        @open-release-group="handleOpenLocalReleaseGroup"
      />

      <MetadataLocalReleaseList
        :is-opening-local-release="isOpeningLocalRelease"
        :releases="localArtist.releases"
        @open-release="handleOpenLocalRelease"
      />

      <MetadataSelectedReleaseGroupSummary
        v-if="localReleaseGroup"
        :local-release-group="localReleaseGroup"
      />

      <article class="panel-light" v-if="isLoadingReleaseGroup">
        <h3>Loading releases</h3>
        <p>Resolving provider releases for the selected release group and matching them to local data.</p>
      </article>

      <MetadataProviderReleaseList
        v-if="localReleaseGroup"
        :error-message="releaseActionError"
        :is-importing-release="isImportingRelease"
        :local-releases="localReleaseGroup.releases"
        :provider-releases="providerReleases"
        @import-release="importRelease"
      />

      <MetadataReleaseDetail v-if="localRelease" :local-release="localRelease" />
    </template>
  </section>
</template>