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
import {
  canStartArtworkCleanup,
  getArtworkCleanupDetailTitle,
  getArtworkCleanupHistorySummary,
  getArtworkCleanupRunStatusClass,
  getArtworkCleanupRunStatusLabel,
  getArtworkMaintenanceStatusClass,
  getArtworkMaintenanceStatusLabel,
} from '../lib/artwork-maintenance-status.js';

defineProps({
  actionErrorMessage: {
    type: String,
    default: '',
  },
  errorMessage: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isLoadingRunDetail: {
    type: Boolean,
    default: false,
  },
  isStarting: {
    type: Boolean,
    default: false,
  },
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  runHistoryPayload: {
    type: Object,
    default: null,
  },
  selectedRunDetailPayload: {
    type: Object,
    default: null,
  },
  selectedRunId: {
    type: String,
    default: null,
  },
  summaryPayload: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'select-run', 'start']);
</script>

<template>
  <article class="panel-light library-scan-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Artwork maintenance</p>
        <h3>Retention cleanup</h3>
        <p class="metadata-card-copy" v-if="summaryPayload">{{ summaryPayload.summary.message }}</p>
      </div>
      <div class="library-scan-actions">
        <button
          v-if="canStartArtworkCleanup(summaryPayload)"
          type="button"
          class="library-scan-start-button"
          :disabled="isStarting"
          @click="emit('start')"
        >
          {{ isStarting ? 'Starting…' : 'Run cleanup' }}
        </button>
        <button type="button" class="review-reset-button" @click="emit('refresh')">Refresh</button>
      </div>
    </div>

    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="error-panel panel-light" v-if="errorMessage">
      <h3>Artwork summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p v-else-if="isLoading">Loading artwork retention state and latest cleanup run.</p>

    <template v-else-if="summaryPayload">
      <div class="pill-row onboarding-pill-row">
        <div class="pill">
          <span>Cleanup state</span>
          <strong>{{ getArtworkMaintenanceStatusLabel(summaryPayload.summary.status) }}</strong>
        </div>
        <div class="pill">
          <span>Latest run</span>
          <strong>{{ getArtworkCleanupRunStatusLabel(summaryPayload.latestRun?.status) }}</strong>
        </div>
      </div>

      <div class="library-scan-summary-grid">
        <article class="onboarding-step-card">
          <div class="review-detail-header">
            <div>
              <p>Retention window</p>
              <strong>{{ summaryPayload.summary.message }}</strong>
            </div>
            <span class="review-status-pill" :class="getArtworkMaintenanceStatusClass(summaryPayload.summary.status)">
              {{ getArtworkMaintenanceStatusLabel(summaryPayload.summary.status) }}
            </span>
          </div>
          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Retention days</dt>
              <dd>{{ summaryPayload.cleanup?.unassignedRetentionDays ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Retention cutoff</dt>
              <dd>{{ summaryPayload.cleanup?.retentionCutoff ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Unassigned assets</dt>
              <dd>{{ summaryPayload.inventory?.unassignedAssetCount ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Eligible now</dt>
              <dd>{{ summaryPayload.inventory?.eligibleAssetCount ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Oldest unassigned</dt>
              <dd>{{ summaryPayload.inventory?.oldestUnassignedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{{ summaryPayload.checkedAt ?? 'Unavailable' }}</dd>
            </div>
          </dl>
        </article>

        <article class="onboarding-step-card">
          <div class="review-detail-header">
            <div>
              <p>Latest cleanup run</p>
              <strong>
                {{ summaryPayload.latestRun
                  ? `The latest cleanup run deleted ${summaryPayload.latestRun.deletedAssetCount ?? 0} asset${summaryPayload.latestRun?.deletedAssetCount === 1 ? '' : 's'}.`
                  : 'No artwork cleanup run has been recorded yet.' }}
              </strong>
            </div>
            <span class="review-status-pill" :class="getArtworkCleanupRunStatusClass(summaryPayload.latestRun?.status)">
              {{ getArtworkCleanupRunStatusLabel(summaryPayload.latestRun?.status) }}
            </span>
          </div>
          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Started</dt>
              <dd>{{ summaryPayload.latestRun?.startedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>{{ summaryPayload.latestRun?.finishedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Requested</dt>
              <dd>{{ summaryPayload.latestRun?.requestedAssetCount ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Scanned</dt>
              <dd>{{ summaryPayload.latestRun?.scannedAssetCount ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Deleted assets</dt>
              <dd>{{ summaryPayload.latestRun?.deletedAssetCount ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Missing files</dt>
              <dd>{{ summaryPayload.latestRun?.missingFileCount ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Failed assets</dt>
              <dd>{{ summaryPayload.latestRun?.failedAssetCount ?? 'Unavailable' }}</dd>
            </div>
          </dl>
        </article>

        <article class="onboarding-step-card" v-if="(runHistoryPayload?.runs?.length ?? 0) > 0">
          <div class="review-detail-header">
            <div>
              <p>Recent cleanup history</p>
              <strong>The last {{ runHistoryPayload.runs.length }} artwork cleanup run{{ runHistoryPayload.runs.length === 1 ? '' : 's' }}.</strong>
            </div>
            <span class="review-status-pill review-status-held">Checked {{ runHistoryPayload.checkedAt ?? 'Unavailable' }}</span>
          </div>
          <div class="review-file-list">
            <button
              v-for="run in runHistoryPayload.runs"
              :key="run.id"
              type="button"
              class="review-list-item"
              :class="{ 'is-selected': run.id === selectedRunId }"
              @click="emit('select-run', run.id)"
            >
              <div class="review-detail-header">
                <div>
                  <p>{{ run.startedAt ?? 'Unknown start' }}</p>
                  <strong>{{ getArtworkCleanupHistorySummary(run) }}</strong>
                </div>
                <span class="review-status-pill" :class="getArtworkCleanupRunStatusClass(run.status)">
                  {{ getArtworkCleanupRunStatusLabel(run.status) }}
                </span>
              </div>
              <dl class="review-meta-grid onboarding-meta-grid">
                <div>
                  <dt>Requested</dt>
                  <dd>{{ run.requestedAssetCount ?? 'Unavailable' }}</dd>
                </div>
                <div>
                  <dt>Deleted</dt>
                  <dd>{{ run.deletedAssetCount ?? 'Unavailable' }}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{{ run.failedAssetCount ?? 'Unavailable' }}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{{ run.finishedAt ?? 'Not yet recorded' }}</dd>
                </div>
              </dl>
            </button>
          </div>
        </article>

        <article class="onboarding-step-card" v-if="selectedRunDetailPayload || runDetailErrorMessage || isLoadingRunDetail">
          <div class="review-detail-header">
            <div>
              <p>Run details</p>
              <strong v-if="selectedRunDetailPayload?.run">{{ getArtworkCleanupDetailTitle(selectedRunDetailPayload.run) }}</strong>
              <strong v-else-if="runDetailErrorMessage">Run details unavailable</strong>
              <strong v-else>Loading selected cleanup run details.</strong>
            </div>
            <span
              v-if="selectedRunDetailPayload?.run"
              class="review-status-pill"
              :class="getArtworkCleanupRunStatusClass(selectedRunDetailPayload.run.status)"
            >
              {{ getArtworkCleanupRunStatusLabel(selectedRunDetailPayload.run.status) }}
            </span>
          </div>

          <p v-if="isLoadingRunDetail">Loading selected cleanup run details.</p>
          <p class="error-copy" v-else-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>

          <template v-else-if="selectedRunDetailPayload?.run">
            <p class="metadata-card-copy">{{ getArtworkCleanupHistorySummary(selectedRunDetailPayload.run) }}</p>
            <dl class="review-meta-grid onboarding-meta-grid">
              <div>
                <dt>Run id</dt>
                <dd>{{ selectedRunDetailPayload.run.id }}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{{ selectedRunDetailPayload.run.startedAt ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{{ selectedRunDetailPayload.run.finishedAt ?? 'Not yet recorded' }}</dd>
              </div>
              <div>
                <dt>Retention cutoff</dt>
                <dd>{{ selectedRunDetailPayload.run.retentionCutoff ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Requested</dt>
                <dd>{{ selectedRunDetailPayload.run.requestedAssetCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Scanned</dt>
                <dd>{{ selectedRunDetailPayload.run.scannedAssetCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Deleted assets</dt>
                <dd>{{ selectedRunDetailPayload.run.deletedAssetCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Deleted files</dt>
                <dd>{{ selectedRunDetailPayload.run.deletedFileCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Missing files</dt>
                <dd>{{ selectedRunDetailPayload.run.missingFileCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Failed assets</dt>
                <dd>{{ selectedRunDetailPayload.run.failedAssetCount ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Checked</dt>
                <dd>{{ selectedRunDetailPayload.checkedAt ?? 'Unavailable' }}</dd>
              </div>
            </dl>

            <div class="review-file-list" v-if="(selectedRunDetailPayload.run.failures?.length ?? 0) > 0">
              <article class="review-list-item" v-for="failure in selectedRunDetailPayload.run.failures" :key="`${failure.artworkAssetId}-${failure.relativePath}`">
                <div class="review-detail-header">
                  <div>
                    <p>Cleanup failure</p>
                    <strong>{{ failure.relativePath ?? 'Unknown artwork path' }}</strong>
                  </div>
                  <span class="review-status-pill review-status-failed">{{ failure.code ?? 'artwork_cleanup_failed' }}</span>
                </div>
                <p class="metadata-card-copy">{{ failure.message ?? 'Artwork cleanup failed.' }}</p>
                <dl class="review-meta-grid onboarding-meta-grid">
                  <div>
                    <dt>Artwork asset</dt>
                    <dd>{{ failure.artworkAssetId ?? 'Unavailable' }}</dd>
                  </div>
                  <div>
                    <dt>Relative path</dt>
                    <dd>{{ failure.relativePath ?? 'Unavailable' }}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </template>
        </article>
      </div>
    </template>
  </article>
</template>