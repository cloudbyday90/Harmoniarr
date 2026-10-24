<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->
<script setup>
import { computed, ref, watch } from 'vue';
import { buildMissingMusicMatchChoicePresentation } from '../../lib/missing-music-match-selection-presentation.js';

const props = defineProps({ detail: { type: Object, default: null }, busy: Boolean, activeMatchId: { type: String, default: '' } });
const emit = defineEmits(['select', 'page']);
const presentation = computed(() => buildMissingMusicMatchChoicePresentation(props.detail));
const expanded = ref(false);
watch(() => props.detail?.decision?.decisionId, () => { expanded.value = false; });
watch(() => presentation.value.isAlternative, value => { if (!value) expanded.value = false; });
</script>

<template>
  <div v-if="presentation.choices.length" class="missing-music-match-choices">
    <button v-if="presentation.isAlternative" type="button" class="hx-btn" data-variant="secondary"
      :aria-expanded="expanded" aria-controls="missing-music-match-choices" :disabled="busy"
      @click="expanded = !expanded">Choose another match</button>
      <section
        id="missing-music-match-choices"
        v-show="!presentation.isAlternative || expanded"
        class="missing-music-inspector__section"
        aria-labelledby="missing-music-inspector-match-choices"
      >
        <div>
          <h3 id="missing-music-inspector-match-choices">{{ presentation.heading }}</h3>
          <p id="missing-music-inspector-match-choice-help">
            {{ presentation.instructions }}
            <template v-if="presentation.canSelect">Selecting a match does not start a download.</template>
          </p>
        </div>

        <ul class="missing-music-inspector__match-list" aria-label="Available matches" :aria-busy="busy">
          <li v-for="match in presentation.choices" :key="match.id">
            <article class="missing-music-inspector__match">
              <h4>{{ match.label }}</h4>
              <dl>
                <div v-for="fact in match.facts" :key="fact.label">
                  <dt>{{ fact.label }}</dt>
                  <dd>{{ fact.value }}</dd>
                </div>
              </dl>
              <button
                v-if="presentation.canSelect"
                type="button"
                class="hx-btn"
                data-variant="primary"
                :aria-label="match.accessibleActionLabel"
                :aria-describedby="'missing-music-inspector-match-choice-help'"
                :disabled="busy"
                @click="emit('select', match.id)"
              >
                {{ activeMatchId === match.id ? 'Selecting…' : 'Use this match' }}
              </button>
            </article>
          </li>
        </ul>
        <nav v-if="detail?.matchChoicePage" class="missing-music-match-pages" aria-label="Available match pages">
          <button type="button" class="hx-btn" data-variant="secondary"
            :aria-disabled="busy || !detail.matchChoicePage.previousCursor"
            @click="!busy && detail.matchChoicePage.previousCursor && emit('page', null)">First page</button>
          <button type="button" class="hx-btn" data-variant="secondary"
            :aria-disabled="busy || !detail.matchChoicePage.previousCursor"
            @click="!busy && detail.matchChoicePage.previousCursor && emit('page', detail.matchChoicePage.previousCursor)">Previous matches</button>
          <button type="button" class="hx-btn" data-variant="secondary"
            :aria-disabled="busy || !detail.matchChoicePage.nextCursor"
            @click="!busy && detail.matchChoicePage.nextCursor && emit('page', detail.matchChoicePage.nextCursor)">Next matches</button>
        </nav>
      </section>
  </div>
</template>

<style scoped>
.missing-music-match-choices { display: grid; justify-items: start; gap: var(--hx-space-3); }
.missing-music-match-pages { display: flex; flex-wrap: wrap; gap: var(--hx-space-2); }
.missing-music-match-pages [aria-disabled="true"] { opacity: 0.5; cursor: default; }
.missing-music-inspector__section {
  display: grid; gap: var(--hx-space-2); width: 100%; padding: var(--hx-space-4);
  border: 1px solid var(--hx-border); border-radius: var(--hx-radius-md);
}
.missing-music-inspector__section h3 { margin: 0; color: var(--hx-text-strong); font-size: var(--hx-text-base); }
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

@media (max-width: 640px) {
  .missing-music-inspector__match dl {
    grid-template-columns: 1fr;
  }
}

</style>
