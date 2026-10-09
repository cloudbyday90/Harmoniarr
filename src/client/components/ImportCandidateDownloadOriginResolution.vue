<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0-or-later.
  See LICENSE for details.
-->
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useImportCandidateDownloadOriginResolution } from '../composables/useImportCandidateDownloadOriginResolution.js';
import { buildImportCandidateDownloadOriginPresentation } from '../lib/import-candidate-download-origin-presentation.js';
import { trapModalTabFocus } from '../lib/modal-focus-trap.js';
import { createUserCommandFocusTracker } from '../lib/user-command-focus.js';

const props = defineProps({ operationRunId: { required: true, type: String }, importCandidateId: { required: true, type: String },
  disabled: { default: false, type: Boolean }, completeResolution: { default: null, type: Function } });
const emit = defineEmits(['pending-change']);
const dialog = ref(null); const invoker = ref(null); const feedback = ref(null); let disposed = false; let pendingIdentity = null;
const interactionBusy = ref(false);
const workflow = useImportCandidateDownloadOriginResolution({ operationRunId: () => props.operationRunId, importCandidateId: () => props.importCandidateId });
const facts = computed(() => buildImportCandidateDownloadOriginPresentation(workflow.review.value));
const titleId = computed(() => `download-origin-title-${props.operationRunId}-${props.importCandidateId}`);
const currentIdentity = () => `origin-resolution/${props.operationRunId}/${props.importCandidateId}`;
function closeReview() { dialog.value?.close(); }
function restoreDialogReturn() {
  if (!disposed && globalThis.document.activeElement === globalThis.document.body && invoker.value?.isConnected && !invoker.value.disabled) invoker.value.focus();
}
async function openReview({ returnTarget } = {}) {
  if (disposed || props.disabled || interactionBusy.value || workflow.isPending.value || dialog.value?.open) return;
  invoker.value = returnTarget ?? globalThis.document.activeElement; dialog.value?.showModal(); await workflow.loadReview();
}
async function confirm() {
  if (props.disabled || interactionBusy.value || workflow.isPending.value || workflow.isLoading.value || !facts.value.canRestore) return;
  const identity = currentIdentity(); const focus = createUserCommandFocusTracker({ document: globalThis.document, returnTarget: invoker.value });
  interactionBusy.value = true;
  const promise = workflow.restore(); closeReview();
  try {
    const result = await promise;
    if (disposed || identity !== currentIdentity()) return;
    if (!result) { interactionBusy.value = false; await nextTick(); focus.restoreAfterFailure(); return; }
    await nextTick();
    if (props.completeResolution) await props.completeResolution({ action: result.downloadOriginResolution, focus });
    else if (focus.ownsFocus()) feedback.value?.focus();
  } finally { if (identity === currentIdentity()) interactionBusy.value = false; focus.dispose(); }
}
watch(() => interactionBusy.value || workflow.isPending.value, (pending) => {
  if (pending) pendingIdentity = currentIdentity();
  emit('pending-change', { key: pendingIdentity ?? currentIdentity(), pending }); if (!pending) pendingIdentity = null;
}, { flush: 'sync' });
watch(currentIdentity, () => { closeReview(); interactionBusy.value = false; }, { flush: 'sync' });
onBeforeUnmount(() => { disposed = true; closeReview(); workflow.destroy(); emit('pending-change', { key: pendingIdentity ?? currentIdentity(), pending: false }); });
defineExpose({ openReview, hasUncertainIntent: workflow.hasUncertainIntent });
</script>

<template>
  <div class="hx-download-origin-feedback">
    <p ref="feedback" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">{{ workflow.statusMessage.value }}</p>
    <p v-if="workflow.errorMessage.value && !dialog?.open" class="hx-alert" data-tone="danger" role="alert">{{ workflow.errorMessage.value }}</p>
  </div>
  <dialog ref="dialog" class="hx-download-origin-dialog" :aria-labelledby="titleId" @keydown="trapModalTabFocus" @close="restoreDialogReturn">
    <form method="dialog" class="hx-download-origin-content" @submit.prevent="confirm">
      <h2 :id="titleId">Continue verified downloads?</h2>
      <p role="status" aria-live="polite" aria-atomic="true">{{ workflow.isLoading.value ? 'Checking the earlier downloads and the unused newer request…' : facts.explanation }}</p>
      <p v-if="workflow.errorMessage.value" class="hx-alert" data-tone="danger" role="alert">{{ workflow.errorMessage.value }}</p>
      <p v-if="workflow.hasUncertainIntent.value">The saved choice may already have been accepted. Try the same choice again to check its result.</p>
      <div :aria-busy="workflow.isLoading.value ? 'true' : undefined">
        <dl v-if="facts.canRestore" class="hx-download-origin-facts">
          <div><dt>Verified files</dt><dd>{{ facts.verifiedFileCount }}</dd></div>
          <div><dt>Unused newer request</dt><dd>{{ facts.retiredRequestCount }}</dd></div>
        </dl>
        <p v-if="facts.canRestore">{{ facts.confirmation }}</p>
      </div>
      <div class="hx-download-origin-actions">
        <button type="button" class="hx-btn" autofocus @click="closeReview">Cancel</button>
        <button v-if="facts.canRestore" type="submit" class="hx-btn" data-variant="primary" :disabled="workflow.isLoading.value || workflow.isPending.value || disabled">Continue verified downloads</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.hx-download-origin-feedback p:empty { margin: 0; }
.hx-download-origin-dialog { width: min(100% - (2 * var(--hx-space-4)), 40rem); max-height: calc(100dvh - 2 * var(--hx-space-6)); padding: 0; border: 1px solid var(--hx-border-strong); border-radius: var(--hx-radius-lg); background: var(--hx-bg-surface); color: var(--hx-text); box-shadow: var(--hx-shadow-lg); }
.hx-download-origin-dialog::backdrop { background: var(--hx-bg-overlay); }
.hx-download-origin-content { display: grid; gap: var(--hx-space-4); padding: var(--hx-space-6); }
.hx-download-origin-content h2, .hx-download-origin-content p { margin: 0; }
.hx-download-origin-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--hx-space-3); margin: 0 0 var(--hx-space-4); }
.hx-download-origin-facts div { padding: var(--hx-space-3); border: 1px solid var(--hx-border); border-radius: var(--hx-radius-sm); }
.hx-download-origin-facts dd { margin: var(--hx-space-1) 0 0; font-weight: 700; }
.hx-download-origin-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: var(--hx-space-2); }
@media (max-width: 640px) { .hx-download-origin-actions .hx-btn { min-height: 44px; } }
</style>
