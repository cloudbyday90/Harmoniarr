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
import { computed, onMounted, ref } from 'vue';
import { useSourceUserTrust } from '../composables/useSourceUserTrust.js';
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

const {
  checkedAt,
  counts,
  errorMessage,
  isLoading,
  load,
  sourceUsers,
  total,
} = useSourceUserTrust();

const visibleSourceUsers = computed(() => filterSourceUsers(sourceUsers.value, {
  filter: activeFilter.value,
  query: query.value,
}));

function setFilter(value) {
  activeFilter.value = value;
}

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
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
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
        <div v-else class="hx-table-scroll">
          <table class="hx-table" aria-label="Source user trust ledger">
            <thead>
              <tr>
                <th>Username</th>
                <th>Trust</th>
                <th>Review</th>
                <th>Reliability</th>
                <th>Evidence</th>
                <th>Notes</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in visibleSourceUsers" :key="entry.username">
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
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
