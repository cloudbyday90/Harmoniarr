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
import {
  buildMissingReleaseDecisionPresentation,
} from '../../lib/missing-release-decision-presentation.js';
import {
  formatWantedTrackCounts,
  getWantedStatusLabel,
  getWantedStatusTone,
} from '../../lib/wanted-release-normalization.js';

const props = defineProps({
  canKeepSelectedManually: {
    type: Boolean,
    default: false,
  },
  downloadRecoveryNotice: {
    type: Object,
    default: null,
  },
  isKeepingSelectedManually: {
    type: Boolean,
    default: false,
  },
  isManualSelection: {
    type: Boolean,
    default: false,
  },
  isRetryingSearch: {
    type: Boolean,
    default: false,
  },
  isStartingSearch: {
    type: Boolean,
    default: false,
  },
  manualSelectionLabel: {
    type: String,
    default: '',
  },
  release: {
    type: Object,
    required: true,
  },
  searchStarted: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'keep-selected-manually',
  'open-music-queue',
  'retry-search',
  'start-search',
]);

const presentation = computed(() => buildMissingReleaseDecisionPresentation(props.release));
const trackCounts = computed(() => formatWantedTrackCounts(props.release));
</script>

<template>
  <div class="hx-wanted-card-actions">
    <div class="hx-wanted-card-meta">
      <span class="hx-pill" :data-tone="getWantedStatusTone(release.wantedStatus)">
        {{ getWantedStatusLabel(release.wantedStatus) }}
      </span>
      <span v-if="trackCounts" class="hx-text-muted">{{ trackCounts }}</span>
    </div>

    <p class="hx-wanted-card-next-step">{{ presentation.startSearch.summary }}</p>

    <div
      v-if="downloadRecoveryNotice"
      class="hx-wanted-recovery-notice"
      role="status"
    >
      <p class="hx-wanted-recovery-title">{{ downloadRecoveryNotice.title }}</p>
      <p>{{ downloadRecoveryNotice.message }}</p>
      <dl>
        <template v-for="detail in downloadRecoveryNotice.details" :key="detail.label">
          <dt>{{ detail.label }}</dt>
          <dd>{{ detail.value }}</dd>
        </template>
      </dl>
      <button
        type="button"
        class="hx-btn"
        data-variant="primary"
        :disabled="isRetryingSearch"
        :aria-label="`Search again for ${release.title ?? 'this release'}`"
        @click="emit('retry-search')"
      >
        {{ isRetryingSearch ? 'Starting search…' : 'Search again' }}
      </button>
    </div>

    <div class="hx-wanted-card-button-group">
      <button
        type="button"
        class="hx-btn"
        data-variant="primary"
        :disabled="isStartingSearch || searchStarted"
        :aria-busy="isStartingSearch || undefined"
        :aria-label="searchStarted
          ? `${release.title ?? 'Release'} — search started`
          : presentation.startSearch.accessibleLabel"
        @click="emit('start-search')"
      >
        {{ isStartingSearch ? 'Starting search…' : (searchStarted ? 'Search started' : presentation.startSearch.label) }}
      </button>
      <button
        type="button"
        class="hx-btn"
        data-variant="ghost"
        :aria-label="presentation.openMusicQueue.accessibleLabel"
        @click="emit('open-music-queue')"
      >
        {{ presentation.openMusicQueue.label }}
      </button>
    </div>

    <span v-if="isManualSelection" class="hx-pill" data-tone="info">
      {{ manualSelectionLabel }}
    </span>
    <button
      v-else-if="canKeepSelectedManually"
      type="button"
      class="hx-btn"
      data-variant="ghost"
      :disabled="isKeepingSelectedManually"
      :aria-label="`Keep ${release.title ?? 'this release'} selected manually`"
      @click="emit('keep-selected-manually')"
    >
      {{ isKeepingSelectedManually ? 'Saving selection…' : 'Keep selected manually' }}
    </button>
  </div>
</template>

<style scoped>
.hx-wanted-card-actions {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
  width: 100%;
}

.hx-wanted-card-meta,
.hx-wanted-card-button-group {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.hx-wanted-card-next-step {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.45;
  margin: 0;
}

.hx-wanted-recovery-notice {
  background: color-mix(in oklab, var(--hx-danger) 8%, transparent);
  border: 1px solid color-mix(in oklab, var(--hx-danger) 35%, var(--hx-border));
  border-radius: var(--hx-radius-md);
  color: var(--hx-text);
  display: grid;
  font-size: var(--hx-text-sm);
  gap: var(--hx-space-2);
  padding: var(--hx-space-3);
}

.hx-wanted-recovery-title {
  color: var(--hx-danger);
  font-weight: 700;
  margin: 0;
}

.hx-wanted-recovery-notice p,
.hx-wanted-recovery-notice dl {
  margin: 0;
}

.hx-wanted-recovery-notice dl {
  display: grid;
  gap: var(--hx-space-1) var(--hx-space-2);
  grid-template-columns: max-content minmax(0, 1fr);
}

.hx-wanted-recovery-notice dt {
  color: var(--hx-text-muted);
}

.hx-wanted-recovery-notice dd {
  font-weight: 600;
  margin: 0;
  overflow-wrap: anywhere;
}

.hx-wanted-recovery-notice .hx-btn {
  justify-self: start;
}
</style>
