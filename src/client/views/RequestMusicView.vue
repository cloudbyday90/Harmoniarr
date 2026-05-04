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
import {
  createMediaRequest,
  fetchMediaRequests,
  fetchMediaRequestSummary,
} from '../lib/library-api.js';
import { fetchUsers } from '../lib/users-api.js';
import { sessionStore } from '../state/session.js';

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const currentUserId = computed(() => sessionStore.state.user?.id ?? '');
const mediaRequests = ref([]);
const requestTargets = ref([]);
const selectedScope = ref(isAdmin.value ? 'all' : 'mine');
const summary = ref(null);
const isLoading = ref(false);
const isLoadingTargets = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const targetErrorMessage = ref('');

const form = reactive({
  artistName: '',
  notes: '',
  releaseTitle: '',
  requestKind: 'release',
  requestedForUserId: '',
  sourceUrl: '',
  trackTitle: '',
});

const selectedTargetUser = computed(() => {
  return requestTargets.value.find((user) => user.id === form.requestedForUserId) ?? null;
});

const canSubmit = computed(() => {
  if (form.requestKind === 'external_url') {
    return form.sourceUrl.trim().length > 0;
  }

  if (form.requestKind === 'track') {
    return form.artistName.trim().length > 0 && form.trackTitle.trim().length > 0;
  }

  return form.artistName.trim().length > 0 && form.releaseTitle.trim().length > 0;
});

function requestTargetLabel(user) {
  if (!user) {
    return '';
  }

  if (user.id === currentUserId.value) {
    return `${user.username} (${user.role}, you)`;
  }

  return `${user.username} (${user.role})`;
}

function applyDefaultRequestTarget() {
  if (!isAdmin.value) {
    form.requestedForUserId = '';
    return;
  }

  const preferredTarget = requestTargets.value.find((user) => user.id === currentUserId.value);
  form.requestedForUserId = preferredTarget?.id ?? requestTargets.value[0]?.id ?? '';
}

function buildPayload() {
  const payload = {
    notes: form.notes,
    requestKind: form.requestKind,
  };

  if (isAdmin.value && form.requestedForUserId) {
    payload.requestedForUserId = form.requestedForUserId;
  }

  if (form.requestKind === 'external_url') {
    payload.sourceUrl = form.sourceUrl;
    return payload;
  }

  payload.artistName = form.artistName;

  if (form.requestKind === 'track') {
    payload.trackTitle = form.trackTitle;
    payload.releaseTitle = form.releaseTitle;
    return payload;
  }

  payload.releaseTitle = form.releaseTitle;
  return payload;
}

function resetForm() {
  form.artistName = '';
  form.notes = '';
  form.releaseTitle = '';
  form.requestKind = 'release';
  applyDefaultRequestTarget();
  form.sourceUrl = '';
  form.trackTitle = '';
}

function requestStateLabel(requestState) {
  switch (requestState) {
    case 'already_exists':
      return 'Already exists';
    case 'needs_review':
      return 'Needs review';
    default:
      return 'Needs fetch';
  }
}

function fulfillmentStatusLabel(fulfillmentStatus) {
  return fulfillmentStatus?.label ?? 'Queued';
}

function fulfillmentStatusClass(fulfillmentStatus) {
  switch (fulfillmentStatus?.tone) {
    case 'selected':
      return 'review-status-selected';
    case 'failed':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

function requestHeadline(request) {
  if (request.requestKind === 'external_url') {
    return request.sourceUrl;
  }

  if (request.requestKind === 'track') {
    return `${request.artistName} - ${request.trackTitle}`;
  }

  return `${request.artistName} - ${request.releaseTitle}`;
}

function requestKindLabel(requestKind) {
  switch (requestKind) {
    case 'external_url':
      return 'Playlist or collection URL';
    case 'track':
      return 'Track request';
    default:
      return 'Release request';
  }
}

async function loadRequestDashboard() {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const [summaryPayload, requestsPayload] = await Promise.all([
      fetchMediaRequestSummary({ scope: selectedScope.value }),
      fetchMediaRequests({ scope: selectedScope.value }),
    ]);

    summary.value = summaryPayload;
    mediaRequests.value = requestsPayload.mediaRequests ?? [];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Music request dashboard could not be loaded';
  } finally {
    isLoading.value = false;
  }
}

async function loadRequestTargets() {
  if (!isAdmin.value) {
    requestTargets.value = [];
    form.requestedForUserId = '';
    return;
  }

  isLoadingTargets.value = true;
  targetErrorMessage.value = '';

  try {
    const payload = await fetchUsers();
    requestTargets.value = (payload.users ?? []).filter((user) => user.mediaRequestTarget?.eligible);
    applyDefaultRequestTarget();
  } catch (error) {
    requestTargets.value = [];
    applyDefaultRequestTarget();
    targetErrorMessage.value = error instanceof Error ? error.message : 'Eligible request targets could not be loaded';
  } finally {
    isLoadingTargets.value = false;
  }
}

async function submitRequest() {
  isSubmitting.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const payload = await createMediaRequest(buildPayload());
    const targetUser = payload.mediaRequest.requestedForUser;
    const delegated = Boolean(targetUser && targetUser.id !== currentUserId.value);
    successMessage.value = payload.mediaRequest.requestState === 'already_exists'
      ? delegated
        ? `This request already maps to imported media and has been added for ${targetUser.username}.`
        : 'This request already maps to imported media and has been added to your request profile.'
      : delegated
        ? `Music request submitted for ${targetUser.username}.`
        : 'Music request submitted and added to your request profile.';
    resetForm();
    await loadRequestDashboard();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Music request submission failed';
  } finally {
    isSubmitting.value = false;
  }
}

async function switchScope(scope) {
  if (!isAdmin.value || selectedScope.value === scope) {
    return;
  }

  selectedScope.value = scope;
  await loadRequestDashboard();
}

onMounted(() => {
  void loadRequestDashboard();
  void loadRequestTargets();
});
</script>

<template>
  <section class="page-stack">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">Request music</p>
      <h2>Dedicated request intake</h2>
      <p>
        Submit release, track, or external playlist and collection URLs here. Harmoniarr records the request against the current user,
        checks whether the media already exists locally, and keeps delegated request fulfillment visible here as requests move through review,
        queueing, downloads, and final import.
      </p>
    </article>

    <article class="panel-light">
      <div class="section-header">
        <div>
          <h3>Request profile</h3>
          <p class="metadata-card-copy" v-if="summary">{{ summary.summary.message }}</p>
          <p class="metadata-card-copy" v-else>Loading request state and recent activity.</p>
        </div>
        <div class="library-scan-actions" v-if="isAdmin">
          <button type="button" class="review-reset-button" :disabled="selectedScope === 'all'" @click="switchScope('all')">All requests</button>
          <button type="button" class="review-reset-button" :disabled="selectedScope === 'mine'" @click="switchScope('mine')">My requests</button>
        </div>
      </div>

      <div class="metadata-card-grid" v-if="summary">
        <article class="metadata-card">
          <p class="eyebrow">Total</p>
          <strong>{{ summary.counts.totalRequests }}</strong>
          <p class="metadata-card-copy">Requests visible in the current scope.</p>
        </article>
        <article class="metadata-card">
          <p class="eyebrow">Under review</p>
          <strong>{{ summary.fulfillmentCounts?.underReview ?? 0 }}</strong>
          <p class="metadata-card-copy">Requests still waiting on manual review before fulfillment can continue.</p>
        </article>
        <article class="metadata-card">
          <p class="eyebrow">Active</p>
          <strong>{{ summary.fulfillmentCounts?.active ?? 0 }}</strong>
          <p class="metadata-card-copy">Requests that are queued, downloading, or waiting for import apply.</p>
        </article>
        <article class="metadata-card">
          <p class="eyebrow">Satisfied</p>
          <strong>{{ summary.fulfillmentCounts?.satisfied ?? 0 }}</strong>
          <p class="metadata-card-copy">Requests that are already available or fully fulfilled in the library.</p>
        </article>
        <article class="metadata-card">
          <p class="eyebrow">Failed</p>
          <strong>{{ summary.fulfillmentCounts?.failed ?? 0 }}</strong>
          <p class="metadata-card-copy">Requests that need operator intervention before fulfillment can finish.</p>
        </article>
      </div>
    </article>

    <article class="panel-light">
      <div class="section-header">
        <div>
          <h3>Submit a request</h3>
          <p class="metadata-card-copy">Use text requests for release or track intent, or submit Spotify, YouTube, or Apple Music URLs directly here.</p>
        </div>
      </div>

      <form class="metadata-search-form request-music-form" @submit.prevent="submitRequest">
        <label v-if="isAdmin">
          Request for
          <select v-model="form.requestedForUserId" :disabled="isLoadingTargets || requestTargets.length === 0">
            <option v-for="user in requestTargets" :key="user.id" :value="user.id">{{ requestTargetLabel(user) }}</option>
          </select>
        </label>

        <p class="metadata-card-copy" v-if="isAdmin && selectedTargetUser">
          Requests created here are owned by {{ selectedTargetUser.username }} for inbox and fulfillment targeting, while audit still records the acting admin separately.
        </p>
        <p class="metadata-card-copy" v-if="isAdmin && isLoadingTargets">Loading eligible request targets.</p>
        <p class="metadata-card-copy" v-else-if="isAdmin && requestTargets.length === 0 && !targetErrorMessage">No eligible request targets are currently available.</p>
        <p class="error-copy" v-if="targetErrorMessage">{{ targetErrorMessage }}</p>

        <label>
          Request type
          <select v-model="form.requestKind">
            <option value="release">Release</option>
            <option value="track">Track</option>
            <option value="external_url">Playlist or collection URL</option>
          </select>
        </label>

        <label v-if="form.requestKind !== 'external_url'">
          Artist
          <input v-model="form.artistName" placeholder="Daft Punk" />
        </label>

        <label v-if="form.requestKind === 'release'">
          Release
          <input v-model="form.releaseTitle" placeholder="Discovery" />
        </label>

        <label v-if="form.requestKind === 'track'">
          Track
          <input v-model="form.trackTitle" placeholder="One More Time" />
        </label>

        <label v-if="form.requestKind === 'track'">
          Release
          <input v-model="form.releaseTitle" placeholder="Optional release context" />
        </label>

        <label v-if="form.requestKind === 'external_url'">
          Source URL
          <input v-model="form.sourceUrl" placeholder="https://open.spotify.com/playlist/..." />
        </label>

        <label>
          Notes
          <textarea v-model="form.notes" rows="3" placeholder="Why this request matters, preferred edition, or playlist context"></textarea>
        </label>

        <div class="library-scan-actions">
          <button type="submit" :disabled="isSubmitting || !canSubmit">
            {{ isSubmitting ? 'Submitting...' : 'Submit request' }}
          </button>
        </div>
      </form>

      <p class="success-copy" v-if="successMessage">{{ successMessage }}</p>
      <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
    </article>

    <article class="panel-light">
      <div class="section-header">
        <div>
          <h3>{{ selectedScope === 'all' ? 'All visible requests' : 'Your requests' }}</h3>
          <p class="metadata-card-copy">Requests stay attributable to the requesting user while this inbox surfaces the current fulfillment state for the target user.</p>
        </div>
      </div>

      <p v-if="isLoading">Loading request history.</p>
      <div class="request-list" v-else-if="mediaRequests.length">
        <article class="metadata-card" v-for="request in mediaRequests" :key="request.id">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ requestKindLabel(request.requestKind) }}</p>
              <h3>{{ requestHeadline(request) }}</h3>
              <p class="metadata-card-copy" v-if="selectedScope === 'all' && request.requestedByUser.id !== request.requestedForUser.id">
                Requested by {{ request.requestedByUser.username }} ({{ request.requestedByUser.role }}) for {{ request.requestedForUser.username }} ({{ request.requestedForUser.role }})
              </p>
              <p class="metadata-card-copy" v-else-if="selectedScope === 'all'">Requested by {{ request.requestedByUser.username }} ({{ request.requestedByUser.role }})</p>
              <p class="metadata-card-copy" v-else-if="request.requestedByUser.id !== request.requestedForUser.id">Requested on your behalf by {{ request.requestedByUser.username }}.</p>
              <p class="metadata-card-copy" v-else>Created {{ request.createdAt ?? 'recently' }}</p>
            </div>
            <span class="review-status-pill" :class="fulfillmentStatusClass(request.fulfillmentStatus)">{{ fulfillmentStatusLabel(request.fulfillmentStatus) }}</span>
          </div>

          <p class="metadata-card-copy" v-if="request.notes">{{ request.notes }}</p>
          <p class="metadata-card-copy" v-if="request.fulfillmentStatus?.detail">{{ request.fulfillmentStatus.detail }}</p>
          <p class="metadata-card-copy">Request classification: {{ requestStateLabel(request.requestState) }}</p>
          <p class="metadata-card-copy" v-if="request.sourceProvider">Source provider: {{ request.sourceProvider }}</p>
          <p class="metadata-card-copy" v-if="request.existingMatch">
            Matched release: {{ request.existingMatch.artistName }} - {{ request.existingMatch.releaseTitle || request.existingMatch.releaseGroupTitle }}
          </p>
        </article>
      </div>
      <p v-else>No requests have been submitted in this scope yet.</p>
    </article>
  </section>
</template>

<style scoped>
.request-music-form {
  align-items: end;
}

.request-list {
  display: grid;
  gap: 1rem;
}
</style>