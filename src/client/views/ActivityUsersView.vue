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
import { onMounted, ref } from 'vue';
import { fetchUsers } from '../lib/users-api.js';

const isLoading = ref(true);
const errorMessage = ref('');
const users = ref([]);

function roleTone(role) {
  if (role === 'admin' || role === 'owner') return 'warning';
  if (role === 'requester') return 'info';
  return undefined;
}

async function load() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const payload = await fetchUsers();
    users.value = Array.isArray(payload?.users) ? payload.users : [];
  } catch (error) {
    errorMessage.value = error?.message ?? 'Failed to load users';
    users.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Users</h2>
        <p class="hx-page-subtitle">
          {{ users.length }} application user{{ users.length === 1 ? '' : 's' }}.
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
        <div v-if="!users.length && !isLoading" class="hx-empty">
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
                <td><span class="hx-pill" :data-tone="roleTone(user.role)">{{ user.role }}</span></td>
                <td>{{ user.authProvider ?? 'local' }}</td>
                <td>{{ user.email ?? '—' }}</td>
                <td>
                  <span v-if="user.isDisabled" class="hx-pill" data-tone="danger">Disabled</span>
                  <span v-else class="hx-pill" data-tone="success">Active</span>
                </td>
                <td>{{ user.lastLoginAt ?? '—' }}</td>
                <td>{{ user.createdAt ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
