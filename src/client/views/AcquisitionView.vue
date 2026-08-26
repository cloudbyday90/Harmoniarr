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
import { computed } from 'vue';
import MusicQueueProgressStrip from '../components/music-queue/MusicQueueProgressStrip.vue';
import { useAcquisitionOverview } from '../composables/useAcquisitionOverview.js';
import {
  buildAcquisitionOverviewCards,
  buildAcquisitionTransferPanel,
} from '../lib/acquisition-overview-presentation.js';
import { buildAcquisitionReleaseTransferProgress } from '../lib/acquisition-release-transfer-presentation.js';
import { sessionStore } from '../state/session.js';

const canViewDownloader = computed(() => sessionStore.state.user?.role === 'admin');
const {
  downloadErrorMessage,
  downloaderQueue,
  downloadIsLoading,
  isRevalidating,
  musicQueueErrorMessage,
  musicQueueIsLoading,
  refresh,
  releases,
} = useAcquisitionOverview({ canViewDownloader });

const summaryCards = computed(() => buildAcquisitionOverviewCards({
  canViewDownloader: canViewDownloader.value,
  downloaderQueue: downloaderQueue.value,
  releases: releases.value,
}));
const transferPanel = computed(() => buildAcquisitionTransferPanel(downloaderQueue.value, {
  canViewDownloader: canViewDownloader.value,
}));
const transferProgressByRelease = computed(() => (
  canViewDownloader.value
    ? buildAcquisitionReleaseTransferProgress(downloaderQueue.value)
    : {}
));

function refreshOverview() {
  void refresh();
}
</script>

<template>
  <section class="hx-page acquisition-overview">
    <header class="hx-page-header acquisition-overview__header">
      <div>
        <p class="hx-eyebrow">Acquisition</p>
        <h1 class="hx-page-title">Acquisition overview</h1>
        <p class="hx-page-subtitle">
          See the release steps Harmoniarr is working through and the live transfers supporting them.
          Open Music Queue or Downloader when you want to act.
        </p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" :disabled="isRevalidating" @click="refreshOverview">
          {{ isRevalidating ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <section class="hx-stat-grid" aria-label="Acquisition summary">
      <article v-for="card in summaryCards" :key="card.key" class="hx-stat">
        <span class="hx-stat-label">{{ card.label }}</span>
        <span class="hx-stat-value">{{ card.value }}</span>
        <span class="hx-pill acquisition-overview__stat-pill" :data-tone="card.tone">{{ card.meta }}</span>
      </article>
    </section>

    <div class="acquisition-overview__lanes">
      <MusicQueueProgressStrip
        active-or-attention-only
        :error-message="musicQueueErrorMessage"
        heading="Release work"
        :is-loading="musicQueueIsLoading"
        :releases="releases"
        show-empty
        :transfer-progress-by-release="transferProgressByRelease"
      />

      <section class="hx-card acquisition-overview__downloads" aria-labelledby="acquisition-download-progress-heading">
        <header class="hx-card-header acquisition-overview__downloads-header">
          <div>
            <h2 id="acquisition-download-progress-heading" class="hx-card-title">{{ transferPanel.title }}</h2>
            <p class="hx-card-subtitle">{{ transferPanel.body }}</p>
          </div>
          <RouterLink
            v-if="canViewDownloader"
            class="hx-btn"
            data-variant="ghost"
            :to="{ name: 'downloader' }"
          >
            Open Downloader
          </RouterLink>
        </header>

        <div class="hx-card-body acquisition-overview__downloads-body">
          <div v-if="canViewDownloader && downloadIsLoading && !downloaderQueue" class="hx-skeleton-stack" aria-label="Loading download progress" aria-busy="true">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>

          <p v-else-if="canViewDownloader && downloadErrorMessage" class="acquisition-overview__message" role="status" aria-live="polite">
            Download progress could not be refreshed. Open Downloader to try again.
          </p>

          <div v-else-if="transferPanel.state === 'setup'" class="acquisition-overview__empty">
            <p>{{ transferPanel.body }}</p>
            <RouterLink class="hx-btn" :to="{ name: 'settings-connections' }">Set up Soulseek</RouterLink>
          </div>

          <p v-else-if="transferPanel.state !== 'available'" class="acquisition-overview__message">
            {{ transferPanel.body }}
          </p>

          <ul v-else class="acquisition-overview__transfer-list" role="list">
            <li v-for="transfer in transferPanel.rows" :key="transfer.id" class="acquisition-overview__transfer-row">
              <div class="acquisition-overview__transfer-content">
                <div class="acquisition-overview__transfer-heading">
                  <strong>{{ transfer.title }}</strong>
                  <span class="hx-pill" :data-tone="transfer.statusTone">{{ transfer.statusLabel }}</span>
                </div>
                <p>{{ transfer.detail }}</p>
                <div class="acquisition-overview__transfer-progress">
                  <progress
                    v-if="transfer.progressValue !== null"
                    :aria-label="`${transfer.title}: ${transfer.progressLabel}`"
                    :value="transfer.progressValue"
                    max="100"
                  >{{ transfer.progressLabel }}</progress>
                  <span>{{ transfer.progressLabel }}</span>
                </div>
              </div>
              <RouterLink
                v-if="transfer.location"
                class="hx-btn"
                data-variant="ghost"
                :aria-label="transfer.action?.accessibleLabel"
                :to="transfer.location"
              >
                {{ transfer.action?.label ?? 'Open' }}
              </RouterLink>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.acquisition-overview {
  display: grid;
  gap: var(--hx-space-6);
  max-width: 1600px;
}

.acquisition-overview__header {
  align-items: flex-start;
}

.acquisition-overview__stat-pill {
  align-self: start;
  max-width: 100%;
  white-space: normal;
}

.acquisition-overview__lanes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hx-space-5);
  align-items: start;
}

.acquisition-overview__downloads-header {
  align-items: center;
}

.acquisition-overview__downloads-body {
  padding-top: 0;
}

.acquisition-overview__message {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.acquisition-overview__empty {
  display: grid;
  gap: var(--hx-space-3);
  justify-items: start;
}

.acquisition-overview__empty p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.5;
}

.acquisition-overview__transfer-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.acquisition-overview__transfer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-3) 0;
  border-top: 1px solid var(--hx-border-subtle);
}

.acquisition-overview__transfer-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.acquisition-overview__transfer-content {
  display: grid;
  min-width: 0;
  gap: var(--hx-space-1);
}

.acquisition-overview__transfer-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.acquisition-overview__transfer-heading strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acquisition-overview__transfer-content p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.45;
}

.acquisition-overview__transfer-progress {
  display: inline-flex;
  align-items: center;
  gap: var(--hx-space-2);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
}

.acquisition-overview__transfer-progress progress {
  width: 116px;
  height: 7px;
  accent-color: var(--hx-accent);
}

@media (max-width: 960px) {
  .acquisition-overview__lanes {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .acquisition-overview__transfer-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .acquisition-overview__transfer-heading strong {
    white-space: normal;
  }
}
</style>
