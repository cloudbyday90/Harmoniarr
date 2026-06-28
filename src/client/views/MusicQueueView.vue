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
import { useMusicQueue } from '../composables/useMusicQueue.js';

const {
  errorMessage,
  isLoading,
  isRevalidating,
  load,
  releases,
  summaryCards,
  totalCount,
} = useMusicQueue();
</script>

<template>
  <section class="music-queue-view">
    <header class="music-queue-header">
      <div>
        <p class="hx-eyebrow">Music Queue</p>
        <h1>Music Queue</h1>
        <p class="music-queue-copy">
          Releases Harmoniarr is searching, downloading, checking, and adding to your library.
        </p>
      </div>
      <button type="button" class="hx-btn" :disabled="isRevalidating" @click="load">
        {{ isRevalidating ? 'Refreshing...' : 'Refresh' }}
      </button>
    </header>

    <div class="music-queue-summary">
      <article v-for="card in summaryCards" :key="card.key" class="music-queue-summary-card">
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <div v-if="errorMessage" class="hx-alert" data-tone="danger">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="music-queue-panel">
      Loading Music Queue...
    </div>

    <div v-else-if="!releases.length" class="music-queue-panel music-queue-empty">
      <h2>Nothing is queued right now</h2>
      <p>Monitored artists and requested releases will appear here when Harmoniarr has music to look for.</p>
    </div>

    <div v-else class="music-queue-panel">
      <div class="music-queue-panel-header">
        <h2>Queued music</h2>
        <span>{{ totalCount }} release{{ totalCount === 1 ? '' : 's' }}</span>
      </div>

      <div class="music-queue-list" role="list">
        <article v-for="release in releases" :key="release.id" class="music-queue-row" role="listitem">
          <div class="music-queue-row-main">
            <span class="review-status-pill" :class="release.statusClass">{{ release.status.label }}</span>
            <h3>{{ release.releaseTitle }}</h3>
            <p>{{ release.artistName }} · {{ release.coverageLabel }} · {{ release.qualityProfileLabel }}</p>
          </div>
          <div class="music-queue-row-detail">
            <strong>{{ release.status.message }}</strong>
            <span>{{ release.qualityDecisionLabel }}</span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.music-queue-view {
  display: grid;
  gap: 24px;
  padding: 32px clamp(18px, 4vw, 48px);
}

.music-queue-header,
.music-queue-panel-header,
.music-queue-row {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.music-queue-header h1 {
  margin: 0;
}

.music-queue-copy,
.music-queue-panel-header span,
.music-queue-row p,
.music-queue-row-detail span,
.music-queue-empty p {
  color: var(--hx-text-muted);
}

.music-queue-summary {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.music-queue-summary-card,
.music-queue-panel {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: 8px;
}

.music-queue-summary-card {
  display: grid;
  gap: 10px;
  padding: 18px;
}

.music-queue-summary-card span {
  color: var(--hx-text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-queue-summary-card strong {
  font-size: 32px;
}

.music-queue-panel {
  padding: 20px;
}

.music-queue-list {
  display: grid;
}

.music-queue-row {
  border-top: 1px solid var(--hx-border);
  padding: 18px 0;
}

.music-queue-row:first-child {
  border-top: 0;
}

.music-queue-row-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.music-queue-row-main h3,
.music-queue-row-main p {
  margin: 0;
}

.music-queue-row-detail {
  display: grid;
  gap: 6px;
  max-width: 360px;
  text-align: right;
}

.music-queue-empty {
  padding: 48px 20px;
  text-align: center;
}

@media (max-width: 720px) {
  .music-queue-header,
  .music-queue-panel-header,
  .music-queue-row {
    align-items: stretch;
    flex-direction: column;
  }

  .music-queue-row-detail {
    max-width: none;
    text-align: left;
  }
}
</style>
