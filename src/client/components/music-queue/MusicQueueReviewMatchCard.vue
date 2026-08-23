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
import { computed, ref, watch } from 'vue';
import { buildMusicQueueMatchCardPresentation } from '../../lib/music-queue-match-card-presentation.js';

const props = defineProps({
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

const emit = defineEmits(['reject-match', 'use-match']);

const detailsExpanded = ref(false);
const presentation = computed(() => buildMusicQueueMatchCardPresentation(props.match, {
  isDecision: props.showActions,
}));

watch(
  () => [props.match?.id, props.showActions],
  () => {
    detailsExpanded.value = false;
  },
);

function useMatch(event) {
  if (props.actionRunning) return;
  emit('use-match', {
    actionId: `use-match:${props.match.id}`,
    match: props.match,
    trigger: event.currentTarget,
    wasFocused: globalThis.document?.activeElement === event.currentTarget,
  });
}

function rejectMatch(event) {
  if (props.actionRunning) return;
  emit('reject-match', {
    actionId: `reject-match:${props.match.id}`,
    match: props.match,
    trigger: event.currentTarget,
    wasFocused: globalThis.document?.activeElement === event.currentTarget,
  });
}
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
      <template v-for="fact in presentation.visibleFacts" :key="fact.label">
        <div>
          <dt>{{ fact.label }}</dt>
          <dd>
            <span v-if="fact.tone" class="hx-pill" :data-tone="fact.tone">{{ fact.value }}</span>
            <template v-else>{{ fact.value }}</template>
          </dd>
        </div>
      </template>
    </dl>

    <div v-if="showActions && (match.canUseMatch || match.canRejectMatch)" class="music-queue-review-match__actions">
      <button
        v-if="match.canUseMatch"
        type="button"
        class="hx-btn"
        data-variant="primary"
        :data-music-queue-action="`use-match:${match.id}`"
        :aria-disabled="Boolean(actionRunning)"
        @click="useMatch"
      >
        {{ actionRunning === 'use' ? 'Selecting...' : 'Use this match' }}
      </button>
      <button
        v-if="match.canRejectMatch"
        type="button"
        class="hx-btn"
        data-variant="ghost"
        :data-music-queue-action="`reject-match:${match.id}`"
        :aria-disabled="Boolean(actionRunning)"
        @click="rejectMatch"
      >
        {{ actionRunning === 'reject' ? 'Rejecting...' : 'Reject match' }}
      </button>
    </div>

    <details
      v-if="presentation.hasDetails"
      class="music-queue-review-match__details"
      :open="detailsExpanded"
      @toggle="detailsExpanded = $event.currentTarget.open"
    >
      <summary>Match details</summary>
      <div class="music-queue-review-match__details-content">
        <dl class="music-queue-review-match__quality" aria-label="Match details">
          <template v-for="fact in presentation.detailFacts" :key="fact.label">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.value }}</dd>
          </template>
        </dl>
        <dl
          v-if="presentation.detailQualityRows.length"
          class="music-queue-review-match__quality"
          aria-label="Match quality details"
        >
          <template v-for="row in presentation.detailQualityRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd><span class="hx-pill" :data-tone="row.tone">{{ row.value }}</span></dd>
          </template>
        </dl>
      </div>
    </details>

    <dl v-if="presentation.qualityRows.length" class="music-queue-review-match__quality" aria-label="Match quality details">
      <template v-for="row in presentation.qualityRows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd><span class="hx-pill" :data-tone="row.tone">{{ row.value }}</span></dd>
      </template>
    </dl>
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

.music-queue-review-match__actions button[aria-disabled='true'] {
  cursor: wait;
  opacity: 0.65;
}

.music-queue-review-match__details {
  padding-top: var(--hx-space-3);
  border-top: 1px solid var(--hx-border);
}

.music-queue-review-match__details summary {
  min-height: 40px;
  color: var(--hx-accent);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.music-queue-review-match__details summary:focus-visible {
  border-radius: var(--hx-radius-xs);
  outline: 2px solid var(--hx-accent);
  outline-offset: 3px;
}

.music-queue-review-match__details-content {
  display: grid;
  gap: var(--hx-space-3);
  margin-top: var(--hx-space-3);
}

@media (max-width: 440px) {
  .music-queue-review-match__header {
    flex-direction: column;
  }

  .music-queue-review-match__facts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
