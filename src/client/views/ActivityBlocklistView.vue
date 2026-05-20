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
import { computed, onMounted, reactive, ref } from 'vue';
import { useSourceUserBlocklist } from '../composables/useSourceUserBlocklist.js';
import {
  filterBlockedSourceUsers,
  formatBlockReason,
  formatBlockedAt,
  formatBlockedByUser,
  formatBlockedUserCountLabel,
  formatOperatorNotes,
  formatSourceUsername,
} from '../lib/source-user-blocklist-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';

const blockForm = reactive({
  operatorNotes: '',
  reason: '',
  username: '',
});
const filterQuery = ref('');

const {
  actionErrorMessage,
  blockedCount,
  blocklist,
  blockUser,
  checkedAt,
  errorMessage,
  isBlocking,
  isLoading,
  isUnblocking,
  load,
  pendingUsername,
  total,
  unblockUser,
} = useSourceUserBlocklist();

const visibleEntries = computed(() => filterBlockedSourceUsers(blocklist.value, filterQuery.value));

async function handleRefresh() {
  await load();
}

async function handleSubmit() {
  const didBlock = await blockUser({
    operatorNotes: blockForm.operatorNotes,
    reason: blockForm.reason,
    username: blockForm.username,
  });

  if (!didBlock) {
    return;
  }

  blockForm.operatorNotes = '';
  blockForm.reason = '';
  blockForm.username = '';
}

async function handleUnblock(username) {
  await unblockUser(username);
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Blocklist</h2>
        <p class="hx-page-subtitle">
          {{ formatBlockedUserCountLabel(total) }}.
          Blocked source users are excluded from operator review and future trust decisions.
        </p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="handleRefresh" :disabled="isLoading">
          {{ isLoading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="hx-stat-grid" style="margin-bottom: var(--hx-space-4)">
      <div class="hx-stat">
        <span class="hx-stat-label">BLOCKED USERS</span>
        <span class="hx-stat-value">{{ blockedCount }}</span>
        <span class="hx-stat-meta">Current active exclusions</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">VISIBLE ROWS</span>
        <span class="hx-stat-value">{{ visibleEntries.length }}</span>
        <span class="hx-stat-meta">After local filter</span>
      </div>
      <div class="hx-stat">
        <span class="hx-stat-label">LAST CHECKED</span>
        <span class="hx-stat-value" style="font-size: var(--hx-text-sm)">{{ checkedAt ? formatOperationTimestampShort(checkedAt) : '—' }}</span>
        <span class="hx-stat-meta">Server read timestamp</span>
      </div>
    </div>

    <div class="cfg-2col">
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Block source user</h3>
            <p class="hx-card-subtitle">Use explicit reasons so future operators understand why a peer is excluded.</p>
          </div>
        </header>

        <form class="hx-card-body" @submit.prevent="handleSubmit">
          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label" for="blocklist-username">Soulseek username</label>
              <input
                id="blocklist-username"
                v-model="blockForm.username"
                class="hx-input"
                type="text"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label" for="blocklist-reason">Exclusion reason</label>
              <input
                id="blocklist-reason"
                v-model="blockForm.reason"
                class="hx-input"
                type="text"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label" for="blocklist-notes">Operator notes</label>
              <textarea
                id="blocklist-notes"
                v-model="blockForm.operatorNotes"
                class="hx-textarea"
                rows="4"
              ></textarea>
            </div>
          </div>

          <p v-if="actionErrorMessage" class="hx-text-sm" style="color: var(--hx-danger)">{{ actionErrorMessage }}</p>

          <div class="hx-card-actions">
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="isBlocking"
            >
              {{ isBlocking ? 'Blocking…' : 'Block user' }}
            </button>
          </div>
        </form>
      </article>

      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Current exclusions</h3>
            <p class="hx-card-subtitle">Static table with explicit row actions for administrators.</p>
          </div>
        </header>

        <div class="hx-card-body is-flush">
          <div class="hx-card-body" role="search">
            <div class="hx-field">
              <label class="hx-field-label" for="blocklist-filter">Filter blocked users</label>
              <input
                id="blocklist-filter"
                v-model="filterQuery"
                class="hx-input"
                type="search"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>

          <div v-if="errorMessage" class="hx-card-body">
            <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
          </div>

          <div v-else-if="isLoading && !blocklist.length" class="hx-card-body">
            <div class="hx-skeleton-stack">
              <span class="hx-skeleton" data-size="lg"></span>
              <span class="hx-skeleton"></span>
              <span class="hx-skeleton"></span>
              <span class="hx-skeleton"></span>
            </div>
          </div>

          <div v-else-if="!blocklist.length" class="hx-empty">
            <p class="hx-empty-title">No blocked source users</p>
            <p class="hx-empty-copy">Blocked peers will appear here with the operator reason and notes.</p>
          </div>

          <div v-else-if="!visibleEntries.length" class="hx-empty">
            <p class="hx-empty-title">No matches for this filter</p>
            <p class="hx-empty-copy">Clear the local filter to see all blocked users.</p>
          </div>

          <div v-else class="hx-table-scroll">
            <table class="hx-table" aria-label="Blocked source users">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Reason</th>
                  <th>Notes</th>
                  <th>Blocked</th>
                  <th>By</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in visibleEntries" :key="entry.username">
                  <td>
                    <strong>{{ formatSourceUsername(entry.username) }}</strong>
                  </td>
                  <td>{{ formatBlockReason(entry.blockReason) }}</td>
                  <td>{{ formatOperatorNotes(entry.operatorNotes) }}</td>
                  <td>{{ formatBlockedAt(entry.blockedAt) }}</td>
                  <td>{{ formatBlockedByUser(entry.blockedByUserId) }}</td>
                  <td>
                    <span class="hx-pill" data-tone="danger">Blocked</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      class="hx-btn"
                      data-variant="ghost"
                      :disabled="isUnblocking && pendingUsername === entry.username"
                      @click="handleUnblock(entry.username)"
                    >
                      {{ isUnblocking && pendingUsername === entry.username ? 'Removing…' : 'Remove block' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
