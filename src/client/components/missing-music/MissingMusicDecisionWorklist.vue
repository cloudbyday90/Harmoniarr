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
import { computed, reactive } from 'vue';
import { useMissingMusicDecisions } from '../../composables/useMissingMusicDecisions.js';
import {
  buildMissingMusicDecisionRow,
  buildMissingMusicStatusAnnouncement,
  createMissingMusicDecisionFilters,
  DEFAULT_MISSING_MUSIC_DECISION_FILTERS,
  MISSING_MUSIC_ACCOUNT_STATUS_OPTIONS,
  MISSING_MUSIC_WORK_STATE_OPTIONS,
  splitMissingMusicUsers,
} from '../../lib/missing-music-worklist-presentation.js';

const decisionResource = useMissingMusicDecisions();
const draftFilters = reactive(createMissingMusicDecisionFilters());

const rows = computed(() => decisionResource.decisions.value.map(buildMissingMusicDecisionRow));
const usersByAccountStatus = computed(() => splitMissingMusicUsers(decisionResource.users.value));
const isAdministratorScope = computed(() => decisionResource.scope.value === 'all');
const statusAnnouncement = computed(() => buildMissingMusicStatusAnnouncement({
  decisions: decisionResource.decisions.value,
  filters: decisionResource.filters.value,
  page: decisionResource.page.value,
  scope: decisionResource.scope.value,
}));
const hasActiveFilters = computed(() => (
  draftFilters.accountStatus !== DEFAULT_MISSING_MUSIC_DECISION_FILTERS.accountStatus
  || draftFilters.q !== DEFAULT_MISSING_MUSIC_DECISION_FILTERS.q
  || draftFilters.requestedForUserId !== DEFAULT_MISSING_MUSIC_DECISION_FILTERS.requestedForUserId
  || draftFilters.state !== DEFAULT_MISSING_MUSIC_DECISION_FILTERS.state
));
const userFilterLabel = computed(() => {
  if (draftFilters.accountStatus === 'disabled') return 'All disabled accounts';
  if (draftFilters.accountStatus === 'all') return 'All accounts';
  return 'All active accounts';
});

async function applyFilters() {
  await decisionResource.applyFilters({ ...draftFilters });
}

function applySelectFilters() {
  void applyFilters();
}

function handleAccountStatusChange() {
  draftFilters.requestedForUserId = '';
  applySelectFilters();
}

function resetFilters() {
  Object.assign(draftFilters, createMissingMusicDecisionFilters());
  void applyFilters();
}

function getDetailAccessibleLabel(row) {
  return 'Open status details for ' + row.artistName + ' — ' + row.title;
}

defineExpose({
  refresh: decisionResource.refresh,
});
</script>

<template>
  <article class="hx-card missing-music-worklist">
    <header class="hx-card-header">
      <div>
        <h2 class="hx-card-title">Release decisions</h2>
        <p class="hx-card-subtitle">
          See what Harmoniarr is doing and the next clear step for each missing release.
        </p>
      </div>
      <div class="hx-card-actions">
        <button
          type="button"
          class="hx-btn"
          :disabled="decisionResource.isLoading.value || decisionResource.isRevalidating.value"
          @click="decisionResource.refresh"
        >
          {{ decisionResource.isRevalidating.value ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <form class="missing-music-worklist__filter-form" @submit.prevent="applyFilters">
      <fieldset class="missing-music-worklist__filters">
        <legend>Filter releases</legend>
        <div class="missing-music-worklist__filter-grid">
          <div v-if="isAdministratorScope" class="hx-field">
            <label class="hx-field-label" for="missing-music-user">User</label>
            <select
              id="missing-music-user"
              v-model="draftFilters.requestedForUserId"
              class="hx-select"
              @change="applySelectFilters"
            >
              <option value="">{{ userFilterLabel }}</option>
              <optgroup v-if="usersByAccountStatus.active.length" label="Active accounts">
                <option v-for="user in usersByAccountStatus.active" :key="user.id" :value="user.id">
                  {{ user.username }}
                </option>
              </optgroup>
              <optgroup v-if="usersByAccountStatus.disabled.length" label="Disabled account history">
                <option v-for="user in usersByAccountStatus.disabled" :key="user.id" :value="user.id">
                  {{ user.username }}
                </option>
              </optgroup>
            </select>
          </div>

          <div class="hx-field">
            <label class="hx-field-label" for="missing-music-account-status">Account status</label>
            <select
              id="missing-music-account-status"
              v-model="draftFilters.accountStatus"
              class="hx-select"
              @change="handleAccountStatusChange"
            >
              <option v-for="option in MISSING_MUSIC_ACCOUNT_STATUS_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="hx-field">
            <label class="hx-field-label" for="missing-music-work-state">Work state</label>
            <select
              id="missing-music-work-state"
              v-model="draftFilters.state"
              class="hx-select"
              @change="applySelectFilters"
            >
              <option v-for="option in MISSING_MUSIC_WORK_STATE_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="hx-field missing-music-worklist__search-field">
            <label class="hx-field-label" for="missing-music-search">Search releases</label>
            <input
              id="missing-music-search"
              v-model="draftFilters.q"
              class="hx-input"
              type="search"
              maxlength="120"
              placeholder="Artist or release"
            >
          </div>
        </div>
        <div class="missing-music-worklist__filter-actions">
          <button type="submit" class="hx-btn" data-variant="primary">Apply filters</button>
          <button v-if="hasActiveFilters" type="button" class="hx-btn" data-variant="ghost" @click="resetFilters">
            Clear filters
          </button>
        </div>
      </fieldset>
    </form>

    <p class="missing-music-worklist__status" role="status" aria-atomic="true">
      {{ statusAnnouncement }}
    </p>

    <div v-if="decisionResource.errorMessage.value" class="hx-alert" data-tone="danger">
      {{ decisionResource.errorMessage.value }}
    </div>

    <div v-if="decisionResource.page.value.sourceLimitReached" class="hx-alert" data-tone="warning">
      Refine the filters to see a complete result. Harmoniarr reached this worklist's safe result limit.
    </div>

    <div v-if="decisionResource.isLoading.value" class="hx-card-body">
      <div class="hx-skeleton-stack" aria-label="Loading release decisions">
        <span v-for="index in 4" :key="index" class="hx-skeleton" />
      </div>
    </div>

    <div v-else-if="rows.length === 0" class="hx-card-body">
      <div class="hx-empty">
        <h3 class="hx-empty-title">No releases match these filters</h3>
        <p class="hx-empty-copy">Try another state or account status, or clear the filters.</p>
      </div>
    </div>

    <ul v-else class="missing-music-worklist__rows" aria-label="Missing Music release decisions">
      <li v-for="row in rows" :key="row.decisionId">
        <article class="missing-music-worklist__row" :data-tone="row.statusTone">
          <div class="missing-music-worklist__row-heading">
            <div>
              <h3>
                <RouterLink
                  v-if="row.decisionId"
                  class="missing-music-worklist__detail-link"
                  :aria-label="getDetailAccessibleLabel(row)"
                  :to="{ name: 'missing-decision', params: { decisionId: row.decisionId } }"
                >
                  {{ row.title }}
                </RouterLink>
                <template v-else>{{ row.title }}</template>
              </h3>
              <p>{{ row.artistName }}<template v-if="row.releaseMeta"> · {{ row.releaseMeta }}</template></p>
            </div>
            <span class="hx-pill" :data-tone="row.statusTone">{{ row.statusLabel }}</span>
          </div>

          <dl class="missing-music-worklist__facts">
            <div>
              <dt>For</dt>
              <dd>{{ row.targetUserLabel }}</dd>
            </div>
            <div>
              <dt>Library coverage</dt>
              <dd>{{ row.coverage }}</dd>
            </div>
            <div v-if="row.isReadOnly">
              <dt>Account</dt>
              <dd>Disabled — history only</dd>
            </div>
          </dl>

          <p class="missing-music-worklist__message">{{ row.statusMessage }}</p>
          <p class="missing-music-worklist__next-step"><strong>Next step:</strong> {{ row.nextStep }}</p>
        </article>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.missing-music-worklist {
  display: grid;
  gap: var(--hx-space-4);
}

.missing-music-worklist__filter-form {
  padding-inline: var(--hx-space-5);
}

.missing-music-worklist__filters {
  min-inline-size: 0;
  margin: 0;
  padding: var(--hx-space-4);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
}

.missing-music-worklist__filters legend {
  padding-inline: var(--hx-space-1);
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.missing-music-worklist__filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--hx-space-3);
}

.missing-music-worklist__search-field {
  min-inline-size: 0;
}

.missing-music-worklist__search-field .hx-input,
.missing-music-worklist .hx-select {
  inline-size: 100%;
}

.missing-music-worklist__filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-3);
}

.missing-music-worklist__status {
  margin: 0;
  padding-inline: var(--hx-space-5);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.missing-music-worklist .hx-alert {
  margin-inline: var(--hx-space-5);
}

.missing-music-worklist__rows {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--hx-border);
  list-style: none;
}

.missing-music-worklist__row {
  display: grid;
  gap: var(--hx-space-2);
  padding: var(--hx-space-4) var(--hx-space-5);
  border-bottom: 1px solid var(--hx-border);
  border-left: 3px solid var(--hx-text-faint);
}

.missing-music-worklist__row[data-tone='success'] { border-left-color: var(--hx-success); }
.missing-music-worklist__row[data-tone='warning'] { border-left-color: var(--hx-warning); }
.missing-music-worklist__row[data-tone='danger'] { border-left-color: var(--hx-danger); }
.missing-music-worklist__row[data-tone='info'] { border-left-color: var(--hx-info); }

.missing-music-worklist__row-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.missing-music-worklist__row h3,
.missing-music-worklist__row p {
  margin: 0;
}

.missing-music-worklist__row h3 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}

.missing-music-worklist__detail-link {
  color: inherit;
  text-decoration-color: transparent;
}

.missing-music-worklist__detail-link:hover {
  color: var(--hx-accent);
  text-decoration-color: currentColor;
}

.missing-music-worklist__row-heading p,
.missing-music-worklist__message,
.missing-music-worklist__facts {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.missing-music-worklist__row-heading p {
  margin-top: var(--hx-space-1);
}

.missing-music-worklist__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-3);
  margin: 0;
}

.missing-music-worklist__facts div {
  display: flex;
  gap: var(--hx-space-1);
}

.missing-music-worklist__facts dt::after {
  content: ':';
}

.missing-music-worklist__facts dd {
  margin: 0;
  color: var(--hx-text);
}

.missing-music-worklist__next-step {
  padding-left: var(--hx-space-2);
  border-left: 2px solid var(--hx-accent);
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

@media (max-width: 960px) {
  .missing-music-worklist__filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .missing-music-worklist__filter-form,
  .missing-music-worklist__status {
    padding-inline: var(--hx-space-3);
  }

  .missing-music-worklist .hx-alert {
    margin-inline: var(--hx-space-3);
  }

  .missing-music-worklist__filter-grid {
    grid-template-columns: 1fr;
  }

  .missing-music-worklist__row {
    padding-inline: var(--hx-space-3);
  }

  .missing-music-worklist__row-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
