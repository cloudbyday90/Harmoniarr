<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0-or-later.
  See LICENSE for details.
-->
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useImportCandidateDownloadAdoption } from '../composables/useImportCandidateDownloadAdoption.js';
import { buildImportCandidateDownloadAdoptionPresentation } from '../lib/import-candidate-download-adoption-presentation.js';
import { trapModalTabFocus } from '../lib/modal-focus-trap.js';
import { createUserCommandFocusTracker } from '../lib/user-command-focus.js';
import ImportCandidateDownloadOriginResolution from './ImportCandidateDownloadOriginResolution.vue';

const props = defineProps({ operationRunId: { required: true, type: String }, importCandidateId: { required: true, type: String },
  disabled: { default: false, type: Boolean }, label: { default: 'Review download request', type: String },
  completeAdoption: { default: null, type: Function } });
const emit = defineEmits(['adopted', 'pending-change']);
const dialog = ref(null); const invoker = ref(null); const feedback = ref(null); let disposed = false;
const originResolution = ref(null);
const interactionBusy = ref(false);
let pendingIdentity = null;
const workflow = useImportCandidateDownloadAdoption({ operationRunId: () => props.operationRunId, importCandidateId: () => props.importCandidateId });
const presentation = computed(() => buildImportCandidateDownloadAdoptionPresentation(workflow.review.value));
const titleId = computed(() => `download-adoption-title-${props.operationRunId}-${props.importCandidateId}`);
const currentIdentity = () => `${props.operationRunId}/${props.importCandidateId}`;
function closeReview() { dialog.value?.close(); }
async function openReview(event) {
  if (props.disabled || interactionBusy.value || workflow.isPending.value || dialog.value?.open) return;
  invoker.value = event.currentTarget;
  if (originResolution.value?.hasUncertainIntent === true) {
    await originResolution.value.openReview({ returnTarget: invoker.value }); return;
  }
  dialog.value?.showModal();
  await workflow.loadReview();
}
async function openOriginReview() {
  if (props.disabled || workflow.isLoading.value || workflow.isPending.value || workflow.review.value?.reasonCode !== 'download_episode_not_current') return;
  const identity = currentIdentity(); closeReview(); await nextTick();
  if (!disposed && identity === currentIdentity()) await originResolution.value?.openReview({ returnTarget: invoker.value });
}
async function confirm() {
  if (props.disabled || interactionBusy.value || workflow.isPending.value || workflow.isLoading.value || !presentation.value.canAdopt) return;
  const identity = currentIdentity(); const focus = createUserCommandFocusTracker({ document: globalThis.document, returnTarget: invoker.value });
  interactionBusy.value = true;
  const promise = workflow.adopt(); closeReview();
  try {
    const result = await promise;
    if (disposed || identity !== currentIdentity()) return;
    if (!result) { interactionBusy.value = false; await nextTick(); focus.restoreAfterFailure(); return; }
    await nextTick();
    if (props.completeAdoption) await props.completeAdoption({ action: result.downloadAdoption, focus });
    else if (focus.ownsFocus()) feedback.value?.focus();
    emit('adopted', result.downloadAdoption);
  } finally { if (identity === currentIdentity()) interactionBusy.value = false; focus.dispose(); }
}
watch(() => interactionBusy.value || workflow.isPending.value, (pending) => {
  if (pending) pendingIdentity = currentIdentity();
  emit('pending-change', { key: pendingIdentity ?? currentIdentity(), pending });
  if (!pending) pendingIdentity = null;
}, { flush: 'sync' });
watch(currentIdentity, () => { closeReview(); interactionBusy.value = false; }, { flush: 'sync' });
onBeforeUnmount(() => { disposed = true; closeReview(); workflow.destroy(); emit('pending-change', { key: pendingIdentity ?? currentIdentity(), pending: false }); });
</script>

<template>
  <div class="hx-download-adoption">
    <button type="button" class="hx-btn" :disabled="disabled || workflow.isPending.value" @click="openReview">{{ label }}</button>
    <p ref="feedback" tabindex="-1" role="status" aria-live="polite" aria-atomic="true" class="hx-download-adoption__feedback">{{ workflow.statusMessage.value }}</p>
    <p v-if="workflow.errorMessage.value && !dialog?.open" class="hx-alert" data-tone="danger" role="alert">{{ workflow.errorMessage.value }}</p>
  </div>
  <ImportCandidateDownloadOriginResolution ref="originResolution" :operation-run-id="operationRunId" :import-candidate-id="importCandidateId"
    :disabled="disabled" :complete-resolution="completeAdoption" @pending-change="emit('pending-change', $event)" />
  <dialog ref="dialog" class="hx-download-adoption__dialog" :aria-labelledby="titleId" @keydown="trapModalTabFocus">
    <form method="dialog" class="hx-download-adoption__content" @submit.prevent="confirm">
      <h2 :id="titleId">Use existing downloads?</h2>
      <p role="status" aria-live="polite" aria-atomic="true">{{ workflow.isLoading.value ? 'Checking the saved request and existing download progress…' : presentation.explanation }}</p>
      <p v-if="workflow.errorMessage.value" class="hx-alert" data-tone="danger" role="alert">{{ workflow.errorMessage.value }}</p>
      <p v-if="workflow.hasUncertainIntent.value">The saved choice may already have been accepted. Try the same choice again to check its result.</p>
      <div :aria-busy="workflow.isLoading.value ? 'true' : undefined">
        <ul v-if="presentation.files.length" class="hx-download-adoption__files" aria-label="Reviewed existing downloads" tabindex="0">
          <li v-for="(file, index) in presentation.files" :key="`${index}/${file.transferId || file.label}`">
            <strong>{{ file.label }}</strong><span>{{ file.sizeLabel }} · {{ file.stateLabel }}</span>
            <span v-if="file.transferId" class="hx-text-muted">Transfer {{ file.transferId }}</span>
          </li>
        </ul>
        <p v-if="presentation.canAdopt">{{ presentation.uncertainty }}</p>
        <p v-if="presentation.canAdopt">{{ presentation.confirmation }}</p>
      </div>
      <div class="hx-download-adoption__actions">
        <button type="button" class="hx-btn" autofocus @click="closeReview">Cancel</button>
        <button v-if="!presentation.canAdopt && workflow.review.value?.reasonCode === 'download_episode_not_current'" type="button" class="hx-btn"
          :disabled="disabled || workflow.isLoading.value || workflow.isPending.value" @click="openOriginReview">Review earlier download request</button>
        <button v-if="presentation.canAdopt" type="submit" class="hx-btn" data-variant="primary" :disabled="workflow.isLoading.value || workflow.isPending.value || disabled">Use existing downloads</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.hx-download-adoption { margin-block: var(--hx-space-3); }
.hx-download-adoption__feedback:empty { margin: 0; }
.hx-download-adoption__dialog { width: min(100% - (2 * var(--hx-space-4)), 40rem); max-height: calc(100dvh - 2 * var(--hx-space-6)); padding: 0; border: 1px solid var(--hx-border-strong); border-radius: var(--hx-radius-lg); background: var(--hx-bg-surface); color: var(--hx-text); box-shadow: var(--hx-shadow-lg); }
.hx-download-adoption__dialog::backdrop { background: var(--hx-bg-overlay); }
.hx-download-adoption__content { display: grid; gap: var(--hx-space-4); padding: var(--hx-space-6); }
.hx-download-adoption__content h2, .hx-download-adoption__content p { margin: 0; }
.hx-download-adoption__files { display: grid; gap: var(--hx-space-3); max-height: min(45dvh, 22rem); overflow: auto; margin: 0; padding: 0; list-style: none; }
.hx-download-adoption__files li { display: grid; gap: var(--hx-space-1); padding: var(--hx-space-3); border: 1px solid var(--hx-border); border-radius: var(--hx-radius-sm); overflow-wrap: anywhere; }
.hx-download-adoption__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: var(--hx-space-2); }
@media (max-width: 640px) { .hx-download-adoption__actions .hx-btn { min-height: 44px; } }
</style>
