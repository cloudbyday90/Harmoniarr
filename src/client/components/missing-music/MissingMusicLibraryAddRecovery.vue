<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed } from 'vue';
import { buildMissingMusicLibraryAddRecoveryPresentation } from '../../lib/missing-music-library-add-recheck-presentation.js';
import MissingMusicCommandFeedback from './MissingMusicCommandFeedback.vue';

const props = defineProps({
  busy: { default: false, type: Boolean },
  detail: { default: null, type: Object },
  errorMessage: { default: '', type: String },
  pending: { default: false, type: Boolean },
  statusMessage: { default: '', type: String },
  statusTone: { default: 'info', type: String },
});
const emit = defineEmits(['recheck-library-add']);
const presentation = computed(() => buildMissingMusicLibraryAddRecoveryPresentation(props.detail));
</script>

<template>
  <section v-if="presentation.showPanel" class="hx-missing-add-recovery" aria-labelledby="missing-music-add-recovery-heading">
    <h3 id="missing-music-add-recovery-heading">{{ presentation.title }}</h3>
    <p>{{ presentation.explanation }}</p>
    <RouterLink v-if="presentation.repairFoldersLocation" class="hx-btn" :to="presentation.repairFoldersLocation">Set up folders</RouterLink>
    <div v-if="presentation.canRecheck" class="hx-missing-add-recovery__action">
      <p id="missing-music-add-recheck-help">{{ presentation.actionExplanation }}</p>
      <button type="button" class="hx-btn" data-variant="primary" aria-describedby="missing-music-add-recheck-help" :disabled="busy" @click="emit('recheck-library-add')">
        {{ pending ? 'Checking…' : 'Check the files again' }}
      </button>
    </div>
  </section>
  <MissingMusicCommandFeedback :status-message="statusMessage" :error-message="errorMessage" :tone="statusTone" />
</template>

<style scoped>
.hx-missing-add-recovery { display: grid; justify-items: start; gap: var(--hx-space-3); padding: var(--hx-space-4); border: 1px solid var(--hx-border); border-radius: var(--hx-radius-md); }
.hx-missing-add-recovery h3, .hx-missing-add-recovery p { margin: 0; }
.hx-missing-add-recovery h3 { color: var(--hx-text-strong); font-size: var(--hx-text-base); }
.hx-missing-add-recovery p { color: var(--hx-text-muted); }
.hx-missing-add-recovery__action { display: grid; justify-items: start; gap: var(--hx-space-2); }
</style>
