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
import { useRoute, useRouter } from 'vue-router';
import RequestEventTimeline from '../components/RequestEventTimeline.vue';
import { useMediaRequestDetail } from '../composables/useMediaRequestDetail.js';
import { useMediaRequestReassignment } from '../composables/useMediaRequestReassignment.js';
import { formatSourceProvider } from '../lib/import-candidate-presentation.js';
import {
  getFulfillmentStatusLabel,
  getFulfillmentStatusTone,
  getRequestHeadline,
  getRequestKindLabel,
  getRequestStateLabel,
} from '../lib/request-music-form.js';
import { formatUserRole } from '../lib/settings-users-presentation.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');

const {
  mediaRequest,
  events,
  isLoading,
  errorMessage,
  load,
} = useMediaRequestDetail();

const {
  eligibleUsers,
} = useMediaRequestReassignment();

const requestKindLabel = computed(() => getRequestKindLabel(mediaRequest.value?.requestKind));
const headline = computed(() => getRequestHeadline(mediaRequest.value ?? {}));
const fulfillmentLabel = computed(() => getFulfillmentStatusLabel(mediaRequest.value?.fulfillmentStatus));
const fulfillmentTone = computed(() => getFulfillmentStatusTone(mediaRequest.value?.fulfillmentStatus));
const stateLabel = computed(() => getRequestStateLabel(mediaRequest.value?.requestState));

onMounted(() => {
  const id = route.params.id;
  if (id) void load({ mediaRequestId: id });
  if (isAdmin.value) {
    void useMediaRequestReassignment().loadEligibleUsers();
  }
});

function goBack() {
  router.back();
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}
</script>

<template>
  <section class="hx-page rdl">
    <header class="hx-page-header">
      <div>
        <button type="button" class="hx-btn" data-variant="ghost" @click="goBack">&#8592; Back</button>
        <h1 class="hx-page-title rdl-title">{{ headline }}</h1>
        <p class="hx-page-subtitle">{{ requestKindLabel }}</p>
      </div>
      <div class="hx-page-actions">
        <span v-if="mediaRequest?.fulfillmentStatus" class="hx-pill" :data-tone="fulfillmentTone">{{ fulfillmentLabel }}</span>
      </div>
    </header>

    <p v-if="isLoading" class="hx-text-muted" aria-live="polite" aria-busy="true">Loading request detail.</p>
    <p v-else-if="errorMessage" class="hx-text-muted" style="color: var(--hx-danger)">{{ errorMessage }}</p>

    <template v-else-if="mediaRequest">
      <div class="hx-stat-grid">
        <article class="hx-stat-card">
          <span class="hx-stat-label">Status</span>
          <span class="hx-stat-value">{{ stateLabel }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Created</span>
          <span class="hx-stat-value">{{ formatTimestamp(mediaRequest.createdAt) }}</span>
        </article>
        <article class="hx-stat-card" v-if="mediaRequest.fulfillmentStatus?.detail">
          <span class="hx-stat-label">Fulfillment</span>
          <span class="hx-stat-value">{{ mediaRequest.fulfillmentStatus.detail }}</span>
        </article>
        <article class="hx-stat-card" v-if="mediaRequest.fanOutChildCount">
          <span class="hx-stat-label">Fan-out children</span>
          <span class="hx-stat-value">{{ mediaRequest.fanOutChildCount }}</span>
        </article>
      </div>

      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Request details</h2>
          </div>
        </header>
        <div class="hx-card-body">
          <dl class="rdl-fields">
            <div class="rdl-field" v-if="mediaRequest.artistName">
              <dt>Artist</dt>
              <dd>{{ mediaRequest.artistName }}</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.releaseTitle">
              <dt>Release</dt>
              <dd>{{ mediaRequest.releaseTitle }}</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.trackTitle">
              <dt>Track</dt>
              <dd>{{ mediaRequest.trackTitle }}</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.sourceProvider">
              <dt>Source</dt>
              <dd>{{ formatSourceProvider(mediaRequest.sourceProvider) }}</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.sourceUrl">
              <dt>URL</dt>
              <dd class="rdl-url">{{ mediaRequest.sourceUrl }}</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.notes">
              <dt>Notes</dt>
              <dd>{{ mediaRequest.notes }}</dd>
            </div>
            <div class="rdl-field">
              <dt>Requested by</dt>
              <dd>{{ mediaRequest.requestedByUser?.username ?? 'unknown' }} ({{ formatUserRole(mediaRequest.requestedByUser?.role) }})</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.requestedByUser?.id !== mediaRequest.requestedForUser?.id">
              <dt>Requested for</dt>
              <dd>{{ mediaRequest.requestedForUser?.username ?? 'unknown' }} ({{ formatUserRole(mediaRequest.requestedForUser?.role) }})</dd>
            </div>
            <div class="rdl-field" v-if="mediaRequest.existingMatch">
              <dt>Matched release</dt>
              <dd>{{ mediaRequest.existingMatch.artistName }} — {{ mediaRequest.existingMatch.releaseTitle || mediaRequest.existingMatch.releaseGroupTitle }}</dd>
            </div>
          </dl>
        </div>
      </article>

      <RequestEventTimeline
        :events="events"
        :eligible-users="eligibleUsers.value"
      />
    </template>
  </section>
</template>

<style scoped>
.rdl {
  display: grid;
  gap: var(--hx-space-5);
  align-content: start;
}

.rdl-title {
  margin-top: var(--hx-space-2);
}

.rdl-fields {
  display: grid;
  gap: var(--hx-space-3);
  margin: 0;
}

.rdl-field {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--hx-space-2);
  align-items: baseline;
}

.rdl-field dt {
  font-size: var(--hx-text-sm);
  font-weight: 500;
  color: var(--hx-text-muted);
}

.rdl-field dd {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text);
}

.rdl-url {
  word-break: break-all;
  font-family: var(--hx-font-mono);
  font-size: var(--hx-text-xs);
}

@media (max-width: 640px) {
  .rdl-field {
    grid-template-columns: 1fr;
  }
}
</style>
