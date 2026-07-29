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
import {
  buildImportCandidateRecoveryPresentation,
  buildImportCandidateSecondaryActions,
} from '../lib/import-candidate-recovery-presentation.js';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps({
  actionError: { type: String, default: '' },
  actionStatus: { type: String, default: '' },
  candidate: { type: Object, default: null },
  canManageCandidates: { type: Boolean, default: false },
  detailError: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  isTransitionPending: { type: Boolean, default: false },
  preview: { type: Object, default: null },
});

const emit = defineEmits(['hold', 'reject', 'reopen', 'select']);
const actionStatusRef = ref(null);
const primaryActionRef = ref(null);
const rejectConfirmOpen = ref(false);
const rejectAcknowledged = ref(false);

const recovery = computed(() => buildImportCandidateRecoveryPresentation({
  candidate: props.candidate,
  canManageCandidates: props.canManageCandidates,
  preview: props.preview,
}));
const secondaryActions = computed(() => props.canManageCandidates
  ? buildImportCandidateSecondaryActions(props.candidate, recovery.value.action?.id)
  : []);

function emitAction(actionId) {
  if (actionId === 'reject') {
    rejectAcknowledged.value = false;
    rejectConfirmOpen.value = true;
    return;
  }

  emit(actionId);
}

function confirmReject() {
  rejectConfirmOpen.value = false;
  emit('reject');
}

watch(
  () => props.actionStatus,
  async (nextStatus) => {
    if (!nextStatus) return;
    await nextTick();
    actionStatusRef.value?.focus();
  },
);

watch(
  () => props.actionError,
  async (nextError) => {
    if (!nextError) return;
    await nextTick();
    primaryActionRef.value?.focus();
  },
);
</script>

<template>
  <article class="import-candidate-recovery" :data-tone="recovery.tone">
    <template v-if="detailError">
      <p class="import-candidate-recovery__eyebrow">Match unavailable</p>
      <h3>Could not load this match</h3>
      <p class="import-candidate-recovery__copy" role="alert">{{ detailError }}</p>
    </template>

    <template v-else-if="isLoading && !candidate">
      <p class="import-candidate-recovery__eyebrow">Current recovery</p>
      <h3>Loading match state</h3>
      <p class="import-candidate-recovery__copy">Checking the current automated state and available repair.</p>
    </template>

    <template v-else>
      <div class="import-candidate-recovery__header">
        <div>
          <p class="import-candidate-recovery__eyebrow">Current recovery</p>
          <h3>{{ recovery.title }}</h3>
        </div>
        <span class="hx-pill" :data-tone="recovery.tone">{{ recovery.label }}</span>
      </div>

      <p class="import-candidate-recovery__copy">{{ recovery.description }}</p>

      <button
        v-if="recovery.action"
        ref="primaryActionRef"
        class="hx-btn"
        data-variant="primary"
        type="button"
        :disabled="isTransitionPending"
        @click="emitAction(recovery.action.id)"
      >
        {{ isTransitionPending ? 'Saving...' : recovery.action.label }}
      </button>

      <p
        v-if="actionStatus"
        ref="actionStatusRef"
        class="import-candidate-recovery__status"
        role="status"
        aria-live="polite"
        tabindex="-1"
      >{{ actionStatus }}</p>
      <p v-if="actionError" class="import-candidate-recovery__error" role="alert">{{ actionError }}</p>

      <details v-if="secondaryActions.length" class="import-candidate-recovery__more">
        <summary>Other match actions</summary>
        <div class="import-candidate-recovery__secondary-actions">
          <button
            v-for="action in secondaryActions"
            :key="action.id"
            class="hx-btn"
            :data-variant="action.tone === 'danger' ? 'danger' : 'ghost'"
            type="button"
            :disabled="isTransitionPending"
            @click="emitAction(action.id)"
          >{{ action.label }}</button>
        </div>
      </details>
    </template>
  </article>

  <ConfirmDialog
    :is-open="rejectConfirmOpen"
    :is-confirming="true"
    :is-executing="false"
    :is-done="false"
    title="Do not use this match?"
    confirm-level="checkbox"
    confirm-text=""
    gate-label="I understand this match will be removed from review and must be found again before it can be used."
    typed=""
    :acknowledged="rejectAcknowledged"
    :matches="true"
    :can-confirm="rejectAcknowledged"
    :button-enabled="rejectAcknowledged"
    error=""
    @close="rejectConfirmOpen = false"
    @execute="confirmReject"
    @update:typed="() => {}"
    @update:acknowledged="rejectAcknowledged = $event"
  />
</template>

<style scoped>
.import-candidate-recovery {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-4);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface);
  box-shadow: var(--hx-shadow-sm);
}

.import-candidate-recovery[data-tone='warning'] {
  border-color: color-mix(in srgb, var(--hx-warning) 46%, var(--hx-border));
}

.import-candidate-recovery[data-tone='danger'] {
  border-color: color-mix(in srgb, var(--hx-danger) 46%, var(--hx-border));
}

.import-candidate-recovery[data-tone='success'] {
  border-color: color-mix(in srgb, var(--hx-success) 46%, var(--hx-border));
}

.import-candidate-recovery__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.import-candidate-recovery__eyebrow {
  margin: 0 0 var(--hx-space-1);
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.import-candidate-recovery h3 {
  margin: 0;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-xl);
}

.import-candidate-recovery__copy,
.import-candidate-recovery__status,
.import-candidate-recovery__error {
  max-width: 72ch;
  margin: 0;
  color: var(--hx-text-muted);
  line-height: 1.55;
}

.import-candidate-recovery__error {
  color: var(--hx-danger);
}

.import-candidate-recovery__status:focus-visible,
.import-candidate-recovery button:focus-visible,
.import-candidate-recovery summary:focus-visible {
  border-radius: var(--hx-radius-xs);
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

.import-candidate-recovery__more {
  padding-top: var(--hx-space-3);
  border-top: 1px solid var(--hx-border-subtle);
}

.import-candidate-recovery__more summary {
  width: fit-content;
  color: var(--hx-text-muted);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 700;
}

.import-candidate-recovery__secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  margin-top: var(--hx-space-3);
}

@media (max-width: 640px) {
  .import-candidate-recovery__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
