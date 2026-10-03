<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { buildMissingMusicLibraryAddPresentation } from '../../lib/missing-music-library-add-presentation.js';
import { trapModalTabFocus } from '../../lib/modal-focus-trap.js';
import MissingMusicCommandFeedback from './MissingMusicCommandFeedback.vue';

const props = defineProps({
  busy: { default: false, type: Boolean },
  decisionId: { required: true, type: String },
  detail: { default: null, type: Object },
  errorMessage: { default: '', type: String },
  pending: { default: false, type: Boolean },
  statusMessage: { default: '', type: String },
  statusTone: { default: 'info', type: String },
});
const emit = defineEmits(['clear-feedback', 'confirm', 'confirmation-open']);
const dialogElement = ref(null);
const invoker = ref(null);
const presentation = computed(() => buildMissingMusicLibraryAddPresentation(props.detail));

function closeConfirmation() {
  dialogElement.value?.close();
  emit('confirmation-open', false);
}

function openConfirmation(event) {
  if (props.busy || !presentation.value.canAdd || !dialogElement.value || dialogElement.value.open) return;
  emit('clear-feedback');
  invoker.value = event.currentTarget;
  emit('confirmation-open', true);
  dialogElement.value.showModal();
}

function confirmAdd() {
  if (props.busy || !presentation.value.canAdd) return;
  emit('confirm', { invoker: invoker.value, closeConfirmation });
}

watch(() => props.decisionId, closeConfirmation, { flush: 'sync' });
onBeforeUnmount(closeConfirmation);
</script>

<template>
  <div v-if="presentation.canAdd" class="hx-missing-library-add-action">
    <button type="button" class="hx-btn" data-variant="primary" aria-describedby="missing-music-library-add-help" :disabled="busy" @click="openConfirmation">
      {{ pending ? 'Requesting…' : 'Add to library' }}
    </button>
    <p id="missing-music-library-add-help">{{ presentation.explanation }}</p>
  </div>
  <MissingMusicCommandFeedback :status-message="statusMessage" :error-message="errorMessage" :tone="statusTone" />
  <dialog ref="dialogElement" class="hx-missing-library-add-dialog" aria-labelledby="missing-music-library-add-dialog-title" @keydown="trapModalTabFocus" @close="emit('confirmation-open', false)">
    <form method="dialog" class="hx-missing-library-add-dialog__content" @submit.prevent="confirmAdd">
      <h2 id="missing-music-library-add-dialog-title">Add to library?</h2>
      <p>{{ presentation.confirmation }}</p>
      <p>{{ presentation.safetyExplanation }}</p>
      <div class="hx-missing-library-add-dialog__actions">
        <button type="button" class="hx-btn" autofocus @click="closeConfirmation">Cancel</button>
        <button type="submit" class="hx-btn" data-variant="primary" :disabled="busy">Add to library</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.hx-missing-library-add-action { display: flex; flex-wrap: wrap; align-items: center; gap: var(--hx-space-2); }
.hx-missing-library-add-action p { margin: 0; color: var(--hx-text-muted); }
.hx-missing-library-add-dialog { width: min(100% - (2 * var(--hx-space-4)), 34rem); padding: 0; border: 1px solid var(--hx-border-strong); border-radius: var(--hx-radius-lg); background: var(--hx-bg-surface); color: var(--hx-text); box-shadow: var(--hx-shadow-lg); }
.hx-missing-library-add-dialog::backdrop { background: var(--hx-bg-overlay); }
.hx-missing-library-add-dialog__content { display: grid; gap: var(--hx-space-4); margin: 0; padding: var(--hx-space-6); }
.hx-missing-library-add-dialog__content h2, .hx-missing-library-add-dialog__content p { margin: 0; }
.hx-missing-library-add-dialog__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--hx-space-2); }
</style>
