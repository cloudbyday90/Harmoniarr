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
import { computed, ref } from 'vue';
import {
  buildMusicQueueMatchReview,
  buildMusicQueueReleaseTypeFilters,
  filterMusicQueueReleases,
  MUSIC_QUEUE_STATE_FILTERS,
} from '../lib/acquisition-pipeline-presentation.js';
import { useMusicQueue } from '../composables/useMusicQueue.js';

const {
  errorMessage,
  isLoading,
  isRevalidating,
  load,
  releases,
  summaryCards,
  totalCount,
} = useMusicQueue();

const query = ref('');
const selectedState = ref('all');
const selectedReleaseType = ref('all');
const selectedReleaseId = ref(null);

const releaseTypeFilters = computed(() => buildMusicQueueReleaseTypeFilters(releases.value));
const filteredReleases = computed(() => filterMusicQueueReleases(releases.value, {
  query: query.value,
  releaseType: selectedReleaseType.value,
  state: selectedState.value,
}));
const selectedRelease = computed(() => (
  filteredReleases.value.find((release) => release.id === selectedReleaseId.value)
  ?? releases.value.find((release) => release.id === selectedReleaseId.value)
  ?? null
));
const matchReview = computed(() => buildMusicQueueMatchReview(selectedRelease.value));

function openReview(release) {
  selectedReleaseId.value = release.id;
}

function closeReview() {
  selectedReleaseId.value = null;
}
</script>

<template>
  <section class="music-queue-view">
    <header class="music-queue-header">
      <div>
        <p class="hx-eyebrow">Music Queue</p>
        <h1>Music Queue</h1>
        <p class="music-queue-copy">
          Releases Harmoniarr is searching, downloading, checking, and adding to your library. If automation stops, the row explains why and shows the next action.
        </p>
      </div>
      <button type="button" class="hx-btn" :disabled="isRevalidating" @click="load">
        {{ isRevalidating ? 'Refreshing...' : 'Refresh' }}
      </button>
    </header>

    <div class="music-queue-summary">
      <article v-for="card in summaryCards" :key="card.key" class="music-queue-summary-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <div v-if="errorMessage" class="hx-alert" data-tone="danger">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="music-queue-panel">
      Loading Music Queue...
    </div>

    <div v-else-if="!releases.length" class="music-queue-panel music-queue-empty">
      <h2>Nothing is queued right now</h2>
      <p>Monitored artists and requested releases will appear here when Harmoniarr has music to look for.</p>
    </div>

    <div v-else class="music-queue-layout">
      <div class="music-queue-panel">
        <div class="music-queue-panel-header">
          <div>
            <h2>Queued music</h2>
            <span>{{ filteredReleases.length }} of {{ totalCount }} release{{ totalCount === 1 ? '' : 's' }}</span>
          </div>
          <div class="music-queue-filters" aria-label="Music Queue filters">
            <label class="music-queue-filter">
              <span>Search</span>
              <input v-model="query" class="hx-input" type="search" placeholder="Artist or release" />
            </label>
            <label class="music-queue-filter">
              <span>State</span>
              <select v-model="selectedState" class="hx-select">
                <option v-for="filter in MUSIC_QUEUE_STATE_FILTERS" :key="filter.value" :value="filter.value">
                  {{ filter.label }}
                </option>
              </select>
            </label>
            <label class="music-queue-filter">
              <span>Type</span>
              <select v-model="selectedReleaseType" class="hx-select">
                <option v-for="filter in releaseTypeFilters" :key="filter.value" :value="filter.value">
                  {{ filter.label }}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div v-if="!filteredReleases.length" class="music-queue-empty-inline">
          No releases match these filters.
        </div>

        <div v-else class="music-queue-list" role="list">
          <article
            v-for="release in filteredReleases"
            :key="release.id"
            class="music-queue-row"
            :class="{ 'is-selected': selectedReleaseId === release.id }"
            role="listitem"
          >
            <div class="music-queue-row-main">
              <span class="review-status-pill" :class="release.statusClass">{{ release.status.label }}</span>
              <div>
                <h3>{{ release.releaseTitle }}</h3>
                <p>
                  {{ release.artistName }}
                  <span aria-hidden="true">·</span>
                  {{ release.releaseTypeLabel }}<template v-if="release.releaseYear"> · {{ release.releaseYear }}</template>
                </p>
              </div>
              <div class="music-queue-chip-row" aria-label="Release progress">
                <span v-for="chip in release.progressChips" :key="chip" class="hx-pill">{{ chip }}</span>
              </div>
            </div>

            <div class="music-queue-row-detail">
              <strong>{{ release.detailText }}</strong>
              <span>Last activity: {{ release.lastActivityLabel }}</span>
              <span>{{ release.qualityDecisionLabel }}</span>
              <div class="music-queue-row-actions">
                <button
                  v-if="release.action.type === 'review'"
                  type="button"
                  class="hx-btn"
                  data-variant="primary"
                  :aria-expanded="selectedReleaseId === release.id"
                  @click="openReview(release)"
                >
                  {{ release.action.label }}
                </button>
                <RouterLink
                  v-else
                  class="hx-btn"
                  data-variant="primary"
                  :to="{ name: release.action.routeName }"
                >
                  {{ release.action.label }}
                </RouterLink>
                <button type="button" class="hx-btn" data-variant="ghost" @click="openReview(release)">
                  Details
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <aside class="music-queue-review" aria-label="Music Queue details">
        <div v-if="!matchReview" class="music-queue-review-empty">
          <h2>Select a release</h2>
          <p>Open details to see why Harmoniarr stopped, which matches were found, and how the quality profile was evaluated.</p>
        </div>
        <div v-else>
          <div class="music-queue-review-header">
            <div>
              <p class="hx-eyebrow">Review</p>
              <h2>{{ matchReview.heading }}</h2>
            </div>
            <button type="button" class="hx-btn" data-variant="ghost" @click="closeReview">Close</button>
          </div>

          <section class="music-queue-review-section">
            <h3>Why it stopped</h3>
            <p>{{ matchReview.reason }}</p>
            <span class="review-status-pill" :class="selectedRelease.statusClass">{{ matchReview.statusLabel }}</span>
          </section>

          <section class="music-queue-review-section">
            <h3>Matches</h3>
            <dl class="music-queue-detail-grid">
              <template v-for="row in matchReview.matchRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </section>

          <section class="music-queue-review-section">
            <h3>Quality</h3>
            <dl class="music-queue-detail-grid">
              <template v-for="row in matchReview.qualityRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </section>

          <div class="music-queue-review-actions">
            <RouterLink
              v-if="matchReview.action?.type === 'route'"
              class="hx-btn"
              data-variant="primary"
              :to="{ name: matchReview.action.routeName }"
            >
              {{ matchReview.action.label }}
            </RouterLink>
            <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'activity-candidates' }">
              Advanced diagnostics
            </RouterLink>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.music-queue-view {
  display: grid;
  gap: 24px;
  padding: 32px clamp(18px, 4vw, 48px);
}

.music-queue-header,
.music-queue-row {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.music-queue-header h1 {
  margin: 0;
}

.music-queue-copy,
.music-queue-panel-header span,
.music-queue-row p,
.music-queue-row-detail span,
.music-queue-empty p {
  color: var(--hx-text-muted);
}

.music-queue-summary {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.music-queue-summary-card,
.music-queue-panel {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: 8px;
}

.music-queue-summary-card {
  display: grid;
  gap: 10px;
  padding: 18px;
}

.music-queue-summary-card span {
  color: var(--hx-text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-queue-summary-card strong {
  font-size: 32px;
}

.music-queue-layout {
  align-items: start;
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
}

.music-queue-panel {
  padding: 20px;
}

.music-queue-panel-header {
  align-items: end;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.music-queue-panel-header h2,
.music-queue-review-header h2 {
  margin: 0;
}

.music-queue-filters {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.music-queue-filter {
  display: grid;
  gap: 4px;
}

.music-queue-filter span {
  color: var(--hx-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-queue-list {
  display: grid;
}

.music-queue-row {
  border-top: 1px solid var(--hx-border);
  padding: 18px 0;
}

.music-queue-row.is-selected {
  background: var(--hx-accent-soft);
  margin-inline: -12px;
  padding-inline: 12px;
}

.music-queue-row:first-child {
  border-top: 0;
}

.music-queue-row-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.music-queue-row-main h3,
.music-queue-row-main p {
  margin: 0;
}

.music-queue-chip-row,
.music-queue-row-actions,
.music-queue-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.music-queue-row-detail {
  display: grid;
  gap: 6px;
  max-width: 360px;
  text-align: right;
}

.music-queue-empty,
.music-queue-empty-inline,
.music-queue-review-empty {
  padding: 48px 20px;
  text-align: center;
}

.music-queue-review {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: 8px;
  padding: 20px;
  position: sticky;
  top: 76px;
}

.music-queue-review-header {
  align-items: start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.music-queue-review-section {
  border-top: 1px solid var(--hx-border);
  display: grid;
  gap: 10px;
  margin-top: 18px;
  padding-top: 18px;
}

.music-queue-review-section h3,
.music-queue-review-section p {
  margin: 0;
}

.music-queue-detail-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(120px, auto) 1fr;
  margin: 0;
}

.music-queue-detail-grid dt {
  color: var(--hx-text-muted);
}

.music-queue-detail-grid dd {
  margin: 0;
  text-align: right;
}

.music-queue-review-actions {
  border-top: 1px solid var(--hx-border);
  margin-top: 18px;
  padding-top: 18px;
}

@media (max-width: 720px) {
  .music-queue-header,
  .music-queue-panel-header,
  .music-queue-row {
    align-items: stretch;
    flex-direction: column;
  }

  .music-queue-row-detail {
    max-width: none;
    text-align: left;
  }

  .music-queue-layout {
    grid-template-columns: 1fr;
  }

  .music-queue-review {
    position: static;
  }
}
</style>
