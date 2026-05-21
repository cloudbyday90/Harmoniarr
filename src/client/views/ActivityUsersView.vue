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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import SourceUserTrustDetailPanel from '../components/SourceUserTrustDetailPanel.vue';
import { useSourceUserBulkOperation } from '../composables/useSourceUserBulkOperation.js';
import { useSourceUserTrust } from '../composables/useSourceUserTrust.js';
import { useSourceUserTrustDetail } from '../composables/useSourceUserTrustDetail.js';
import {
  filterSourceUsers,
  formatSourceUserConfidence,
  formatSourceUserCountLabel,
  formatSourceUserEvidence,
  formatSourceUserNotes,
  formatSourceUserReliabilityLabel,
  formatSourceUserReliabilityTone,
  formatSourceUserReviewLabel,
  formatSourceUserReviewTone,
  formatSourceUsername,
  formatSourceUserTrustLabel,
  formatSourceUserTrustTone,
  formatSourceUserUpdatedAt,
  sourceUserTrustFilters,
} from '../lib/source-user-trust-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';

const activeFilter = ref('all');
const query = ref('');
const selectedUsername = ref('');
const selectedBulkUsernames = reactive(new Set());
const bulkAction = ref('');
const bulkReason = ref('');

const {
  checkedAt,
  counts,
  errorMessage,
  isLoading,
  load,
  sourceUsers,
  total,
} = useSourceUserTrust();

const {
  actionErrorMessage,
  checkedAt: detailCheckedAt,
  detail,
  errorMessage: detailErrorMessage,
  isLoading: isLoadingDetail,
  isLoadingMoreHistory,
  isSaving: isSavingDetail,
  load: loadDetail,
  loadMoreHistory,
  saveTrustState,
} = useSourceUserTrustDetail();

const {
  errorMessage: bulkErrorMessage,
  executeBulkBlock,
  executeBulkTrust,
  isExecuting: isExecutingBulk,
  lastResult: bulkLastResult,
  reset: resetBulk,
} = useSourceUserBulkOperation();

const visibleSourceUsers = computed(() => filterSourceUsers(sourceUsers.value, {
  filter: activeFilter.value,
  query: query.value,
}));

const hasBulkSelection = computed(() => selectedBulkUsernames.size > 0);
const bulkSelectionCount = computed(() => selectedBulkUsernames.size);
const bulkActionLabel = computed(() => {
  switch (bulkAction.value) {
    case 'trusted':
      return 'Mark trusted';
    case 'neutral':
      return 'Set neutral';
    case 'block':
      return 'Block';
    default:
      return 'Apply';
  }
});

function toggleBulkSelection(username) {
  if (selectedBulkUsernames.has(username)) {
    selectedBulkUsernames.delete(username);
  } else {
    selectedBulkUsernames.add(username);
  }
}

function toggleAllVisible() {
  const visibleUsernames = visibleSourceUsers.value.map((e) => e.username);
  const allSelected = visibleUsernames.every((u) => selectedBulkUsernames.has(u));

  if (allSelected) {
    for (const u of visibleUsernames) {
      selectedBulkUsernames.delete(u);
    }
  } else {
    for (const u of visibleUsernames) {
      selectedBulkUsernames.add(u);
    }
  }
}

function clearBulkSelection() {
  selectedBulkUsernames.clear();
  bulkAction.value = '';
  bulkReason.value = '';
  resetBulk();
}

async function executeBulkAction() {
  const usernames = Array.from(selectedBulkUsernames);
  if (usernames.length === 0 || !bulkAction.value || !bulkReason.value.trim()) {
    return;
  }

  let result;
  if (bulkAction.value === 'block') {
    result = await executeBulkBlock({ reason: bulkReason.value, usernames });
  } else {
    result = await executeBulkTrust({ reason: bulkReason.value, trustState: bulkAction.value, usernames });
  }

  if (result) {
    await load();
    if (selectedUsername.value) {
      await loadDetail(selectedUsername.value);
    }

    if (result.failed === 0) {
      clearBulkSelection();
    }
  }
}

function setFilter(value) {
  activeFilter.value = value;
}

async function selectSourceUser(username) {
  selectedUsername.value = username;
  await loadDetail(username);
}

async function handleRefresh() {
  await load();
  if (selectedUsername.value) {
    await loadDetail(selectedUsername.value);
  }
}

async function handleSaveTrust(payload) {
  const updatedDetail = await saveTrustState(payload);
  if (!updatedDetail?.username) {
    return;
  }

  await load();
  await loadDetail(updatedDetail.username);
}

async function handleExportHistory(format) {
  if (!selectedUsername.value) {
    return;
  }

  const username = selectedUsername.value;
  const url = `/api/v1/activity/source-users/${encodeURIComponent(username)}/export?format=${format}`;
  const link = document.createElement('a');
  link.href = url;
  link.download = `trust-history-${username.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

watch(
  visibleSourceUsers,
  (entries) => {
    if (entries.length === 0) {
      selectedUsername.value = '';
      void loadDetail('');
      return;
    }

    if (!selectedUsername.value || !entries.some((entry) => entry.username === selectedUsername.value)) {
      void selectSourceUser(entries[0].username);
    }
  },
  { immediate: false },
);

onMounted(() => {
  void load();
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Source Users</h2>
        <p class="hx-page-subtitle">
          {{ formatSourceUserCountLabel(total) }}.
          Explainable peer trust built from operator overrides and recorded delivery evidence.
        </p>
      </div>
      <div class="hx-page-actions">
        <RouterLink :to="{ name: 'activity-blocklist' }" class="hx-btn" data-variant="ghost">
          Manage blocklist
        </RouterLink>
        <button type="button" class="hx-btn" @click="handleRefresh" :disabled="isLoading || isLoadingDetail">
          {{ isLoading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="hx-stat-grid" style="margin-bottom: var(--hx-space-4)">
      <div class="hx-stat">
        <span class="hx-stat-label">SOURCE USERS</span>
        <span class="hx-stat-value">{{ counts.total }}</span>
        <span class="hx-stat-meta">Rows in the trust snapshot</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">NEEDS REVIEW</span>
        <span class="hx-stat-value">{{ counts.needsReview }}</span>
        <span class="hx-stat-meta">Peers with weak delivery evidence</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">BLOCKED</span>
        <span class="hx-stat-value">{{ counts.blocked }}</span>
        <span class="hx-stat-meta">Excluded from future trust decisions</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">WITH EVIDENCE</span>
        <span class="hx-stat-value">{{ counts.withEvidence }}</span>
        <span class="hx-stat-meta">Rows with recorded success or failure counts</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">LAST CHECKED</span>
        <span class="hx-stat-value" style="font-size: var(--hx-text-sm)">{{ checkedAt ? formatOperationTimestampShort(checkedAt) : '—' }}</span>
        <span class="hx-stat-meta">Server read timestamp</span>
      </div>
    </div>

    <div class="source-user-layout">
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Peer trust ledger</h3>
            <p class="hx-card-subtitle">Use raw delivery evidence, explicit operator notes, and clear review states instead of a black-box score.</p>
          </div>
        </header>
        <div class="hx-card-body is-flush">
          <div class="hx-card-body">
            <div class="hx-table-toolbar">
              <span class="hx-table-toolbar-meta">{{ visibleSourceUsers.length }} visible of {{ total }}</span>
            </div>

            <div class="hx-form-row" role="search">
              <div class="hx-field">
                <label class="hx-field-label" for="source-user-filter">Filter source users</label>
                <input
                  id="source-user-filter"
                  v-model="query"
                  class="hx-input"
                  type="search"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
            </div>

            <div class="hx-tabbar-wrap">
              <nav class="hx-tabbar" aria-label="Source user trust filters">
                <button
                  v-for="filterOption in sourceUserTrustFilters"
                  :key="filterOption.value"
                  type="button"
                  class="hx-tab"
                  :class="{ 'router-link-exact-active': activeFilter === filterOption.value }"
                  @click="setFilter(filterOption.value)"
                >
                  {{ filterOption.label }}
                </button>
              </nav>
            </div>
          </div>

          <div v-if="errorMessage" class="hx-card-body">
            <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
          </div>

          <div v-else-if="isLoading && !total" class="hx-card-body">
            <div class="hx-skeleton-stack">
              <span class="hx-skeleton" data-size="lg"></span>
              <span class="hx-skeleton"></span>
              <span class="hx-skeleton"></span>
              <span class="hx-skeleton"></span>
            </div>
          </div>
          <div v-else-if="!total" class="hx-empty">
            <p class="hx-empty-title">No source-user trust records</p>
            <p class="hx-empty-copy">Peers appear here once the trust snapshot contains operator decisions or delivery evidence.</p>
          </div>
          <div v-else-if="!visibleSourceUsers.length" class="hx-empty">
            <p class="hx-empty-title">No matches for this filter</p>
            <p class="hx-empty-copy">Clear the local filter to see the full trust ledger.</p>
          </div>
          <div v-else>
            <div v-if="hasBulkSelection" class="source-user-bulk-bar">
              <span class="source-user-bulk-meta">{{ bulkSelectionCount }} selected</span>
              <div class="source-user-bulk-fields">
                <select v-model="bulkAction" class="hx-select source-user-bulk-select" aria-label="Bulk action">
                  <option value="">Choose action…</option>
                  <option value="trusted">Mark trusted</option>
                  <option value="neutral">Set neutral</option>
                  <option value="block">Block</option>
                </select>
                <input
                  v-model="bulkReason"
                  class="hx-input source-user-bulk-reason"
                  type="text"
                  placeholder="Reason for bulk action"
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
              <div class="source-user-bulk-actions">
                <button
                  type="button"
                  class="hx-btn"
                  data-variant="primary"
                  :disabled="isExecutingBulk || !bulkAction || !bulkReason.trim()"
                  @click="executeBulkAction"
                >
                  {{ isExecutingBulk ? 'Applying…' : bulkActionLabel }}
                </button>
                <button type="button" class="hx-btn" data-variant="ghost" @click="clearBulkSelection" :disabled="isExecutingBulk">
                  Clear
                </button>
              </div>
              <p v-if="bulkErrorMessage" class="source-user-bulk-error">{{ bulkErrorMessage }}</p>
              <p v-if="bulkLastResult && bulkLastResult.failed > 0" class="source-user-bulk-error">
                {{ bulkLastResult.failed }} of {{ bulkLastResult.total }} failed.
              </p>
            </div>
            <div class="hx-table-scroll">
              <table class="hx-table" aria-label="Source user trust ledger">
                <thead>
                  <tr>
                    <th class="source-user-row-check">
                      <input type="checkbox" :checked="visibleSourceUsers.length > 0 && visibleSourceUsers.every((e) => selectedBulkUsernames.has(e.username))" @change="toggleAllVisible" aria-label="Select all visible" />
                    </th>
                    <th>Username</th>
                    <th>Trust</th>
                    <th>Review</th>
                    <th>Reliability</th>
                    <th>Evidence</th>
                    <th>Notes</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in visibleSourceUsers" :key="entry.username" :class="{ 'source-user-row-selected': selectedUsername === entry.username, 'source-user-row-bulk': selectedBulkUsernames.has(entry.username) }">
                    <td class="source-user-row-check">
                      <input type="checkbox" :checked="selectedBulkUsernames.has(entry.username)" @change="toggleBulkSelection(entry.username)" :aria-label="`Select ${entry.username}`" />
                    </td>
                  <td>
                    <strong>{{ formatSourceUsername(entry.username) }}</strong>
                    <div class="hx-text-muted" style="margin-top: var(--hx-space-1)">{{ entry.review.reason }}</div>
                  </td>
                  <td>
                    <span class="hx-pill" :data-tone="formatSourceUserTrustTone(entry.trustState)">
                      {{ formatSourceUserTrustLabel(entry.trustState) }}
                    </span>
                  </td>
                  <td>
                    <span class="hx-pill" :data-tone="formatSourceUserReviewTone(entry.review.state)">
                      {{ formatSourceUserReviewLabel(entry.review.state) }}
                    </span>
                  </td>
                  <td>
                    <span class="hx-pill" :data-tone="formatSourceUserReliabilityTone(entry.reputation.reliability)">
                      {{ formatSourceUserReliabilityLabel(entry.reputation.reliability) }}
                    </span>
                    <div class="hx-text-muted" style="margin-top: var(--hx-space-1)">{{ formatSourceUserConfidence(entry.reputation) }}</div>
                  </td>
                  <td>{{ formatSourceUserEvidence(entry.reputation) }}</td>
                  <td>{{ formatSourceUserNotes(entry) }}</td>
                  <td>{{ formatSourceUserUpdatedAt(entry.updatedAt) }}</td>
                  <td class="source-user-row-action">
                    <button type="button" class="hx-btn" data-variant="ghost" @click="selectSourceUser(entry.username)">
                      {{ selectedUsername === entry.username ? 'Inspecting' : 'Inspect' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <SourceUserTrustDetailPanel
        :action-error-message="actionErrorMessage"
        :checked-at="detailCheckedAt"
        :detail="detail"
        :error-message="detailErrorMessage"
        :is-loading="isLoadingDetail"
        :is-loading-more-history="isLoadingMoreHistory"
        :is-saving="isSavingDetail"
        @export-history="handleExportHistory"
        @load-more-history="loadMoreHistory"
        @save-trust="handleSaveTrust"
      />
    </div>
  </section>
</template>

<style scoped>
.source-user-layout {
  display: grid;
  gap: var(--hx-space-4);
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr);
}

.source-user-row-selected > td {
  background: var(--hx-accent-soft);
}

.source-user-row-selected > td:first-child {
  border-left: 3px solid var(--hx-accent);
}

.source-user-row-bulk > td {
  background: var(--hx-warning-soft, rgba(192, 138, 22, 0.1));
}

.source-user-row-action {
  text-align: right;
  white-space: nowrap;
}

.source-user-row-check {
  width: 40px;
  text-align: center;
}

.source-user-bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3) var(--hx-space-4);
  background: var(--hx-bg-surface-muted);
  border-bottom: 1px solid var(--hx-border-subtle);
}

.source-user-bulk-meta {
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.source-user-bulk-fields {
  display: flex;
  gap: var(--hx-space-2);
  flex: 1;
  min-width: 0;
}

.source-user-bulk-select {
  width: 160px;
  flex-shrink: 0;
}

.source-user-bulk-reason {
  flex: 1;
  min-width: 180px;
}

.source-user-bulk-actions {
  display: flex;
  gap: var(--hx-space-2);
}

.source-user-bulk-error {
  width: 100%;
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
}

@media (max-width: 1040px) {
  .source-user-layout {
    grid-template-columns: 1fr;
  }
}
</style>
