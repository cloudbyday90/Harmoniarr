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
import { useLibraryWantedSummary } from '../composables/useLibraryWantedSummary.js';
import { useLibraryWantedReleases } from '../composables/useLibraryWantedReleases.js';
import {
  buildDownloadRecoveryNotice,
  buildWantedReleasesCardSubtitle,
  formatLastReconciledAt,
  getWantedStatusLabel,
  getWantedStatusTone,
} from '../lib/wanted-release-normalization.js';

const wanted = useLibraryWantedSummary({ pollIntervalMs: 30000, revalidateOnFocus: true });
const releases = useLibraryWantedReleases({ pollIntervalMs: 30000, revalidateOnFocus: true });
const recoveryRetry = useDownloadRecoveryRetry();

const isRefreshing = computed(() => wanted.isRevalidating.value || releases.isRevalidating.value);

const wantedReleasesWithNotices = computed(() =>
  releases.wantedReleases.value.map((release) => ({
    notice: buildDownloadRecoveryNotice(release),
    release,
  })),
);

function refresh() {
  wanted.loadLibraryWantedSummary();
  releases.loadWantedReleases();
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
});

onBeforeUnmount(() => {
  wanted.destroy();
  releases.destroy();
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
              </tr>
              <tr v-if="item.notice" :key="`${item.release.id}-recovery`">
                <td colspan="9">
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

@media (max-width: 720px) {
  .hx-recovery-notice {
    flex-direction: column;
  }
}
</style>
