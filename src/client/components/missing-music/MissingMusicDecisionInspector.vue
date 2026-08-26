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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { buildMissingMusicDecisionDetailPresentation } from '../../lib/missing-music-decision-detail-presentation.js';
import { buildMissingMusicMatchChoicePresentation } from '../../lib/missing-music-match-selection-presentation.js';
import { useMissingMusicDecisionDetail } from '../../composables/useMissingMusicDecisionDetail.js';
import { useMissingMusicDownloadStart } from '../../composables/useMissingMusicDownloadStart.js';
import { useMissingMusicMatchSelection } from '../../composables/useMissingMusicMatchSelection.js';

const props = defineProps({
  decisionId: {
    required: true,
    type: String,
  },
});

const headingElement = ref(null);
const focusedDecisionId = ref('');
const statusHeadingElement = ref(null);
const downloadDialogElement = ref(null);
const decisionDetail = useMissingMusicDecisionDetail({
  decisionId: computed(() => props.decisionId),
});
const presentation = computed(() => buildMissingMusicDecisionDetailPresentation(decisionDetail.detail.value));
const matchChoicePresentation = computed(() => buildMissingMusicMatchChoicePresentation(decisionDetail.detail.value));
const matchSelection = useMissingMusicMatchSelection();
const downloadStart = useMissingMusicDownloadStart();

async function focusInspectorHeading() {
  if (decisionDetail.isLoading.value || focusedDecisionId.value === props.decisionId) {
    return;
  }

  await nextTick();
  if (headingElement.value?.isConnected !== false) {
    headingElement.value?.focus({ preventScroll: true });
    focusedDecisionId.value = props.decisionId;
  }
}

watch(
  [() => props.decisionId, () => decisionDetail.isLoading.value],
  () => {
    void focusInspectorHeading();
  },
  { flush: 'post' },
);

async function selectMatch(matchId) {
  const result = await matchSelection.selectMatch({
    decisionId: props.decisionId,
    matchId,
  });
  if (!result) return;

  await decisionDetail.load();
  await nextTick();
  statusHeadingElement.value?.focus({ preventScroll: true });
}

function openDownloadConfirmation() {
  downloadStart.clearFeedback();
  if (downloadDialogElement.value && !downloadDialogElement.value.open) {
    downloadDialogElement.value.showModal();
  }
}

function closeDownloadConfirmation() {
  downloadDialogElement.value?.close();
}

async function startDownload() {
  const result = await downloadStart.startDownload({ decisionId: props.decisionId });
  if (!result) return;

  closeDownloadConfirmation();
  await decisionDetail.load();
  await nextTick();
  statusHeadingElement.value?.focus({ preventScroll: true });
}

onBeforeUnmount(() => {
  closeDownloadConfirmation();
});
</script>

<template>
  <article
    class="hx-card missing-music-inspector"
    :aria-busy="decisionDetail.isLoading.value ? 'true' : undefined"
  >
    <header class="hx-card-header">
      <div>
        <p class="hx-eyebrow">Release status</p>
        <h2 ref="headingElement" class="hx-card-title" tabindex="-1">
          {{ presentation.title }}
        </h2>
      </div>
      <div class="hx-card-actions">
        <RouterLink class="hx-btn" data-variant="ghost" :to="{ name: 'missing' }">
          Back to release decisions
        </RouterLink>
      </div>
    </header>

    <div v-if="decisionDetail.isLoading.value" class="hx-card-body missing-music-inspector__state" role="status">
      Loading the latest release status…
    </div>

    <div v-else-if="decisionDetail.errorMessage.value" class="hx-card-body">
      <div class="hx-alert" data-tone="danger" role="alert">
        {{ decisionDetail.errorMessage.value }}
      </div>
    </div>

    <div v-else-if="decisionDetail.isNotFound.value" class="hx-card-body missing-music-inspector__state">
      <p>The requested release is unavailable or you do not have access to it.</p>
    </div>

    <div v-else-if="decisionDetail.detail.value" class="hx-card-body missing-music-inspector__content">
      <p class="missing-music-inspector__artist">
        {{ presentation.artistName }}<template v-if="presentation.releaseMeta"> · {{ presentation.releaseMeta }}</template>
      </p>

      <section class="missing-music-inspector__section" aria-labelledby="missing-music-inspector-current-status">
        <h3 id="missing-music-inspector-current-status" ref="statusHeadingElement" tabindex="-1">Current status</h3>
        <span class="hx-pill" :data-tone="presentation.statusTone">{{ presentation.statusLabel }}</span>
        <p>{{ presentation.statusMessage }}</p>
        <p class="missing-music-inspector__next-step"><strong>Next step:</strong> {{ presentation.nextStep }}</p>
        <div v-if="presentation.canStartDownload" class="missing-music-inspector__start-download">
          <button
            type="button"
            class="hx-btn"
            data-variant="primary"
            @click="openDownloadConfirmation"
          >
            Start download
          </button>
          <p>Start preparing the selected match for download.</p>
        </div>
        <div v-if="presentation.canViewDownloader" class="missing-music-inspector__view-downloader">
          <RouterLink
            class="hx-btn"
            data-variant="primary"
            :aria-label="presentation.downloaderLinkAccessibleLabel"
            :to="{
              name: 'acquisition-downloader',
              query: { missingMusicDecisionId: props.decisionId },
            }"
          >
            View in Downloader
          </RouterLink>
          <p>Monitor the submitted transfer separately from this release decision.</p>
        </div>
        <p
          v-if="downloadStart.statusMessage.value"
          class="missing-music-inspector__selection-feedback"
          role="status"
          aria-atomic="true"
        >
          {{ downloadStart.statusMessage.value }}
        </p>
        <p
          v-if="downloadStart.errorMessage.value"
          class="missing-music-inspector__selection-feedback"
          data-tone="danger"
          role="alert"
        >
          {{ downloadStart.errorMessage.value }}
        </p>
      </section>

      <dl class="missing-music-inspector__facts">
        <div>
          <dt>For</dt>
          <dd>{{ presentation.username }}</dd>
        </div>
        <div>
          <dt>Library coverage</dt>
          <dd>{{ presentation.coverage }}</dd>
        </div>
        <div>
          <dt>Release status checked</dt>
          <dd>{{ presentation.lastCheckedAt }}</dd>
        </div>
        <div>
          <dt>Details refreshed</dt>
          <dd>{{ presentation.checkedAt }}</dd>
        </div>
      </dl>

      <p v-if="presentation.isReadOnly" class="missing-music-inspector__account-note">
        {{ presentation.accountNote }}
      </p>

      <section
        v-if="matchChoicePresentation.choices.length"
        class="missing-music-inspector__section"
        aria-labelledby="missing-music-inspector-match-choices"
      >
        <div>
          <h3 id="missing-music-inspector-match-choices">{{ matchChoicePresentation.heading }}</h3>
          <p id="missing-music-inspector-match-choice-help">
            {{ matchChoicePresentation.instructions }}
            <template v-if="matchChoicePresentation.canSelect">Selecting a match does not start a download.</template>
          </p>
        </div>

        <p
          v-if="matchSelection.statusMessage.value"
          class="missing-music-inspector__selection-feedback"
          role="status"
          aria-atomic="true"
        >
          {{ matchSelection.statusMessage.value }}
        </p>
        <p
          v-if="matchSelection.errorMessage.value"
          class="missing-music-inspector__selection-feedback"
          data-tone="danger"
          role="alert"
        >
          {{ matchSelection.errorMessage.value }}
        </p>

        <ul class="missing-music-inspector__match-list" aria-label="Available matches">
          <li v-for="match in matchChoicePresentation.choices" :key="match.id">
            <article class="missing-music-inspector__match">
              <h4>{{ match.label }}</h4>
              <dl>
                <div v-for="fact in match.facts" :key="fact.label">
                  <dt>{{ fact.label }}</dt>
                  <dd>{{ fact.value }}</dd>
                </div>
              </dl>
              <button
                v-if="matchChoicePresentation.canSelect"
                type="button"
                class="hx-btn"
                data-variant="primary"
                :aria-label="match.accessibleActionLabel"
                :aria-describedby="'missing-music-inspector-match-choice-help'"
                :disabled="Boolean(matchSelection.activeMatchId.value)"
                @click="selectMatch(match.id)"
              >
                {{ matchSelection.activeMatchId.value === match.id ? 'Selecting…' : 'Use this match' }}
              </button>
            </article>
          </li>
        </ul>
      </section>
    </div>
  </article>

  <dialog
    ref="downloadDialogElement"
    class="missing-music-download-dialog"
    aria-labelledby="missing-music-download-dialog-title"
  >
    <form method="dialog" class="missing-music-download-dialog__content" @submit.prevent="startDownload">
      <h2 id="missing-music-download-dialog-title">Start download?</h2>
      <p>
        Harmoniarr will prepare the selected match for {{ presentation.title }} by {{ presentation.artistName }}
        for {{ presentation.username }}. It will submit the transfer only after the download worker runs.
      </p>
      <p
        v-if="downloadStart.errorMessage.value"
        class="missing-music-inspector__selection-feedback"
        data-tone="danger"
        role="alert"
      >
        {{ downloadStart.errorMessage.value }}
      </p>
      <div class="missing-music-download-dialog__actions">
        <button type="button" class="hx-btn" @click="closeDownloadConfirmation">Cancel</button>
        <button type="submit" class="hx-btn" data-variant="primary" :disabled="downloadStart.isStarting.value">
          {{ downloadStart.isStarting.value ? 'Starting…' : 'Start download' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.missing-music-inspector {
  scroll-margin-top: var(--hx-space-5);
}

.missing-music-inspector__state {
  color: var(--hx-text-muted);
}

.missing-music-inspector__state p,
.missing-music-inspector__artist,
.missing-music-inspector__section p,
.missing-music-inspector__account-note {
  margin: 0;
}

.missing-music-inspector__content {
  display: grid;
  gap: var(--hx-space-4);
}

.missing-music-inspector__artist {
  color: var(--hx-text-muted);
}

.missing-music-inspector__section {
  display: grid;
  gap: var(--hx-space-2);
  padding: var(--hx-space-4);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
}

.missing-music-inspector__section h3 {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-base);
}

.missing-music-inspector__section h3:focus {
  outline: 2px solid var(--hx-accent);
  outline-offset: 3px;
}

.missing-music-inspector__next-step {
  padding-left: var(--hx-space-2);
  border-left: 2px solid var(--hx-accent);
  color: var(--hx-text);
}

.missing-music-inspector__start-download {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--hx-space-2);
}

.missing-music-inspector__view-downloader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--hx-space-2);
}

.missing-music-inspector__view-downloader p {
  color: var(--hx-text-muted);
}

.missing-music-inspector__start-download p {
  color: var(--hx-text-muted);
}

.missing-music-inspector__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hx-space-3);
  margin: 0;
}

.missing-music-inspector__facts div {
  display: grid;
  gap: var(--hx-space-1);
}

.missing-music-inspector__facts dt {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.missing-music-inspector__facts dd {
  margin: 0;
  color: var(--hx-text);
}

.missing-music-inspector__account-note {
  padding: var(--hx-space-3);
  border-left: 3px solid var(--hx-text-faint);
  color: var(--hx-text-muted);
}

.missing-music-inspector__selection-feedback {
  margin: 0;
  padding: var(--hx-space-3);
  border-left: 3px solid var(--hx-success);
  background: var(--hx-success-soft);
  color: var(--hx-text);
}

.missing-music-inspector__selection-feedback[data-tone='danger'] {
  border-color: var(--hx-danger);
  background: var(--hx-danger-soft);
}

.missing-music-inspector__match-list {
  display: grid;
  gap: var(--hx-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.missing-music-inspector__match {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-muted);
}

.missing-music-inspector__match h4,
.missing-music-inspector__match dl {
  margin: 0;
}

.missing-music-inspector__match dl {
  display: grid;
  gap: var(--hx-space-2);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.missing-music-inspector__match dl div {
  display: grid;
  gap: var(--hx-space-1);
}

.missing-music-inspector__match dt {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.missing-music-inspector__match dd {
  margin: 0;
}

.missing-music-download-dialog {
  width: min(100% - (2 * var(--hx-space-4)), 34rem);
  padding: 0;
  border: 1px solid var(--hx-border-strong);
  border-radius: var(--hx-radius-lg);
  background: var(--hx-bg-surface);
  color: var(--hx-text);
  box-shadow: var(--hx-shadow-lg);
}

.missing-music-download-dialog::backdrop {
  background: var(--hx-bg-overlay);
}

.missing-music-download-dialog__content {
  display: grid;
  gap: var(--hx-space-4);
  margin: 0;
  padding: var(--hx-space-6);
}

.missing-music-download-dialog__content h2,
.missing-music-download-dialog__content p {
  margin: 0;
}

.missing-music-download-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--hx-space-2);
}

@media (max-width: 640px) {
  .missing-music-inspector__facts {
    grid-template-columns: 1fr;
  }

  .missing-music-inspector__match dl {
    grid-template-columns: 1fr;
  }
}
</style>
