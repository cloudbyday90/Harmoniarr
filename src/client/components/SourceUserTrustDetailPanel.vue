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
import { computed, reactive, watch } from 'vue';
import {
  canPromoteSourceUserTrust,
  canResetSourceUserTrust,
  formatSourceUserConfidence,
  formatSourceUserEvidence,
  formatSourceUserHistoryActor,
  formatSourceUserHistoryKind,
  formatSourceUserHistorySummary,
  formatSourceUserHistoryTone,
  formatSourceUserReliabilityLabel,
  formatSourceUserReviewLabel,
  formatSourceUserReviewTone,
  formatSourceUsername,
  formatSourceUserTrustLabel,
  formatSourceUserTrustTone,
  formatSourceUserUpdatedAt,
  sourceUserTrustStateOptions,
} from '../lib/source-user-trust-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';

const props = defineProps({
  actionErrorMessage: { type: String, default: '' },
  checkedAt: { type: String, default: null },
  detail: { type: Object, default: null },
  errorMessage: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  isLoadingMoreHistory: { type: Boolean, default: false },
  isSaving: { type: Boolean, default: false },
});

const emit = defineEmits(['load-more-history', 'save-trust']);

const overrideForm = reactive({
  operatorNotes: '',
  reason: '',
  trustState: 'trusted',
});

const canPromote = computed(() => canPromoteSourceUserTrust(props.detail));
const canReset = computed(() => canResetSourceUserTrust(props.detail));
const hasHistory = computed(() => Array.isArray(props.detail?.trustHistory) && props.detail.trustHistory.length > 0);
const canLoadMoreHistory = computed(() => {
  const pagination = props.detail?.trustHistoryPagination;
  if (!pagination) {
    return false;
  }

  return props.detail.trustHistory.length < pagination.total;
});

watch(
  () => props.detail,
  (detail) => {
    overrideForm.operatorNotes = detail?.operatorNotes ?? '';
    overrideForm.reason = '';
    overrideForm.trustState = detail?.trustState === 'trusted' ? 'neutral' : 'trusted';
  },
  { immediate: true },
);

function selectTrustState(value) {
  overrideForm.trustState = value;
}

function submitOverride() {
  emit('save-trust', {
    operatorNotes: overrideForm.operatorNotes,
    reason: overrideForm.reason,
    trustState: overrideForm.trustState,
  });
}
</script>

<template>
  <article class="hx-card source-user-detail-panel">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Peer detail</h3>
        <p class="hx-card-subtitle">Inspect evidence provenance and record explicit trust overrides.</p>
      </div>
    </header>

    <div class="hx-card-body">
      <div v-if="errorMessage">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>

      <div v-else-if="isLoading" class="hx-skeleton-stack">
        <span class="hx-skeleton" data-size="lg"></span>
        <span class="hx-skeleton"></span>
        <span class="hx-skeleton"></span>
      </div>

      <div v-else-if="!detail" class="hx-empty">
        <p class="hx-empty-title">No source user selected</p>
        <p class="hx-empty-copy">Select a row from the trust ledger to inspect history and set trusted or neutral overrides.</p>
      </div>

      <template v-else>
        <div class="source-user-detail-header">
          <div>
            <strong class="source-user-detail-name">{{ formatSourceUsername(detail.username) }}</strong>
            <p class="hx-text-muted">Updated {{ formatSourceUserUpdatedAt(detail.updatedAt) }}</p>
          </div>
          <div class="source-user-detail-pills">
            <span class="hx-pill" :data-tone="formatSourceUserTrustTone(detail.trustState)">{{ formatSourceUserTrustLabel(detail.trustState) }}</span>
            <span class="hx-pill" :data-tone="formatSourceUserReviewTone(detail.review.state)">{{ formatSourceUserReviewLabel(detail.review.state) }}</span>
          </div>
        </div>

        <div class="hx-stat-grid source-user-detail-stats">
          <div class="hx-stat">
            <span class="hx-stat-label">RELIABILITY</span>
            <span class="hx-stat-value source-user-detail-stat-value">{{ formatSourceUserReliabilityLabel(detail.reputation.reliability) }}</span>
            <span class="hx-stat-meta">{{ formatSourceUserConfidence(detail.reputation) }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">EVIDENCE</span>
            <span class="hx-stat-value source-user-detail-stat-value">{{ formatSourceUserEvidence(detail.reputation) }}</span>
            <span class="hx-stat-meta">{{ detail.reputation.evidenceCount }} recorded attempt{{ detail.reputation.evidenceCount === 1 ? '' : 's' }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">HISTORY</span>
            <span class="hx-stat-value source-user-detail-stat-value">{{ detail.trustHistoryPagination?.total ?? detail.trustHistoryCount ?? 0 }}</span>
            <span class="hx-stat-meta">{{ checkedAt ? `Read ${formatOperationTimestampShort(checkedAt)}` : 'Server detail snapshot' }}</span>
          </div>
        </div>

        <div class="source-user-detail-copy">
          <p class="hx-text-muted"><strong>Current rationale:</strong> {{ detail.review.reason }}</p>
          <p class="hx-text-muted"><strong>Operator notes:</strong> {{ detail.operatorNotes || '—' }}</p>
        </div>

        <div v-if="detail.trustState === 'blocked'" class="hx-empty source-user-detail-blocked">
          <p class="hx-empty-title">Blocked peers are managed from the blocklist</p>
          <p class="hx-empty-copy">Unblock the peer from the blocklist first, then return here to set neutral or trusted overrides.</p>
          <RouterLink :to="{ name: 'activity-blocklist' }" class="hx-btn">Open blocklist</RouterLink>
        </div>

        <form v-else class="source-user-override-form" @submit.prevent="submitOverride">
          <div class="hx-field">
            <label class="hx-field-label">Trust action</label>
            <div class="hx-tabbar-wrap">
              <nav class="hx-tabbar" aria-label="Trust state actions">
                <button
                  v-for="option in sourceUserTrustStateOptions"
                  :key="option.value"
                  type="button"
                  class="hx-tab"
                  :class="{ 'router-link-exact-active': overrideForm.trustState === option.value }"
                  :disabled="option.value === 'trusted' ? !canPromote : !canReset"
                  @click="selectTrustState(option.value)"
                >
                  {{ option.label }}
                </button>
              </nav>
            </div>
          </div>

          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label" for="source-user-override-reason">Reason</label>
              <input
                id="source-user-override-reason"
                v-model="overrideForm.reason"
                class="hx-input"
                type="text"
                autocomplete="off"
                spellcheck="false"
                placeholder="Explain why this override is safe"
              />
            </div>
          </div>

          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label" for="source-user-override-notes">Operator notes</label>
              <textarea
                id="source-user-override-notes"
                v-model="overrideForm.operatorNotes"
                class="hx-textarea"
                rows="4"
              ></textarea>
            </div>
          </div>

          <p v-if="actionErrorMessage" class="source-user-detail-error">{{ actionErrorMessage }}</p>

          <div class="hx-card-actions">
            <button type="submit" class="hx-btn" data-variant="primary" :disabled="isSaving || !overrideForm.reason.trim() || (overrideForm.trustState === 'trusted' ? !canPromote : !canReset)">
              {{ isSaving ? 'Saving…' : overrideForm.trustState === 'trusted' ? 'Save trusted override' : 'Save neutral override' }}
            </button>
          </div>
        </form>

        <div class="source-user-history" v-if="hasHistory">
          <p class="ops-section-label">Trust history <span v-if="detail.trustHistoryPagination" class="hx-text-muted">({{ detail.trustHistory.length }} of {{ detail.trustHistoryPagination.total }})</span></p>
          <div class="hx-table-scroll">
            <table class="hx-table" aria-label="Source user trust history">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Actor</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in detail.trustHistory" :key="entry.id">
                  <td>{{ entry.occurredAt ? formatOperationTimestampShort(entry.occurredAt) : '—' }}</td>
                  <td>
                    <span class="hx-pill" :data-tone="formatSourceUserHistoryTone(entry)">{{ formatSourceUserHistoryKind(entry.kind) }}</span>
                  </td>
                  <td>{{ formatSourceUserHistoryActor(entry) }}</td>
                  <td>{{ formatSourceUserHistorySummary(entry) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="canLoadMoreHistory" class="source-user-history-actions">
            <button class="hx-btn" :disabled="isLoadingMoreHistory" @click="emit('load-more-history')">
              {{ isLoadingMoreHistory ? 'Loading…' : 'Load more history' }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </article>
</template>

<style scoped>
.source-user-detail-panel {
  height: fit-content;
}

.source-user-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.source-user-detail-name {
  display: block;
  font-size: var(--hx-text-lg);
  color: var(--hx-text-strong);
}

.source-user-detail-header p,
.source-user-detail-copy p {
  margin: 0;
}

.source-user-detail-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.source-user-detail-stats {
  margin-block: var(--hx-space-4);
}

.source-user-detail-stat-value {
  font-size: var(--hx-text-sm);
}

.source-user-detail-copy {
  display: grid;
  gap: var(--hx-space-2);
  margin-bottom: var(--hx-space-4);
}

.source-user-detail-blocked {
  align-items: flex-start;
}

.source-user-override-form {
  display: grid;
  gap: var(--hx-space-3);
  margin-bottom: var(--hx-space-4);
}

.source-user-detail-error {
  margin: 0;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
}

.source-user-history {
  display: grid;
  gap: var(--hx-space-2);
}

.source-user-history-actions {
  display: flex;
  justify-content: center;
}

@media (max-width: 720px) {
  .source-user-detail-header {
    flex-direction: column;
  }
}
</style>
