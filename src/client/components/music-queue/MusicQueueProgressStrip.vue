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
import { RouterLink } from 'vue-router';
import { buildMusicQueueProgressStrip } from '../../lib/music-queue-progress-presentation.js';

const props = defineProps({
  activeOrAttentionOnly: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  heading: {
    type: String,
    default: 'Music Queue',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  releases: {
    type: Array,
    default: () => [],
  },
  releaseDetailsOnly: {
    type: Boolean,
    default: false,
  },
  showEmpty: {
    type: Boolean,
    default: false,
  },
  transferProgressByRelease: {
    type: Object,
    default: () => ({}),
  },
});

const progress = computed(() => buildMusicQueueProgressStrip(props.releases, {
  activeOrAttentionOnly: props.activeOrAttentionOnly,
  releaseDetailsOnly: props.releaseDetailsOnly,
  transferProgressByRelease: props.transferProgressByRelease,
}));
const headingId = computed(() => `music-queue-progress-${props.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

<template>
  <section class="hx-card music-queue-progress" :aria-labelledby="headingId">
    <header class="hx-card-header music-queue-progress__header">
      <div>
        <h2 :id="headingId" class="hx-card-title">{{ heading }}</h2>
        <p class="hx-card-subtitle" role="status" aria-live="polite" aria-atomic="true">
          {{ progress.summary }}
        </p>
      </div>
      <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'acquisition-music-queue' }">
        See all
      </RouterLink>
    </header>

    <div class="hx-card-body music-queue-progress__body">
      <div v-if="isLoading" class="hx-skeleton-stack" aria-label="Loading Music Queue progress" aria-busy="true">
        <div class="hx-skeleton" />
        <div class="hx-skeleton" />
      </div>

      <p v-else-if="errorMessage" class="music-queue-progress__message" role="status">
        Music Queue progress could not be refreshed. Open Music Queue to try again.
      </p>

      <p v-else-if="progress.totalCount === 0 && showEmpty" class="music-queue-progress__message">
        {{ progress.summary }}
      </p>

      <ul v-else-if="progress.rows.length > 0" class="music-queue-progress__list" role="list">
        <li v-for="row in progress.rows" :key="row.id" class="music-queue-progress__row">
          <div class="music-queue-progress__release">
            <div class="music-queue-progress__release-heading">
              <strong>{{ row.title }}</strong>
              <span class="hx-pill" :data-tone="row.statusTone">{{ row.statusLabel }}</span>
            </div>
            <p>{{ row.detail }}</p>
            <p v-if="row.transferProgress" class="music-queue-progress__transfer-progress">
              <strong>Download progress</strong>
              <span>{{ row.transferProgress.summary }}</span>
            </p>
          </div>
          <RouterLink
            class="hx-btn"
            data-variant="ghost"
            :aria-label="row.action.accessibleLabel"
            :to="row.action.to"
          >
            {{ row.action.label }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.music-queue-progress__header {
  align-items: center;
}

.music-queue-progress__body {
  padding-top: 0;
}

.music-queue-progress__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.music-queue-progress__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-3) 0;
  border-top: 1px solid var(--hx-border-subtle);
}

.music-queue-progress__row:first-child {
  border-top: 0;
  padding-top: 0;
}

.music-queue-progress__release {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.music-queue-progress__release-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.music-queue-progress__release-heading strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-queue-progress__release p,
.music-queue-progress__message {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.45;
}

.music-queue-progress__transfer-progress {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-1);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
}

.music-queue-progress__transfer-progress strong {
  color: var(--hx-text-muted);
  font-weight: var(--hx-font-medium);
}

.music-queue-progress__message {
  padding: var(--hx-space-2) 0;
}

@media (max-width: 640px) {
  .music-queue-progress__row {
    align-items: flex-start;
    flex-direction: column;
  }

  .music-queue-progress__release-heading strong {
    white-space: normal;
  }
}
</style>
