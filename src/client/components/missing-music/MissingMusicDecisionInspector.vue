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
import { computed, nextTick, ref, watch } from 'vue';
import { buildMissingMusicDecisionDetailPresentation } from '../../lib/missing-music-decision-detail-presentation.js';
import { useMissingMusicDecisionDetail } from '../../composables/useMissingMusicDecisionDetail.js';

const props = defineProps({
  decisionId: {
    required: true,
    type: String,
  },
});

const headingElement = ref(null);
const focusedDecisionId = ref('');
const decisionDetail = useMissingMusicDecisionDetail({
  decisionId: computed(() => props.decisionId),
});
const presentation = computed(() => buildMissingMusicDecisionDetailPresentation(decisionDetail.detail.value));

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
        <h3 id="missing-music-inspector-current-status">Current status</h3>
        <span class="hx-pill" :data-tone="presentation.statusTone">{{ presentation.statusLabel }}</span>
        <p>{{ presentation.statusMessage }}</p>
        <p class="missing-music-inspector__next-step"><strong>Next step:</strong> {{ presentation.nextStep }}</p>
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
    </div>
  </article>
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

.missing-music-inspector__next-step {
  padding-left: var(--hx-space-2);
  border-left: 2px solid var(--hx-accent);
  color: var(--hx-text);
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

@media (max-width: 640px) {
  .missing-music-inspector__facts {
    grid-template-columns: 1fr;
  }
}
</style>
