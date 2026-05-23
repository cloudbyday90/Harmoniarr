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
import ReassignRequestModal from '../components/ReassignRequestModal.vue';
import RequestListFilters from '../components/RequestListFilters.vue';
import RequestNotificationsPanel from '../components/RequestNotificationsPanel.vue';
import { useMediaRequestReassignment } from '../composables/useMediaRequestReassignment.js';
import { useRequestListFilters } from '../composables/useRequestListFilters.js';
import { useRequestMusicForm } from '../composables/useRequestMusicForm.js';
import { formatSourceProvider } from '../lib/import-candidate-presentation.js';
import {
  getCancelToastMessage,
  getFulfillmentStatusLabel,
  getFulfillmentStatusTone,
  getRequestHeadline,
  getRequestKindLabel,
  getRequestStateLabel,
  getRequestTargetLabel,
  isRequestCancellable,
} from '../lib/request-music-form.js';
import { cancelMediaRequest } from '../lib/library-api.js';
import { formatUserRole } from '../lib/settings-users-presentation.js';
import { useToast } from '../composables/useToast.js';
import { sessionStore } from '../state/session.js';

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');
const currentUserId = computed(() => sessionStore.state.user?.id ?? '');

const rm = useRequestMusicForm({
  initialScope: isAdmin.value ? 'all' : 'mine',
  isAdmin: isAdmin.value,
  currentUserId: currentUserId.value,
});

const toast = useToast();

const filters = useRequestListFilters({
  applyFiltersFn: () => applyFilters(),
});

function applyFilters() {
  void rm.loadRequestDashboard(filters.toApiParams());
}

function handleResetFilters() {
  filters.resetFilters();
  void rm.loadRequestDashboard();
}

const reassignment = useMediaRequestReassignment();

const reassignModalOpen = ref(false);
const reassignTarget = ref(null);

function openReassignModal(request) {
  reassignTarget.value = request;
  reassignment.reset();
  reassignModalOpen.value = true;
}

function closeReassignModal() {
  reassignModalOpen.value = false;
  reassignTarget.value = null;
}

async function handleReassign({ mediaRequestId, newRequestedForUserId, reason }) {
  const result = await reassignment.reassign({ mediaRequestId, newRequestedForUserId, reason });
  if (result) {
    closeReassignModal();
    toast.success('Request reassigned successfully.');
    void rm.loadRequestDashboard(filters.toApiParams());
  }
}

function handleLoadHistory({ mediaRequestId }) {
  void reassignment.loadHistory({ mediaRequestId });
}

function handleLoadUsers() {
  void reassignment.loadEligibleUsers();
}

const cancellingId = ref(null);

async function handleCancelRequest(request) {
  if (cancellingId.value) return;
  cancellingId.value = request.id;
  try {
    const result = await cancelMediaRequest({ mediaRequestId: request.id });
    toast.success(getCancelToastMessage(result?.mediaRequest?.cancelledChildCount));
    void rm.loadRequestDashboard(filters.toApiParams());
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to cancel request.');
  } finally {
    cancellingId.value = null;
  }
}

const hasNotifications = computed(
  () => (rm.summary.value?.notificationFeed?.counts?.total ?? 0) > 0,
);

const sortedRequests = computed(() => filters.sortRequests(rm.mediaRequests.value));

onMounted(() => {
  void rm.loadRequestDashboard();
  void rm.loadRequestTargets();
});
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Request music</h1>
        <p class="hx-page-subtitle">Submit release, track, or playlist requests and track fulfillment status.</p>
      </div>
      <div class="hx-page-actions" v-if="isAdmin">
        <button
          type="button"
          class="hx-btn"
          :data-variant="rm.selectedScope.value === 'all' ? 'primary' : 'ghost'"
          :disabled="rm.selectedScope.value === 'all'"
          @click="rm.switchScope('all')"
        >All requests</button>
        <button
          type="button"
          class="hx-btn"
          :data-variant="rm.selectedScope.value === 'mine' ? 'primary' : 'ghost'"
          :disabled="rm.selectedScope.value === 'mine'"
          @click="rm.switchScope('mine')"
        >My requests</button>
      </div>
    </header>

    <div v-if="rm.loadError.value" class="rm-load-error">
      <span class="hx-pill" data-tone="danger">{{ rm.loadError.value }}</span>
    </div>

    <!-- ── Submit a request (primary action) ──────────────────────────── -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Submit a request</h2>
          <p class="hx-card-subtitle">Use text requests for release or track intent, or submit Spotify, YouTube, or Apple Music URLs directly.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <form class="rm-form" @submit.prevent="rm.submitRequest()">

          <div class="hx-field" v-if="isAdmin">
            <label class="hx-field-label" for="rm-request-for">Request for</label>
            <select
              id="rm-request-for"
              class="hx-select"
              v-model="rm.form.requestedForUserId"
              :disabled="rm.isLoadingTargets.value || rm.requestTargets.value.length === 0"
            >
              <option v-for="user in rm.requestTargets.value" :key="user.id" :value="user.id">
                {{ getRequestTargetLabel(user, currentUserId) }}
              </option>
            </select>
            <p class="hx-text-muted rm-field-hint" v-if="rm.isLoadingTargets.value">
              Loading eligible request targets.
            </p>
            <p class="hx-text-muted rm-field-hint" v-else-if="rm.requestTargets.value.length === 0 && !rm.targetErrorMessage.value">
              No eligible request targets are currently available.
            </p>
            <p class="hx-text-muted rm-field-hint" v-else-if="rm.selectedTargetUser.value">
              Requests created here are owned by {{ rm.selectedTargetUser.value.username }} for inbox and fulfillment targeting, while audit still records the acting admin separately.
            </p>
            <span v-if="rm.targetErrorMessage.value" class="hx-pill" data-tone="danger">{{ rm.targetErrorMessage.value }}</span>
          </div>

          <div class="hx-field">
            <label class="hx-field-label" for="rm-request-kind">Request type</label>
            <select id="rm-request-kind" class="hx-select" v-model="rm.form.requestKind">
              <option value="release">Release</option>
              <option value="track">Track</option>
              <option value="external_url">Playlist or collection URL</option>
            </select>
          </div>

          <div class="hx-field" v-if="rm.form.requestKind !== 'external_url'">
            <label class="hx-field-label" for="rm-artist">Artist</label>
            <input id="rm-artist" class="hx-input" v-model="rm.form.artistName" placeholder="Daft Punk" />
          </div>

          <div class="hx-field" v-if="rm.form.requestKind === 'release'">
            <label class="hx-field-label" for="rm-release">Release</label>
            <input id="rm-release" class="hx-input" v-model="rm.form.releaseTitle" placeholder="Discovery" />
          </div>

          <div class="hx-field" v-if="rm.form.requestKind === 'track'">
            <label class="hx-field-label" for="rm-track">Track</label>
            <input id="rm-track" class="hx-input" v-model="rm.form.trackTitle" placeholder="One More Time" />
          </div>

          <div class="hx-field" v-if="rm.form.requestKind === 'track'">
            <label class="hx-field-label" for="rm-track-release">
              Release <span class="hx-text-muted">(optional)</span>
            </label>
            <input id="rm-track-release" class="hx-input" v-model="rm.form.releaseTitle" placeholder="Optional release context" />
          </div>

          <div class="hx-field" v-if="rm.form.requestKind === 'external_url'">
            <label class="hx-field-label" for="rm-source-url">Source URL</label>
            <input id="rm-source-url" class="hx-input" v-model="rm.form.sourceUrl" placeholder="https://open.spotify.com/playlist/&#x2026;" />
          </div>

          <div class="hx-field">
            <label class="hx-field-label" for="rm-notes">
              Notes <span class="hx-text-muted">(optional)</span>
            </label>
            <textarea
              id="rm-notes"
              class="hx-input rm-notes"
              v-model="rm.form.notes"
              rows="3"
              placeholder="Why this request matters, preferred edition, or playlist context"
            ></textarea>
          </div>

          <div class="rm-form-footer">
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="rm.isSubmitting.value || !rm.canSubmit.value"
            >
              {{ rm.isSubmitting.value ? 'Submitting\u2026' : 'Submit request' }}
            </button>
            <span v-if="rm.successMessage.value" class="hx-pill" data-tone="success">{{ rm.successMessage.value }}</span>
            <span v-if="rm.errorMessage.value" class="hx-pill" data-tone="danger">{{ rm.errorMessage.value }}</span>
          </div>

        </form>
      </div>
    </article>

    <!-- ── Summary stats ──────────────────────────────────────────────── -->
    <section class="hx-stat-grid" v-if="rm.summary.value">
      <article class="hx-stat-card">
        <span class="hx-stat-label">Total</span>
        <span class="hx-stat-value">{{ rm.summary.value.counts.totalRequests }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Under review</span>
        <span class="hx-stat-value">{{ rm.summary.value.fulfillmentCounts?.underReview ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Active</span>
        <span class="hx-stat-value">{{ rm.summary.value.fulfillmentCounts?.active ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Satisfied</span>
        <span class="hx-stat-value">{{ rm.summary.value.fulfillmentCounts?.satisfied ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Failed</span>
        <span class="hx-stat-value">{{ rm.summary.value.fulfillmentCounts?.failed ?? 0 }}</span>
      </article>
    </section>

    <!-- ── Notifications (only when present) ─────────────────────────── -->
    <RequestNotificationsPanel
      v-if="hasNotifications"
      :checked-at="rm.summary.value.notificationFeed.checkedAt"
      :counts="rm.summary.value.notificationFeed.counts"
      :notifications="rm.summary.value.notificationFeed.notifications"
    />

    <!-- ── Filters ─────────────────────────────────────────────────────── -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Filter requests</h2>
          <p class="hx-card-subtitle">{{ filters.activeFilterCount.value }} active {{ filters.activeFilterCount.value === 1 ? 'filter' : 'filters' }}</p>
        </div>
      </header>
      <div class="hx-card-body">
        <RequestListFilters
          :active-filter-count="filters.activeFilterCount.value"
          :is-loading="rm.isLoading.value"
          :request-kind="filters.filters.requestKind"
          :request-state="filters.filters.requestState"
          :search="filters.filters.search"
          :sort-by="filters.filters.sortBy"
          @apply="applyFilters"
          @reset="handleResetFilters"
          @update:request-kind="filters.updateFilter('requestKind', $event)"
          @update:request-state="filters.updateFilter('requestState', $event)"
          @update:search="filters.updateFilter('search', $event)"
          @update:sort-by="filters.updateFilter('sortBy', $event)"
        />
      </div>
    </article>

    <!-- ── Request history ────────────────────────────────────────────── -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">{{ rm.selectedScope.value === 'all' ? 'All visible requests' : 'Your requests' }}</h2>
          <p class="hx-card-subtitle">Requests stay attributable to the requesting user while this inbox surfaces the current fulfillment state.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <p v-if="rm.isLoading.value" class="hx-text-muted">Loading request history.</p>

        <div class="rm-request-list" v-else-if="rm.mediaRequests.value.length">
          <article class="rm-request-item" v-for="request in sortedRequests" :key="request.id">
            <div class="rm-request-header">
              <div>
                <p class="rm-request-kind">{{ getRequestKindLabel(request.requestKind) }}</p>
                <router-link :to="{ name: 'request-detail', params: { id: request.id } }" class="rm-request-headline">{{ getRequestHeadline(request) }}</router-link>
                <p class="hx-text-muted" v-if="rm.selectedScope.value === 'all' && request.requestedByUser.id !== request.requestedForUser.id">
                  Requested by {{ request.requestedByUser.username }} ({{ formatUserRole(request.requestedByUser.role) }}) for {{ request.requestedForUser.username }} ({{ formatUserRole(request.requestedForUser.role) }})
                </p>
                <p class="hx-text-muted" v-else-if="rm.selectedScope.value === 'all'">
                  Requested by {{ request.requestedByUser.username }} ({{ formatUserRole(request.requestedByUser.role) }})
                </p>
                <p class="hx-text-muted" v-else-if="request.requestedByUser.id !== request.requestedForUser.id">
                  Requested on your behalf by {{ request.requestedByUser.username }}.
                </p>
                <p class="hx-text-muted" v-else>Created {{ request.createdAt ?? 'recently' }}</p>
              </div>
              <span
                class="hx-pill"
                :data-tone="getFulfillmentStatusTone(request.fulfillmentStatus)"
              >{{ getFulfillmentStatusLabel(request.fulfillmentStatus) }}</span>
            </div>

            <p class="hx-text-muted" v-if="request.notes">{{ request.notes }}</p>
            <p class="hx-text-muted" v-if="request.fulfillmentStatus?.detail">{{ request.fulfillmentStatus.detail }}</p>
            <p class="hx-text-muted">Request classification: {{ getRequestStateLabel(request.requestState) }}</p>
            <p class="hx-text-muted" v-if="request.sourceProvider">Source provider: {{ formatSourceProvider(request.sourceProvider) }}</p>
            <p class="hx-text-muted" v-if="request.existingMatch">
              Matched release: {{ request.existingMatch.artistName }} &#x2014; {{ request.existingMatch.releaseTitle || request.existingMatch.releaseGroupTitle }}
            </p>
            <div class="rm-request-actions">
              <button
                v-if="isRequestCancellable(request)"
                type="button"
                class="hx-btn"
                data-variant="danger"
                :disabled="cancellingId === request.id"
                @click="handleCancelRequest(request)"
              >{{ cancellingId === request.id ? 'Cancelling\u2026' : 'Cancel' }}</button>
              <button
                v-if="isAdmin && rm.selectedScope.value === 'all'"
                type="button"
                class="hx-btn"
                data-variant="ghost"
                @click="openReassignModal(request)"
              >Reassign</button>
            </div>
          </article>
        </div>

        <template v-if="!rm.isLoading.value && rm.mediaRequests.value.length">
          <div v-if="rm.hasMore.value" class="rm-load-more">
            <button
              type="button"
              class="hx-btn"
              data-variant="ghost"
              :disabled="rm.isLoadingMore.value"
              @click="rm.loadMoreRequests(filters.toApiParams())"
            >{{ rm.isLoadingMore.value ? 'Loading\u2026' : 'Load more' }}</button>
            <p class="hx-text-muted">{{ rm.mediaRequests.value.length }} of {{ rm.totalCount?.value ?? rm.mediaRequests.value.length }}</p>
          </div>
        </template>

        <div class="hx-empty" v-if="!rm.isLoading.value && !rm.mediaRequests.value.length">
          <p class="hx-empty-title">No requests yet</p>
          <p class="hx-empty-copy">No requests have been submitted in this scope yet.</p>
        </div>
      </div>
    </article>

    <ReassignRequestModal
      :open="reassignModalOpen"
      :request="reassignTarget"
      :eligible-users="reassignment.eligibleUsers.value"
      :is-loading-users="reassignment.isLoadingUsers.value"
      :events="reassignment.events.value"
      :is-loading-history="reassignment.isLoadingHistory.value"
      :is-reassigning="reassignment.isReassigning.value"
      :reassign-error="reassignment.reassignError.value"
      :history-error="reassignment.historyError.value"
      @reassign="handleReassign"
      @close="closeReassignModal"
      @load-users="handleLoadUsers"
      @load-history="handleLoadHistory"
    />
  </section>
</template>

<style scoped>
.rm-load-error {
  padding: var(--hx-space-2) 0;
}

.rm-form {
  display: grid;
  gap: var(--hx-space-4);
}

.rm-notes {
  resize: vertical;
  min-height: 72px;
}

.rm-field-hint {
  margin-top: var(--hx-space-1);
  font-size: var(--hx-text-sm);
}

.rm-form-footer {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.rm-request-list {
  display: grid;
  gap: 0;
}

.rm-request-item {
  padding: var(--hx-space-3) 0;
  border-bottom: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-1);
}

.rm-request-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.rm-request-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.rm-request-kind {
  font-size: var(--hx-text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
  margin: 0 0 var(--hx-space-1);
}

.rm-request-headline {
  display: block;
  font-size: var(--hx-text-base);
  font-weight: 600;
  margin: 0 0 var(--hx-space-1);
  color: var(--hx-accent-strong);
  text-decoration: none;
}

.rm-request-headline:hover {
  text-decoration: underline;
}

.rm-request-actions {
  display: flex;
  gap: var(--hx-space-2);
  padding-top: var(--hx-space-1);
}

.rm-load-more {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  padding-top: var(--hx-space-4);
  justify-content: center;
}
</style>
