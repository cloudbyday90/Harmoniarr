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
import { useRoute, useRouter } from 'vue-router';
import ReassignRequestModal from '../components/ReassignRequestModal.vue';
import RequestEventTimeline from '../components/RequestEventTimeline.vue';
import RequestJourneyTimeline from '../components/RequestJourneyTimeline.vue';
import { useMediaRequestDetail } from '../composables/useMediaRequestDetail.js';
import { useMediaRequestPipeline } from '../composables/useMediaRequestPipeline.js';
import { useMediaRequestReassignment } from '../composables/useMediaRequestReassignment.js';
import { useToast } from '../composables/useToast.js';
import { useConfirm } from '../composables/useConfirm.js';
import { formatSourceProvider } from '../lib/import-candidate-presentation.js';
import {
  getCancelToastMessage,
  getFulfillmentStatusLabel,
  getFulfillmentStatusTone,
  getRequestHeadline,
  getRequestKindLabel,
  getRequestStateLabel,
  isRequestCancellable,
} from '../lib/request-music-form.js';
import { cancelMediaRequest } from '../lib/library-api.js';
import {
  candidateStatusLabel,
  candidateStatusTone,
  formatBytes,
  runItemStatusLabel,
  runItemStatusTone,
  buildPipelineSteps,
} from '../lib/request-pipeline-presentation.js';
import { formatUserRole } from '../lib/settings-users-presentation.js';
import { buildRequestJourney } from '../lib/request-journey.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();

const isAdmin = computed(() => sessionStore.state.user?.role === 'admin');

const {
  mediaRequest,
  events,
  isLoading,
  isRevalidating,
  errorMessage,
  hasMoreEvents,
  isLoadingMoreEvents,
  load,
  loadMoreEvents,
} = useMediaRequestDetail({
  pollIntervalMs: 15000,
  revalidateOnFocus: true,
});

const {
  candidates: pipelineCandidates,
  isLoading: isLoadingPipeline,
  isRevalidating: isRevalidatingPipeline,
  load: loadPipeline,
} = useMediaRequestPipeline({
  pollIntervalMs: 15000,
  revalidateOnFocus: true,
});

const {
  eligibleUsers,
  isLoadingUsers,
  events: reassignEvents,
  isLoadingHistory,
  isReassigning,
  reassignError,
  historyError,
  loadEligibleUsers,
  loadHistory,
  reassign,
  reset,
} = useMediaRequestReassignment();

const toast = useToast();
const confirm = useConfirm();

const reassignModalOpen = ref(false);
const reassignTarget = ref(null);

function openReassignModal() {
  reassignTarget.value = mediaRequest.value;
  reset();
  reassignModalOpen.value = true;
}

function closeReassignModal() {
  reassignModalOpen.value = false;
  reassignTarget.value = null;
}

async function handleReassign({ mediaRequestId, newRequestedForUserId, reason }) {
  const result = await reassign({ mediaRequestId, newRequestedForUserId, reason });
  if (result) {
    closeReassignModal();
    toast.success('Request reassigned successfully.');
    void load({ mediaRequestId: route.params.id });
  }
}

function handleLoadHistory({ mediaRequestId }) {
  void loadHistory({ mediaRequestId });
}

function handleLoadUsers() {
  void loadEligibleUsers();
}

const isCancellable = computed(() => isRequestCancellable(mediaRequest.value));
const isCancelling = ref(false);

async function handleCancel() {
  if (!mediaRequest.value || isCancelling.value) return;
  const confirmed = await confirm({
    title: 'Cancel request?',
    message: 'This request will be cancelled and any in-flight fulfillment work will stop.',
    confirmLabel: 'Cancel request',
    cancelLabel: 'Keep',
    tone: 'danger',
  });
  if (!confirmed) return;
  isCancelling.value = true;
  try {
    const result = await cancelMediaRequest({ mediaRequestId: mediaRequest.value.id });
    toast.success(getCancelToastMessage(result?.mediaRequest?.cancelledChildCount));
    void load({ mediaRequestId: route.params.id });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to cancel request.');
  } finally {
    isCancelling.value = false;
  }
}

const requestKindLabel = computed(() => getRequestKindLabel(mediaRequest.value?.requestKind));
const headline = computed(() => getRequestHeadline(mediaRequest.value ?? {}));
const fulfillmentLabel = computed(() => getFulfillmentStatusLabel(mediaRequest.value?.fulfillmentStatus));
const fulfillmentTone = computed(() => getFulfillmentStatusTone(mediaRequest.value?.fulfillmentStatus));
const stateLabel = computed(() => getRequestStateLabel(mediaRequest.value?.requestState));
const hasImportCandidate = computed(() => Boolean(mediaRequest.value?.fulfillmentStatus?.importCandidateId));
const importCandidateId = computed(() => mediaRequest.value?.fulfillmentStatus?.importCandidateId ?? null);
const importCandidateStatus = computed(() => mediaRequest.value?.fulfillmentStatus?.importCandidateStatus ?? null);
const importStatusLabel = computed(() => candidateStatusLabel(importCandidateStatus.value));
const importStatusTone = computed(() => candidateStatusTone(importCandidateStatus.value));
const importReviewLink = computed(() => {
  if (!importCandidateId.value) return null;
  return { name: 'activity-candidates', query: { candidate: importCandidateId.value } };
});

const hasPipeline = computed(() => pipelineCandidates.value.length > 0);
const candidateCount = computed(() => pipelineCandidates.value.length);

const journey = computed(() =>
  buildRequestJourney({ mediaRequest: mediaRequest.value, candidates: pipelineCandidates.value }),
);

onMounted(() => {
  const id = route.params.id;
  if (id) {
    void load({ mediaRequestId: id });
    void loadPipeline({ mediaRequestId: id });
  }
  if (isAdmin.value) void loadEligibleUsers();
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
        <span v-if="isRevalidating" class="rdl-revalidating" aria-label="Refreshing">↻</span>
        <button v-if="isCancellable" type="button" class="hx-btn" data-variant="danger" :disabled="isCancelling" @click="handleCancel">{{ isCancelling ? 'Cancelling\u2026' : 'Cancel request' }}</button>
        <button v-if="isAdmin && mediaRequest" type="button" class="hx-btn" data-variant="ghost" @click="openReassignModal">Reassign</button>
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
        <article class="hx-stat-card" v-if="hasPipeline">
          <span class="hx-stat-label">Candidates</span>
          <span class="hx-stat-value">{{ candidateCount }}</span>
        </article>
        <article class="hx-stat-card" v-if="mediaRequest.fanOutChildCount">
          <span class="hx-stat-label">Fan-out children</span>
          <span class="hx-stat-value">{{ mediaRequest.fanOutChildCount }}</span>
        </article>
      </div>

      <article v-if="journey.stages.length" class="hx-card">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Request journey</h2>
            <p class="hx-card-subtitle">Where this request is right now, from submission to your library.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <RequestJourneyTimeline :stages="journey.stages" :current-stage-key="journey.currentStageKey" />
        </div>
      </article>

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

      <article v-if="hasPipeline" class="hx-card">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Fulfillment pipeline <span v-if="isRevalidatingPipeline" class="rdl-revalidating" aria-label="Refreshing">↻</span></h2>
            <p class="hx-card-subtitle">{{ candidateCount }} import candidate{{ candidateCount === 1 ? '' : 's' }} linked to this request.</p>
          </div>
        </header>
        <div class="hx-card-body hx-card-body--flush">
          <p v-if="isLoadingPipeline" class="hx-text-muted rdl-pipeline-loading">Loading pipeline data.</p>
          <div v-else class="rdl-pipeline-list">
            <details v-for="candidate in pipelineCandidates" :key="candidate.id" class="rdl-candidate">
              <summary class="rdl-candidate-summary">
                <span class="hx-pill" :data-tone="candidateStatusTone(candidate.status)">{{ candidateStatusLabel(candidate.status) }}</span>
                <span class="rdl-candidate-source">{{ candidate.username ?? 'unknown' }} &mdash; {{ candidate.folderPath?.split(/[/\\]/).pop() ?? 'unknown folder' }}</span>
                <span class="rdl-candidate-meta">{{ candidate.fileCount ?? 0 }} files{{ candidate.totalSizeBytes ? `, ${formatBytes(candidate.totalSizeBytes)}` : '' }}</span>
              </summary>
              <div class="rdl-candidate-body">
                <div class="rdl-pipeline-steps">
                  <div v-for="(step, index) in buildPipelineSteps(candidate)" :key="step.key" class="rdl-step" :data-status="step.status">
                    <div class="rdl-step-dot"></div>
                    <span v-if="index < buildPipelineSteps(candidate).length - 1" class="rdl-step-line"></span>
                    <span class="rdl-step-label">{{ step.label }}</span>
                  </div>
                </div>
                <dl class="rdl-fields rdl-candidate-details" v-if="candidate.execution || candidate.apply">
                  <div class="rdl-field" v-if="candidate.execution">
                    <dt>Download</dt>
                    <dd>
                      <span v-if="runItemStatusLabel(candidate.execution)" class="hx-pill" :data-tone="runItemStatusTone(candidate.execution)">{{ runItemStatusLabel(candidate.execution) }}</span>
                      <span class="rdl-timestamp" v-if="candidate.execution.startedAt">{{ formatTimestamp(candidate.execution.startedAt) }}</span>
                      <span class="rdl-errmsg" v-if="candidate.execution.runErrorMessage">{{ candidate.execution.runErrorMessage }}</span>
                    </dd>
                  </div>
                  <div class="rdl-field" v-if="candidate.apply">
                    <dt>Import</dt>
                    <dd>
                      <span v-if="runItemStatusLabel(candidate.apply)" class="hx-pill" :data-tone="runItemStatusTone(candidate.apply)">{{ runItemStatusLabel(candidate.apply) }}</span>
                      <span class="rdl-timestamp" v-if="candidate.apply.startedAt">{{ formatTimestamp(candidate.apply.startedAt) }}</span>
                      <span class="rdl-errmsg" v-if="candidate.apply.runErrorMessage">{{ candidate.apply.runErrorMessage }}</span>
                    </dd>
                  </div>
                </dl>
                <router-link
                  :to="{ name: 'activity-candidates', query: { candidate: candidate.id } }"
                  class="hx-btn rdl-candidate-link"
                  data-variant="ghost"
                >Open in import review</router-link>
              </div>
            </details>
          </div>
        </div>
      </article>

      <article v-else-if="hasImportCandidate" class="hx-card">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Import pipeline</h2>
            <p class="hx-card-subtitle">Linked import candidate status.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <div class="rdl-pipeline">
            <div class="rdl-pipeline-status">
              <span class="hx-pill" :data-tone="importStatusTone">{{ importStatusLabel }}</span>
              <span class="hx-text-muted rdl-pipeline-id">Candidate {{ importCandidateId?.substring(0, 8) }}…</span>
            </div>
            <p class="hx-text-muted" v-if="mediaRequest?.fulfillmentStatus?.detail">{{ mediaRequest.fulfillmentStatus.detail }}</p>
            <router-link
              v-if="importReviewLink"
              :to="importReviewLink"
              class="hx-btn"
              data-variant="ghost"
            >Open in import review</router-link>
          </div>
        </div>
      </article>

      <RequestEventTimeline
        :events="events"
        :eligible-users="eligibleUsers.value"
        :has-more="hasMoreEvents"
        :is-loading-more="isLoadingMoreEvents"
        @load-more="loadMoreEvents({ mediaRequestId: route.params.id })"
      />

      <ReassignRequestModal
        v-if="reassignTarget"
        :open="reassignModalOpen"
        :request="reassignTarget"
        :eligible-users="eligibleUsers.value"
        :is-loading-users="isLoadingUsers.value"
        :events="reassignEvents.value"
        :is-loading-history="isLoadingHistory.value"
        :is-reassigning="isReassigning.value"
        :reassign-error="reassignError.value"
        :history-error="historyError.value"
        @reassign="handleReassign"
        @close="closeReassignModal"
        @load-history="handleLoadHistory"
        @load-users="handleLoadUsers"
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

.rdl-revalidating {
  display: inline-block;
  animation: hx-spin 1s linear infinite;
  color: var(--hx-text-muted);
}

@keyframes hx-spin {
  to { transform: rotate(360deg); }
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
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.rdl-url {
  word-break: break-all;
  font-family: var(--hx-font-mono);
  font-size: var(--hx-text-xs);
}

.rdl-pipeline {
  display: grid;
  gap: var(--hx-space-3);
}

.rdl-pipeline-status {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.rdl-pipeline-id {
  font-family: var(--hx-font-mono);
  font-size: var(--hx-text-xs);
}

.rdl-pipeline-loading {
  padding: var(--hx-space-3) var(--hx-space-4);
}

.rdl-pipeline-list {
  display: grid;
}

.rdl-candidate {
  border-bottom: 1px solid var(--hx-border);
}

.rdl-candidate:last-child {
  border-bottom: none;
}

.rdl-candidate-summary {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3) var(--hx-space-4);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  flex-wrap: wrap;
}

.rdl-candidate-summary:hover {
  background: var(--hx-surface-hover, rgba(0, 0, 0, 0.02));
}

.rdl-candidate-source {
  color: var(--hx-text-primary);
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rdl-candidate-meta {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}

.rdl-candidate-body {
  padding: 0 var(--hx-space-4) var(--hx-space-4);
  display: grid;
  gap: var(--hx-space-3);
}

.rdl-candidate-details {
  padding-top: var(--hx-space-2);
}

.rdl-candidate-link {
  justify-self: start;
}

.rdl-timestamp {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}

.rdl-errmsg {
  color: var(--hx-tone-danger, #e53e3e);
  font-size: var(--hx-text-xs);
}

.rdl-pipeline-steps {
  display: flex;
  align-items: center;
  gap: 0;
  padding: var(--hx-space-2) 0;
}

.rdl-step {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  position: relative;
}

.rdl-step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--hx-border);
}

.rdl-step[data-status="completed"] .rdl-step-dot {
  background: var(--hx-tone-success, #38a169);
}

.rdl-step[data-status="active"] .rdl-step-dot {
  background: var(--hx-accent-strong, #3182ce);
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.2);
}

.rdl-step[data-status="failed"] .rdl-step-dot {
  background: var(--hx-tone-danger, #e53e3e);
}

.rdl-step-line {
  width: 24px;
  height: 2px;
  background: var(--hx-border);
  flex-shrink: 0;
}

.rdl-step[data-status="completed"] + .rdl-step .rdl-step-line,
.rdl-step[data-status="completed"] .rdl-step-line {
  background: var(--hx-tone-success, #38a169);
}

.rdl-step-label {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
  white-space: nowrap;
}

.rdl-step[data-status="completed"] .rdl-step-label {
  color: var(--hx-tone-success, #38a169);
}

.rdl-step[data-status="active"] .rdl-step-label {
  color: var(--hx-accent-strong, #3182ce);
  font-weight: 600;
}

.rdl-step[data-status="failed"] .rdl-step-label {
  color: var(--hx-tone-danger, #e53e3e);
}

@media (max-width: 640px) {
  .rdl-field {
    grid-template-columns: 1fr;
  }

  .rdl-pipeline-steps {
    flex-wrap: wrap;
    gap: var(--hx-space-1);
  }

  .rdl-step-line {
    width: 12px;
  }
}
</style>
