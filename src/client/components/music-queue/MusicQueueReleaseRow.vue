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
import { buildMusicQueueReleaseRowPresentation } from '../../lib/music-queue-release-row-presentation.js';

const props = defineProps({
  release: {
    required: true,
    type: Object,
  },
  selected: {
    default: false,
    type: Boolean,
  },
});

const emit = defineEmits(['open-review']);

const presentation = computed(() => buildMusicQueueReleaseRowPresentation(props.release));

function openReview() {
  emit('open-review', props.release);
}
</script>

<template>
  <article
    class="music-queue-release-row"
    :class="{
      'is-selected': selected,
      'needs-attention': presentation.qualityNeedsAttention,
    }"
    :data-tone="presentation.statusTone"
    role="listitem"
  >
    <span class="music-queue-release-row__marker" aria-hidden="true" />
    <div class="music-queue-release-row__content">
      <div class="music-queue-release-row__topline">
        <span class="music-queue-release-row__status">{{ release.status.label }}</span>
        <span class="music-queue-release-row__updated">{{ presentation.updatedLabel }}</span>
      </div>

      <h3>{{ release.releaseTitle }}</h3>
      <p class="music-queue-release-row__identity">
        {{ release.artistName }}
        <span aria-hidden="true">·</span>
        {{ release.releaseTypeLabel }}<template v-if="release.releaseYear"> · {{ release.releaseYear }}</template>
      </p>
      <p class="music-queue-release-row__detail">{{ release.detailText }}</p>

      <div class="music-queue-release-row__facts" aria-label="Release details">
        <span
          v-for="fact in presentation.facts"
          :key="fact.key"
          :class="{ 'is-attention': fact.key === 'quality' && presentation.qualityNeedsAttention }"
          :data-tone="fact.tone"
        >
          {{ fact.label }}
        </span>
      </div>
    </div>

    <div class="music-queue-release-row__actions">
      <button
        v-if="release.action.type === 'review'"
        type="button"
        class="hx-btn"
        data-variant="primary"
        :aria-expanded="selected"
        @click="openReview"
      >
        {{ release.action.label }}
      </button>
      <RouterLink
        v-else
        class="hx-btn"
        data-variant="primary"
        :to="{ name: release.action.routeName }"
      >
        {{ release.action.label }}
      </RouterLink>
      <button
        type="button"
        class="hx-btn"
        data-variant="ghost"
        :aria-expanded="selected"
        @click="openReview"
      >
        Details
      </button>
    </div>
  </article>
</template>

<style scoped>
.music-queue-release-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--hx-space-4);
  border-top: 1px solid var(--hx-border);
  padding: var(--hx-space-4) 0 var(--hx-space-4) var(--hx-space-3);
}

.music-queue-release-row:first-child {
  border-top: 0;
}

.music-queue-release-row.is-selected {
  margin-inline: calc(var(--hx-space-3) * -1);
  background: var(--hx-accent-soft);
  padding-inline: var(--hx-space-3);
}

.music-queue-release-row__marker {
  position: absolute;
  top: var(--hx-space-5);
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: var(--hx-radius-pill);
  background: var(--hx-text-faint);
}

.music-queue-release-row[data-tone='success'] .music-queue-release-row__marker {
  background: var(--hx-success);
}

.music-queue-release-row[data-tone='info'] .music-queue-release-row__marker {
  background: var(--hx-info);
}

.music-queue-release-row[data-tone='warning'] .music-queue-release-row__marker,
.music-queue-release-row.needs-attention .music-queue-release-row__marker {
  background: var(--hx-warning);
}

.music-queue-release-row[data-tone='danger'] .music-queue-release-row__marker {
  background: var(--hx-danger);
}

.music-queue-release-row__content {
  min-width: 0;
}

.music-queue-release-row__topline,
.music-queue-release-row__facts,
.music-queue-release-row__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--hx-space-2);
}

.music-queue-release-row__topline {
  justify-content: space-between;
  margin-bottom: var(--hx-space-1);
}

.music-queue-release-row__status {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.music-queue-release-row__updated,
.music-queue-release-row__identity,
.music-queue-release-row__detail,
.music-queue-release-row__facts {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.music-queue-release-row__updated {
  white-space: nowrap;
}

.music-queue-release-row h3,
.music-queue-release-row p {
  margin: 0;
}

.music-queue-release-row h3 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}

.music-queue-release-row__identity {
  margin-top: var(--hx-space-1);
}

.music-queue-release-row__detail {
  margin-top: var(--hx-space-2);
  color: var(--hx-text);
}

.music-queue-release-row__facts {
  margin-top: var(--hx-space-2);
}

.music-queue-release-row__facts span + span::before {
  margin-right: var(--hx-space-2);
  color: var(--hx-text-faint);
  content: '·';
}

.music-queue-release-row__facts .is-attention {
  color: var(--hx-warning);
  font-weight: 700;
}

.music-queue-release-row__facts .is-attention[data-tone='danger'] {
  color: var(--hx-danger);
}

.music-queue-release-row__actions {
  align-self: center;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .music-queue-release-row {
    grid-template-columns: 1fr;
  }

  .music-queue-release-row__topline {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--hx-space-1);
  }

  .music-queue-release-row__actions {
    justify-content: flex-start;
  }
}
</style>
