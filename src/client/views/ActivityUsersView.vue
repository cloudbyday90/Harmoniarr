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
import { computed } from 'vue';
import { fetchUsers } from '../lib/users-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';
import {
  formatAuthProvider,
  formatUserCountLabel,
  formatUserRole,
  formatUserRoleTone,
} from '../lib/settings-users-presentation.js';
import { formatOperationTimestamp } from '../lib/operation-run-presentation.js';

const {
  data: users,
  errorMessage,
  isLoading,
  load,
} = useAsyncResource({
  fetcher: () => fetchUsers(),
  project: (payload) => (Array.isArray(payload?.users) ? payload.users : []),
  initialData: [],
  fallbackErrorMessage: 'Failed to load users',
});

const userCount = computed(() => users.value?.length ?? 0);
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Users</h2>
        <p class="hx-page-subtitle">
          {{ formatUserCountLabel(userCount) }}.
          Source-side Soulseek peers will land in a future release.
        </p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="errorMessage" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>
    </article>

    <article class="hx-card">
      <div class="hx-card-body is-flush">
        <div v-if="isLoading && !userCount" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!userCount" class="hx-empty">
          <p class="hx-empty-title">No application users</p>
          <p class="hx-empty-copy">Add users from the Settings workspace.</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Auth provider</th>
                <th>Email</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.username }}</td>
                <td><span class="hx-pill" :data-tone="formatUserRoleTone(user.role)">{{ formatUserRole(user.role) }}</span></td>
                <td>{{ formatAuthProvider(user.authProvider) }}</td>
                <td>{{ user.email ?? '—' }}</td>
                <td>
                  <span v-if="user.isDisabled" class="hx-pill" data-tone="danger">Disabled</span>
                  <span v-else class="hx-pill" data-tone="success">Active</span>
                </td>
                <td>{{ user.lastLoginAt ? formatOperationTimestamp(user.lastLoginAt) : '—' }}</td>
                <td>{{ user.createdAt ? formatOperationTimestamp(user.createdAt) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
