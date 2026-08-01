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
import { computed, ref } from 'vue';
import { buildMusicQueueReleaseActionFeedback } from '../../lib/music-queue-action-feedback-presentation.js';
import { buildMusicQueueReviewPresentation } from '../../lib/music-queue-review-presentation.js';
import {
  SETTINGS_RECOVERY_CONTEXT,
  buildSettingsRecoveryHandoffLocation,
  createSettingsRecoveryContext,
} from '../../lib/settings-recovery-handoff.js';
import MusicQueueReviewMatchCard from './MusicQueueReviewMatchCard.vue';

const props = defineProps({
  actionFeedback: {
    default: null,
    type: Object,
  },
  activeMatchActionKey: {
    default: '',
    type: String,
  },
  activeReleaseActionKey: {
    default: '',
    type: String,
  },
  review: {
    default: null,
    type: Object,
  },
});

const emit = defineEmits([
  'add-to-library',
  'allow-fallback-quality',
  'close',
  'recheck-library-add',
  'reject-match',
  'search-again',
  'use-match',
]);

const detailsExpanded = ref(false);
const presentation = computed(() => buildMusicQueueReviewPresentation(props.review));
const releaseActionFeedback = computed(() => buildMusicQueueReleaseActionFeedback(
  props.actionFeedback,
  props.review?.releaseId,
));
const repairSettingsLocation = computed(() => {
  const routeName = props.review?.repair?.settingsRouteName;
  if (!routeName) return null;

  return buildSettingsRecoveryHandoffLocation({
    recoveryContext: createSettingsRecoveryContext({
      context: SETTINGS_RECOVERY_CONTEXT.MUSIC_QUEUE_RELEASE,
      wantedReleaseId: props.review?.releaseId ?? null,
    }),
    routeName,
  });
});

function getMatchActionState(match) {
  const activeAction = props.activeMatchActionKey;
  const keyPrefix = `${props.review?.releaseId}:${match.matchId}:`;
  return activeAction.startsWith(keyPrefix) ? activeAction.slice(keyPrefix.length) : '';
}

function isReleaseActionRunning(action) {
  return props.activeReleaseActionKey === `${props.review?.releaseId}:${action}`;
}
</script>

<template>
  <aside class="music-queue-review" aria-label="Music Queue details">
    <div v-if="!review" class="music-queue-review__empty">
      <h2>Select a release</h2>
      <p>Open details to see what Harmoniarr is doing or the next step it needs from you.</p>
    </div>

    <div v-else>
      <div class="music-queue-review__header">
        <div>
          <p class="hx-eyebrow">Release details</p>
          <h2>{{ review.heading }}</h2>
        </div>
        <button type="button" class="hx-btn" data-variant="ghost" @click="emit('close')">Close</button>
      </div>

      <section class="music-queue-review__section music-queue-review__outcome" aria-labelledby="music-queue-review-status">
        <p class="music-queue-review__label">Current status</p>
        <h3 id="music-queue-review-status" :data-tone="review.statusTone">{{ review.statusLabel }}</h3>
        <p v-if="!review.repair">{{ review.reason }}</p>
        <p v-if="!review.repair" class="music-queue-review__next-step"><strong>Next step:</strong> {{ presentation.decisionCopy }}</p>
        <div class="music-queue-review__feedback-live-region" aria-atomic="true" aria-live="polite">
          <p
            v-if="releaseActionFeedback && releaseActionFeedback.role === 'status'"
            class="music-queue-review__action-feedback"
            :data-tone="releaseActionFeedback.tone"
            role="status"
          >
            <strong>{{ releaseActionFeedback.label }}</strong>
            <span>{{ releaseActionFeedback.message }}</span>
          </p>
        </div>
        <div class="music-queue-review__feedback-live-region" aria-atomic="true" aria-live="assertive">
          <p
            v-if="releaseActionFeedback && releaseActionFeedback.role === 'alert'"
            class="music-queue-review__action-feedback"
            :data-tone="releaseActionFeedback.tone"
            role="alert"
          >
            <strong>{{ releaseActionFeedback.label }}</strong>
            <span>{{ releaseActionFeedback.message }}</span>
          </p>
        </div>
      </section>

      <section v-if="presentation.hasMatchChoices" class="music-queue-review__section" aria-labelledby="music-queue-review-match-choice">
        <div>
          <h3 id="music-queue-review-match-choice">Choose a match</h3>
          <p>Only these matches can move this release forward right now.</p>
        </div>
        <div class="music-queue-review__match-list" role="list">
          <MusicQueueReviewMatchCard
            v-for="match in presentation.decisionMatchCards"
            :key="match.id"
            :action-running="getMatchActionState(match)"
            :match="match"
            show-actions
            @reject-match="emit('reject-match', $event)"
            @use-match="emit('use-match', $event)"
          />
        </div>
      </section>

      <section v-if="review.repair" class="music-queue-review__section" aria-labelledby="music-queue-review-repair">
        <div>
          <h3 id="music-queue-review-repair">{{ review.repair.title }}</h3>
          <p>{{ review.repair.detail }}</p>
          <p>{{ review.repair.nextStep }}</p>
        </div>
        <div class="music-queue-review__actions">
          <button
            v-if="review.repair.actionCode === 'recheck_library_add'"
            type="button"
            class="hx-btn"
            data-variant="primary"
            :disabled="Boolean(activeReleaseActionKey)"
            @click="emit('recheck-library-add')"
          >
            {{ isReleaseActionRunning('recheck-library-add') ? 'Checking...' : review.repair.actionLabel }}
          </button>
          <RouterLink
            v-if="review.repair.settingsRouteName"
            class="hx-btn"
            data-variant="primary"
            :to="repairSettingsLocation"
          >
            {{ review.repair.settingsRouteLabel }}
          </RouterLink>
          <RouterLink
            class="hx-btn"
            data-variant="ghost"
            :to="{
              name: 'activity-diagnostics-library-adds',
              query: { wantedReleaseId: review.releaseId },
            }"
          >
            Advanced diagnostics
          </RouterLink>
        </div>
      </section>

      <section v-if="presentation.hasManualSafeAdd" class="music-queue-review__section" aria-labelledby="music-queue-review-add">
        <div>
          <h3 id="music-queue-review-add">Add to library</h3>
          <p>Harmoniarr will check the completed files again and start only if they still pass the library, quality, and audio checks.</p>
        </div>
        <div class="music-queue-review__actions">
          <button
            type="button"
            class="hx-btn"
            data-variant="primary"
            :disabled="Boolean(activeReleaseActionKey)"
            @click="emit('add-to-library')"
          >
            {{ isReleaseActionRunning('add-to-library') ? 'Checking...' : 'Add to library' }}
          </button>
        </div>
      </section>

      <section v-if="presentation.hasQualityChoice || review.action?.type === 'route'" class="music-queue-review__section" aria-labelledby="music-queue-review-continue">
        <div>
          <h3 id="music-queue-review-continue">Continue this release</h3>
          <p>Use an option only when it matches the quality policy you want for this release.</p>
        </div>
        <dl v-if="presentation.primaryQualityRows.length" class="music-queue-review__key-facts">
          <template v-for="row in presentation.primaryQualityRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
        <div class="music-queue-review__actions">
          <button
            v-if="review.canAllowFallbackQuality"
            type="button"
            class="hx-btn"
            data-variant="primary"
            :disabled="Boolean(activeReleaseActionKey)"
            @click="emit('allow-fallback-quality')"
          >
            {{ isReleaseActionRunning('allow-fallback-quality') ? 'Saving...' : review.fallbackQualityLabel }}
          </button>
          <button
            v-if="review.canSearchAgain"
            type="button"
            class="hx-btn"
            :data-variant="review.canAllowFallbackQuality ? 'ghost' : 'primary'"
            :disabled="Boolean(activeReleaseActionKey)"
            @click="emit('search-again')"
          >
            {{ isReleaseActionRunning('search-again') ? 'Queuing...' : review.searchAgainLabel }}
          </button>
          <RouterLink
            v-if="review.action?.type === 'route'"
            class="hx-btn"
            data-variant="primary"
            :to="{ name: review.action.routeName }"
          >
            {{ review.action.label }}
          </RouterLink>
        </div>
      </section>

      <section v-if="presentation.hasEvidence" class="music-queue-review__section music-queue-review__evidence">
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          aria-controls="music-queue-review-evidence"
          :aria-expanded="detailsExpanded"
          @click="detailsExpanded = !detailsExpanded"
        >
          {{ detailsExpanded ? 'Hide matching and quality details' : 'Show matching and quality details' }}
        </button>
        <div v-show="detailsExpanded" id="music-queue-review-evidence" class="music-queue-review__evidence-content">
          <section v-if="presentation.evidenceMatchCards.length" aria-labelledby="music-queue-review-match-evidence">
            <h3 id="music-queue-review-match-evidence">Matching details</h3>
            <div class="music-queue-review__match-list" role="list">
              <MusicQueueReviewMatchCard
                v-for="match in presentation.evidenceMatchCards"
                :key="match.id"
                :match="match"
              />
            </div>
          </section>
          <section aria-labelledby="music-queue-review-match-summary">
            <h3 id="music-queue-review-match-summary">Match summary</h3>
            <dl class="music-queue-review__details-grid">
              <template v-for="row in review.matchRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </section>
          <section aria-labelledby="music-queue-review-quality-details">
            <h3 id="music-queue-review-quality-details">Quality details</h3>
            <p v-if="review.qualityGuidance" class="music-queue-review__guidance" role="status">{{ review.qualityGuidance }}</p>
            <dl class="music-queue-review__details-grid">
              <template v-for="row in review.qualityRows" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </template>
            </dl>
          </section>
          <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'activity-diagnostics-matches' }">
            Advanced diagnostics
          </RouterLink>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.music-queue-review {
  position: sticky;
  top: 76px;
  padding: var(--hx-space-5);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
}

.music-queue-review__empty {
  padding: var(--hx-space-7) var(--hx-space-3);
  text-align: center;
}

.music-queue-review__empty p {
  color: var(--hx-text-muted);
}

.music-queue-review__header {
  display: flex;
  gap: var(--hx-space-3);
  align-items: start;
  justify-content: space-between;
}

.music-queue-review__header h2 {
  margin: 0;
}

.music-queue-review__section {
  display: grid;
  gap: var(--hx-space-3);
  margin-top: var(--hx-space-5);
  padding-top: var(--hx-space-5);
  border-top: 1px solid var(--hx-border);
}

.music-queue-review__section h3,
.music-queue-review__section p {
  margin: 0;
}

.music-queue-review__outcome h3 {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-lg);
}

.music-queue-review__outcome h3[data-tone='warning'] {
  color: var(--hx-warning);
}

.music-queue-review__outcome h3[data-tone='danger'] {
  color: var(--hx-danger);
}

.music-queue-review__label,
.music-queue-review__next-step,
.music-queue-review__section > div > p {
  color: var(--hx-text-muted);
}

.music-queue-review__label {
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-queue-review__next-step {
  padding: var(--hx-space-3);
  border-left: 3px solid var(--hx-accent);
  background: var(--hx-bg-surface-muted);
}

.music-queue-review__next-step strong {
  color: var(--hx-text);
}

.music-queue-review__feedback-live-region {
  display: grid;
}

.music-queue-review__feedback-live-region:empty {
  display: none;
}

.music-queue-review__action-feedback {
  display: grid;
  gap: var(--hx-space-1);
  margin: 0;
  padding: var(--hx-space-3);
  border-left: 3px solid var(--hx-accent);
  background: var(--hx-bg-surface-muted);
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.music-queue-review__action-feedback[data-tone='success'] {
  border-color: var(--hx-success);
}

.music-queue-review__action-feedback[data-tone='danger'] {
  border-color: var(--hx-danger);
}

.music-queue-review__action-feedback strong {
  color: var(--hx-text-strong);
}

.music-queue-review__match-list,
.music-queue-review__evidence-content {
  display: grid;
  gap: var(--hx-space-3);
}

.music-queue-review__key-facts,
.music-queue-review__details-grid {
  display: grid;
  gap: var(--hx-space-2);
  grid-template-columns: minmax(120px, auto) 1fr;
  margin: 0;
}

.music-queue-review__key-facts dt,
.music-queue-review__details-grid dt {
  color: var(--hx-text-muted);
}

.music-queue-review__key-facts dd,
.music-queue-review__details-grid dd {
  margin: 0;
  text-align: right;
}

.music-queue-review__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

.music-queue-review__evidence-content > section {
  display: grid;
  gap: var(--hx-space-3);
}

.music-queue-review__guidance {
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-muted);
  color: var(--hx-text-muted);
}

@media (max-width: 720px) {
  .music-queue-review {
    position: static;
  }
}
</style>
