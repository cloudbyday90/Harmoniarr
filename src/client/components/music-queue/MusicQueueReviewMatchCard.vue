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
defineProps({
  actionRunning: {
    default: '',
    type: String,
  },
  match: {
    required: true,
    type: Object,
  },
  showActions: {
    default: false,
    type: Boolean,
  },
});

defineEmits(['reject-match', 'use-match']);
</script>

<template>
  <article class="music-queue-review-match" role="listitem">
    <div class="music-queue-review-match__header">
      <div>
        <h4>{{ match.label }}<span v-if="match.isBest"> · Best ranked</span></h4>
        <p>{{ match.reason }}</p>
      </div>
      <span class="hx-pill" :data-tone="match.statusTone">{{ match.statusLabel }}</span>
    </div>

    <dl class="music-queue-review-match__facts">
      <div>
        <dt>Score</dt>
        <dd>{{ match.scoreLabel }}</dd>
      </div>
      <div>
        <dt>Quality</dt>
        <dd><span class="hx-pill" :data-tone="match.qualityFitTone">{{ match.qualityFitLabel }}</span></dd>
      </div>
      <div>
        <dt>Format</dt>
        <dd>{{ match.formatLabel }}</dd>
      </div>
      <div>
        <dt>Tracks</dt>
        <dd>{{ match.trackCoverageLabel }}</dd>
      </div>
      <div>
        <dt>Files</dt>
        <dd>{{ match.fileLabel }}</dd>
      </div>
      <div>
        <dt>Size</dt>
        <dd>{{ match.sizeLabel }}</dd>
      </div>
      <div>
        <dt>Source health</dt>
        <dd>{{ match.healthLabel }}</dd>
      </div>
    </dl>

    <dl v-if="match.qualityRows?.length" class="music-queue-review-match__quality" aria-label="Match quality details">
      <template v-for="row in match.qualityRows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd><span class="hx-pill" :data-tone="row.tone">{{ row.value }}</span></dd>
      </template>
    </dl>

    <div v-if="showActions && (match.canUseMatch || match.canRejectMatch)" class="music-queue-review-match__actions">
      <button
        v-if="match.canUseMatch"
        type="button"
        class="hx-btn"
        data-variant="primary"
        :disabled="Boolean(actionRunning)"
        @click="$emit('use-match', match)"
      >
        {{ actionRunning === 'use' ? 'Selecting...' : 'Use this match' }}
      </button>
      <button
        v-if="match.canRejectMatch"
        type="button"
        class="hx-btn"
        data-variant="ghost"
        :disabled="Boolean(actionRunning)"
        @click="$emit('reject-match', match)"
      >
        {{ actionRunning === 'reject' ? 'Rejecting...' : 'Reject match' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.music-queue-review-match {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-muted);
}

.music-queue-review-match__header {
  display: flex;
  gap: var(--hx-space-3);
  align-items: start;
  justify-content: space-between;
}

.music-queue-review-match h4,
.music-queue-review-match p,
.music-queue-review-match__facts {
  margin: 0;
}

.music-queue-review-match p,
.music-queue-review-match__facts dt {
  color: var(--hx-text-muted);
}

.music-queue-review-match__facts {
  display: grid;
  gap: var(--hx-space-2);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.music-queue-review-match__facts div {
  display: grid;
  gap: 4px;
}

.music-queue-review-match__facts dt,
.music-queue-review-match__quality dt {
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-queue-review-match__facts dd,
.music-queue-review-match__quality dd {
  margin: 0;
}

.music-queue-review-match__quality {
  display: grid;
  gap: var(--hx-space-2);
  grid-template-columns: minmax(96px, auto) 1fr;
  margin: 0;
  padding-top: var(--hx-space-3);
  border-top: 1px solid var(--hx-border);
}

.music-queue-review-match__quality dt {
  color: var(--hx-text-muted);
}

.music-queue-review-match__quality dd {
  text-align: right;
}

.music-queue-review-match__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

@media (max-width: 440px) {
  .music-queue-review-match__header {
    flex-direction: column;
  }
}
</style>
