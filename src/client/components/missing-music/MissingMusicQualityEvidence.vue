<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed } from 'vue';
import { buildMissingMusicQualityEvidencePresentation } from '../../lib/missing-music-quality-evidence-presentation.js';

const props = defineProps({
  busy: { default: false, type: Boolean },
  detail: { default: null, type: Object },
  errorMessage: { default: '', type: String },
  pending: { default: false, type: Boolean },
  statusMessage: { default: '', type: String },
});
const emit = defineEmits(['allow-fallback-quality']);
const presentation = computed(() => buildMissingMusicQualityEvidencePresentation(props.detail));
</script>

<template>
  <section class="hx-missing-quality" aria-labelledby="missing-music-quality-heading">
    <h3 id="missing-music-quality-heading">Quality</h3>
    <dl class="hx-missing-quality__facts">
      <div v-for="fact in presentation.facts" :key="fact.label">
        <dt>{{ fact.label }}</dt>
        <dd>{{ fact.value }}</dd>
      </div>
    </dl>
    <p>{{ presentation.recipientNote }}</p>
    <div v-if="presentation.canAllowFallbackQuality" class="hx-missing-quality__action">
      <p>{{ presentation.actionExplanation }}</p>
      <button type="button" class="hx-btn" data-variant="primary" :disabled="busy" @click="emit('allow-fallback-quality')">
        {{ pending ? 'Saving…' : 'Allow fallback quality' }}
      </button>
    </div>
    <p v-if="statusMessage" role="status" aria-atomic="true">{{ statusMessage }}</p>
    <p v-if="errorMessage" class="hx-alert" data-tone="danger" role="alert">{{ errorMessage }}</p>
  </section>
</template>

<style scoped>
.hx-missing-quality { display: grid; gap: var(--hx-space-3); padding-top: var(--hx-space-4); border-top: 1px solid var(--hx-border-subtle); }
.hx-missing-quality h3, .hx-missing-quality p, .hx-missing-quality dl { margin: 0; }
.hx-missing-quality h3 { font-size: var(--hx-text-base); }
.hx-missing-quality p { color: var(--hx-text-muted); font-size: var(--hx-text-sm); }
.hx-missing-quality__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--hx-space-3); }
.hx-missing-quality__facts div { min-width: 0; margin: 0; }
.hx-missing-quality dt { color: var(--hx-text-muted); font-size: var(--hx-text-xs); }
.hx-missing-quality dd { margin: var(--hx-space-1) 0 0; font-size: var(--hx-text-sm); overflow-wrap: anywhere; }
.hx-missing-quality__action { display: grid; justify-items: start; gap: var(--hx-space-2); }
.hx-missing-quality .hx-alert { color: var(--hx-danger); }
@media (max-width: 960px) { .hx-missing-quality__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .hx-missing-quality__facts { grid-template-columns: 1fr; } }
</style>
