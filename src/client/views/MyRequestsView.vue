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
import { onMounted } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import RequestCard from '../components/media/RequestCard.vue';
import { useMyRequests } from '../composables/useMyRequests.js';

const { errorMessage, hasRequests, isLoading, loadRequests, requests } = useMyRequests({ limit: 50 });

onMounted(() => {
  void loadRequests();
});
</script>

<template>
  <section class="hx-page my-requests">

    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">My Requests</h1>
        <p class="hx-page-subtitle">Track the music you've asked Harmoniarr to find.</p>
      </div>
    </header>

    <!-- Loading state -->
    <p
      v-if="isLoading && !hasRequests"
      class="my-requests-loading"
      aria-live="polite"
      aria-busy="true"
    >
      Loading your requests…
    </p>

    <!-- Error state -->
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      body="Check your connection and try refreshing the page."
    />

    <!-- Empty state — no requests yet -->
    <EmptyState
      v-else-if="!isLoading && !hasRequests"
      title="No requests yet"
      body="Search for music and request releases you want Harmoniarr to find."
      cta-label="Search music"
      :cta-to="{ name: 'search' }"
    />

    <!-- Populated state — artwork-first request grid -->
    <section
      v-else
      class="hx-artwork-grid my-requests-grid"
      aria-label="Your requests"
    >
      <RequestCard
        v-for="request in requests"
        :key="request.id"
        :request="request"
      />
    </section>

  </section>
</template>

<style scoped>
.my-requests {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.my-requests-loading {
  text-align: center;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  padding: var(--hx-space-6) 0;
}

.my-requests-grid {
  --hx-artwork-grid-min: 160px;
}
</style>
