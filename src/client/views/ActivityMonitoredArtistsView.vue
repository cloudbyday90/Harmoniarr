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
import ActivityResourceState from '../components/activity/ActivityResourceState.vue';
import { useAdminMonitoredArtists } from '../composables/useAdminMonitoredArtists.js';

const {
  artists,
  errorMessage,
  isLoading,
  isRevalidating,
  load,
  search,
  sort,
  total,
} = useAdminMonitoredArtists({
  pollIntervalMs: 30000,
  revalidateOnFocus: true,
});

function applySearch() {
  void load();
}

function applySort(event) {
  sort.value = event.target.value;
  void load();
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString(); } catch { return ts; }
}

function formatReleaseTypes(types) {
  if (!Array.isArray(types) || types.length === 0) return 'album, ep';
  return types.join(', ');
}

const hasSearchQuery = computed(() => search.value.trim().length > 0);

onMounted(() => {
  void load();
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Monitored Artists</h2>
        <p class="hx-page-subtitle">{{ total }} artist{{ total === 1 ? '' : 's' }} monitored for new releases.</p>
      </div>
      <div class="hx-page-actions">
        <span v-if="isRevalidating" class="ama-revalidating" aria-label="Refreshing">↻</span>
      </div>
    </header>

    <div class="hx-stat-grid" v-if="total > 0">
      <article class="hx-stat-card">
        <span class="hx-stat-label">Total monitored</span>
        <span class="hx-stat-value">{{ total }}</span>
      </article>
    </div>

    <div class="ama-controls">
      <input
        class="hx-input"
        type="search"
        placeholder="Search artists..."
        v-model="search"
        @search="applySearch"
        @keydown.enter="applySearch"
      />
      <select class="hx-select" :value="sort" @change="applySort">
        <option value="name">Name A–Z</option>
        <option value="name_desc">Name Z–A</option>
        <option value="monitored_at">Recently monitored</option>
        <option value="last_refreshed">Last refreshed</option>
        <option value="country">Country</option>
      </select>
    </div>

    <ActivityResourceState
      v-if="errorMessage"
      state="error"
      title="Could not load monitored artists"
      description="Monitored artists may be temporarily unavailable. Try again to refresh the list."
      action-label="Try again"
      :compact="artists.length > 0"
      @action="load"
    />

    <template v-if="!errorMessage || artists.length > 0">
      <ActivityResourceState
        v-if="isLoading"
        state="loading"
        title="Loading monitored artists..."
        :skeleton-lines="3"
      />

      <ActivityResourceState
        v-else-if="artists.length === 0"
        state="empty"
        :title="hasSearchQuery ? 'No matching monitored artists' : 'No monitored artists'"
        :description="hasSearchQuery
          ? 'Clear your search or try another artist name.'
          : 'Artists monitored for new releases will appear here.'"
      />

      <article v-else class="hx-card">
        <div class="hx-card-body is-flush">
          <div class="hx-table-scroll">
            <table class="hx-table">
              <thead>
                <tr>
                  <th scope="col">Artist</th>
                  <th scope="col">Type</th>
                  <th scope="col">Country</th>
                  <th scope="col">Monitored by</th>
                  <th scope="col">Release types</th>
                  <th scope="col">Last refreshed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="artist in artists" :key="artist.localId">
                  <td>
                    <RouterLink :to="{ name: 'artist-detail', params: { mbid: artist.id } }" class="ama-artist-link">
                      {{ artist.name }}
                    </RouterLink>
                    <span v-if="artist.disambiguation" class="ama-disambig">({{ artist.disambiguation }})</span>
                  </td>
                  <td>{{ artist.artistType }}</td>
                  <td>{{ artist.country }}</td>
                  <td>{{ artist.monitoredByUsername ?? '—' }}</td>
                  <td>{{ formatReleaseTypes(artist.monitoredReleaseGroupTypes) }}</td>
                  <td>{{ formatTimestamp(artist.lastRefreshedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.ama-revalidating {
  display: inline-block;
  animation: hx-spin 1s linear infinite;
  color: var(--hx-text-muted);
}

@keyframes hx-spin {
  to { transform: rotate(360deg); }
}

.ama-controls {
  display: flex;
  gap: var(--hx-space-3);
  align-items: center;
  flex-wrap: wrap;
}

.ama-controls .hx-input {
  flex: 1;
  min-width: 200px;
}

.ama-controls .hx-select {
  min-width: 180px;
}

.ama-artist-link {
  font-weight: 500;
  color: var(--hx-text-primary);
  text-decoration: none;
}

.ama-artist-link:hover {
  text-decoration: underline;
}

.ama-disambig {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  margin-left: var(--hx-space-1);
}
</style>
