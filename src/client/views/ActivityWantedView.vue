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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useDownloadRecoveryRetry } from '../composables/useDownloadRecoveryRetry.js';
import { useLibraryDiscoverySummary } from '../composables/useLibraryDiscoverySummary.js';
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import {
  buildDiscoveryDispatchHandoffMessage,
  getDiscoveryQueueStatusLabel,
} from '../lib/library-status-presentation.js';
import { buildWantedDiscoveryCandidateLocation } from '../lib/wanted-discovery-candidate-link.js';
import {
  buildDiscoveryDispatchResult,
  buildDownloadRecoveryNotice,
  buildImportExecutionReadinessGuidance,
  buildImportReviewWorkflowResult,
  buildWantedReleasesCardSubtitle,
  formatLastReconciledAt,
  getWantedStatusLabel,
  getWantedStatusTone,
} from '../lib/wanted-release-normalization.js';

const wanted = useLibraryWantedSummary({ pollIntervalMs: 30000, revalidateOnFocus: true });
const releases = useLibraryWantedReleases({ pollIntervalMs: 30000, revalidateOnFocus: true });
const discovery = useLibraryDiscoverySummary({ pollIntervalMs: 30000, revalidateOnFocus: true });
const recoveryRetry = useDownloadRecoveryRetry();

const isRefreshing = computed(() => wanted.isRevalidating.value
  || releases.isRevalidating.value
  || discovery.isRevalidating.value);
const discoveryHandoffMessage = computed(() => buildDiscoveryDispatchHandoffMessage(discovery.discoverySummary.value));
const discoveryStatusLabel = computed(() => getDiscoveryQueueStatusLabel(discovery.summary.value?.status));

const wantedReleasesWithNotices = computed(() =>
  releases.wantedReleases.value.map((release) => ({
    candidateLocation: buildWantedDiscoveryCandidateLocation(release),
    dispatchResult: buildDiscoveryDispatchResult(release),
    notice: buildDownloadRecoveryNotice(release),
    readinessGuidance: buildImportExecutionReadinessGuidance(release),
    release,
    workflowResult: buildImportReviewWorkflowResult(release),
  })),
);

function refresh() {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases();
  discovery.loadLibraryDiscoverySummary();
}

async function startDiscoveryDispatch() {
  const result = await discovery.startDiscoveryDispatch();
  if (result) {
    refresh();
  }
}

async function retryDownloadRecovery(release) {
  const result = await recoveryRetry.retryDownloadRecovery(release);
  if (result.ok) {
    refresh();
  }
}

onMounted(() => {
  refresh();
  wanted.attachVisibilityListener();
  releases.attachVisibilityListener();
  discovery.attachVisibilityListener();
});

onBeforeUnmount(() => {
  wanted.destroy();
  releases.destroy();
  discovery.destroy();
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Wanted</h2>
        <p class="hx-page-subtitle">Monitored releases pending acquisition.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="refresh" :disabled="wanted.isLoading.value || releases.isLoading.value || isRefreshing">
          {{ (wanted.isLoading.value || releases.isLoading.value || isRefreshing) ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="wanted.errorMessage.value || releases.errorMessage.value" class="hx-card">
      <div class="hx-card-body">
        <span v-if="wanted.errorMessage.value" class="hx-pill" data-tone="danger">{{ wanted.errorMessage.value }}</span>
        <span v-if="releases.errorMessage.value" class="hx-pill" data-tone="danger">{{ releases.errorMessage.value }}</span>
      </div>
    </article>

    <section class="hx-stat-grid" v-if="wanted.libraryWantedSummary.value">
      <article class="hx-stat-card">
        <span class="hx-stat-label">Monitored artists</span>
        <span class="hx-stat-value">{{ wanted.monitoredArtistCount.value }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Wanted releases</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.totalWanted ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Missing</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.missing ?? 0 }}</span>
      </article>
      <article class="hx-stat-card">
        <span class="hx-stat-label">Partial</span>
        <span class="hx-stat-value">{{ wanted.releaseCounts.value?.partial ?? 0 }}</span>
      </article>
    </section>

    <article class="hx-card" v-if="wanted.summary.value">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Acquisition status</h3>
          <p class="hx-card-subtitle">{{ formatLastReconciledAt(wanted.libraryWantedSummary.value?.lastReconciledAt) }}</p>
        </div>
      </header>
      <div class="hx-card-body">
        <p>{{ wanted.summary.value.message }}</p>
      </div>
    </article>

    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Discovery dispatch</h3>
          <p class="hx-card-subtitle">
            Sends wanted releases to Soulseek search before Import Review and Downloader activity can appear.
          </p>
        </div>
        <div class="hx-card-actions">
          <span v-if="discovery.summary.value" class="hx-pill" :data-tone="discovery.summary.value.status === 'ready' ? 'info' : null">
            {{ discoveryStatusLabel }}
          </span>
          <button
            type="button"
            class="hx-btn"
            data-variant="primary"
            :disabled="!discovery.canStartDiscovery.value || discovery.isStartingDiscovery.value"
            @click="startDiscoveryDispatch"
          >
            {{ discovery.isStartingDiscovery.value ? 'Starting…' : 'Run discovery now' }}
          </button>
        </div>
      </header>
      <div class="hx-card-body discovery-dispatch-panel">
        <span v-if="discovery.errorMessage.value" class="hx-pill" data-tone="danger">{{ discovery.errorMessage.value }}</span>
        <span v-if="discovery.startErrorMessage.value" class="hx-pill" data-tone="danger">{{ discovery.startErrorMessage.value }}</span>

        <p class="discovery-dispatch-message">{{ discoveryHandoffMessage }}</p>

        <dl class="discovery-dispatch-counts" aria-label="Discovery dispatch queue counts">
          <div>
            <dt>Ready</dt>
            <dd>{{ discovery.requestCounts.value.ready }}</dd>
          </div>
          <div>
            <dt>Cooling down</dt>
            <dd>{{ discovery.requestCounts.value.cooldown }}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd>{{ discovery.requestCounts.value.blocked }}</dd>
          </div>
        </dl>

        <p v-if="discovery.latestRun.value" class="hx-text-muted discovery-dispatch-latest">
          Latest run:
          {{ discovery.latestRun.value.status }}
          <span v-if="discovery.latestRun.value.startedAt">
            at {{ formatOperationTimestampShort(discovery.latestRun.value.startedAt) }}
          </span>
          <span v-if="discovery.latestRun.value.dispatchedCount != null">
            · {{ discovery.latestRun.value.dispatchedCount }} dispatched
          </span>
          <span v-if="discovery.latestRun.value.candidateCount != null">
            · {{ discovery.latestRun.value.candidateCount }} candidates
          </span>
        </p>
      </div>
    </article>

    <article class="hx-card" v-if="releases.wantedReleases.value.length > 0">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Wanted releases</h3>
          <p class="hx-card-subtitle">{{ buildWantedReleasesCardSubtitle(releases.totalCount.value) }}</p>
        </div>
      </header>
      <div class="hx-card-body hx-card-body--flush">
        <table class="hx-table" aria-label="Wanted releases">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Release group</th>
              <th>Release</th>
              <th>Type</th>
              <th>Status</th>
              <th class="hx-table-num">Expected</th>
              <th class="hx-table-num">Matched</th>
              <th class="hx-table-num">Missing</th>
              <th>Release date</th>
              <th>Discovery</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in wantedReleasesWithNotices" :key="item.release.id">
              <tr>
                <td>{{ item.release.artistName }}</td>
                <td>{{ item.release.releaseGroupTitle }}</td>
                <td>
                  {{ item.release.releaseTitle }}
                  <span v-if="item.release.releaseDisambiguation" class="hx-muted"> ({{ item.release.releaseDisambiguation }})</span>
                </td>
                <td>{{ item.release.releaseGroupType ?? '—' }}</td>
                <td>
                  <span class="hx-pill" :data-tone="getWantedStatusTone(item.release.wantedStatus)">
                    {{ getWantedStatusLabel(item.release.wantedStatus) }}
                  </span>
                </td>
                <td class="hx-table-num">{{ item.release.expectedTrackCount }}</td>
                <td class="hx-table-num">{{ item.release.matchedTrackCount }}</td>
                <td class="hx-table-num">{{ item.release.missingTrackCount }}</td>
                <td>{{ item.release.releaseDate ?? '—' }}</td>
                <td>
                  <div class="wanted-discovery-result">
                    <span class="hx-pill" :data-tone="item.dispatchResult.tone">
                      {{ item.dispatchResult.label }}
                    </span>
                    <span class="hx-text-muted">{{ item.dispatchResult.message }}</span>
                    <RouterLink
                      v-if="item.candidateLocation"
                      class="hx-btn wanted-discovery-link"
                      data-variant="ghost"
                      :to="item.candidateLocation"
                    >
                      Open candidates
                    </RouterLink>
                    <div v-if="item.workflowResult" class="wanted-candidate-workflow">
                      <span class="hx-pill" :data-tone="item.workflowResult.tone">
                        {{ item.workflowResult.label }}
                      </span>
                      <span class="hx-text-muted">{{ item.workflowResult.message }}</span>
                    </div>
                    <div
                      v-if="item.readinessGuidance"
                      class="wanted-readiness-guidance"
                      :data-tone="item.readinessGuidance.tone"
                      role="status"
                    >
                      <span class="hx-pill" :data-tone="item.readinessGuidance.tone">
                        {{ item.readinessGuidance.label }}
                      </span>
                      <strong>{{ item.readinessGuidance.title }}</strong>
                      <span class="hx-text-muted">{{ item.readinessGuidance.message }}</span>
                    </div>
                  </div>
                </td>
              </tr>
              <tr v-if="item.dispatchResult.details.length" :key="`${item.release.id}-dispatch-details`">
                <td colspan="10">
                  <dl class="wanted-discovery-details" aria-label="Discovery dispatch result details">
                    <template v-for="detail in item.dispatchResult.details" :key="detail.label">
                      <dt>{{ detail.label }}</dt>
                      <dd>{{ detail.value }}</dd>
                    </template>
                  </dl>
                </td>
              </tr>
              <tr v-if="item.notice" :key="`${item.release.id}-recovery`">
                <td colspan="10">
                  <div class="hx-recovery-notice" role="status">
                    <div>
                      <p class="hx-recovery-notice-title">{{ item.notice.title }}</p>
                      <p class="hx-text-muted">{{ item.notice.message }}</p>
                    </div>
                    <dl class="hx-recovery-notice-details">
                      <template v-for="detail in item.notice.details" :key="detail.label">
                        <dt>{{ detail.label }}</dt>
                        <dd>{{ detail.value }}</dd>
                      </template>
                    </dl>
                    <div class="hx-recovery-notice-actions">
                      <button
                        type="button"
                        class="hx-btn"
                        data-variant="primary"
                        :disabled="recoveryRetry.isRetrying(item.release)"
                        :aria-label="`Retry discovery for ${item.release.releaseTitle ?? 'this release'}`"
                        @click="retryDownloadRecovery(item.release)"
                      >
                        {{ recoveryRetry.isRetrying(item.release) ? 'Retrying…' : 'Retry discovery' }}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </article>

    <article class="hx-card" v-if="!wanted.libraryWantedSummary.value && !wanted.isLoading.value && !releases.isLoading.value">
      <div class="hx-card-body">
        <div class="hx-empty">
          <p class="hx-empty-title">No wanted data yet</p>
          <p class="hx-empty-copy">Trigger a library scan and reconciliation from Settings → Library to populate this view.</p>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.hx-recovery-notice {
  display: flex;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-3);
  border: 1px solid color-mix(in oklab, var(--hx-danger) 35%, var(--hx-border));
  border-radius: var(--hx-radius-md);
  background: color-mix(in oklab, var(--hx-danger) 8%, transparent);
}

.hx-recovery-notice-title {
  margin: 0 0 var(--hx-space-1);
  font-weight: 700;
  color: var(--hx-danger);
}

.hx-recovery-notice-details {
  display: grid;
  grid-template-columns: max-content max-content;
  gap: var(--hx-space-1) var(--hx-space-3);
  margin: 0;
  font-size: var(--hx-text-sm);
}

.hx-recovery-notice-details dt {
  color: var(--hx-text-muted);
}

.hx-recovery-notice-details dd {
  margin: 0;
  font-weight: 600;
}

.hx-recovery-notice-actions {
  display: flex;
  align-items: flex-start;
}

.discovery-dispatch-panel {
  display: grid;
  gap: var(--hx-space-3);
}

.discovery-dispatch-message {
  margin: 0;
  color: var(--hx-text);
}

.discovery-dispatch-counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--hx-space-3);
  margin: 0;
}

.discovery-dispatch-counts > div {
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-sunken);
}

.discovery-dispatch-counts dt {
  margin: 0 0 var(--hx-space-1);
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.discovery-dispatch-counts dd {
  margin: 0;
  color: var(--hx-text);
  font-size: var(--hx-text-xl);
  font-weight: 700;
}

.discovery-dispatch-latest {
  margin: 0;
}

.wanted-discovery-result {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 14rem;
}

.wanted-discovery-result .hx-text-muted {
  font-size: var(--hx-text-sm);
}

.wanted-discovery-link {
  justify-self: start;
  width: max-content;
  min-height: 0;
  padding: var(--hx-space-1) var(--hx-space-2);
  font-size: var(--hx-text-sm);
}

.wanted-candidate-workflow {
  display: grid;
  gap: var(--hx-space-1);
  margin-top: var(--hx-space-1);
}

.wanted-readiness-guidance {
  display: grid;
  gap: var(--hx-space-1);
  margin-top: var(--hx-space-2);
  padding: var(--hx-space-2);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-sunken);
}

.wanted-readiness-guidance .hx-pill {
  width: max-content;
}

.wanted-readiness-guidance strong {
  font-size: var(--hx-text-sm);
}

.wanted-discovery-details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2) var(--hx-space-4);
  margin: 0;
  padding: var(--hx-space-2) var(--hx-space-3);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-sunken);
  font-size: var(--hx-text-sm);
}

.wanted-discovery-details dt {
  color: var(--hx-text-muted);
}

.wanted-discovery-details dd {
  margin: 0;
  font-weight: 700;
}

@media (max-width: 720px) {
  .hx-recovery-notice {
    flex-direction: column;
  }

  .discovery-dispatch-counts {
    grid-template-columns: 1fr;
  }
}
</style>
