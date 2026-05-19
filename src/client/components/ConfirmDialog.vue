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
import { nextTick, watch } from 'vue';
import { CONFIRM_LEVEL } from '../composables/useConfirmDialog.js';

const props = defineProps({
  acknowledged: { type: Boolean, default: false },
  buttonEnabled: { type: Boolean, default: false },
  canConfirm: { type: Boolean, default: false },
  confirmLevel: { type: String, default: CONFIRM_LEVEL.CHECKBOX },
  confirmText: { type: String, default: '' },
  error: { type: String, default: '' },
  gateLabel: { type: String, default: 'I understand this action cannot be undone.' },
  isConfirming: { type: Boolean, default: false },
  isDone: { type: Boolean, default: false },
  isExecuting: { type: Boolean, default: false },
  isOpen: { type: Boolean, default: false },
  matches: { type: Boolean, default: false },
  result: { type: Object, default: null },
  title: { type: String, default: 'Confirm' },
  typed: { type: String, default: '' },
});

const emit = defineEmits([
  'close',
  'execute',
  'update:acknowledged',
  'update:typed',
]);

let dialogRef = null;

function setDialogRef(el) {
  if (el instanceof HTMLDialogElement) {
    dialogRef = el;
  }
}

function onTypedInput(event) {
  emit('update:typed', event.target.value);
}

function onAcknowledgeChange(event) {
  emit('update:acknowledged', event.target.checked);
}

function onPaste(event) {
  event.preventDefault();
}

function onBackdropClick(event) {
  if (event.target === event.currentTarget && !props.isExecuting) {
    emit('close');
  }
}

function onCancel(event) {
  event.preventDefault();
  if (props.isExecuting) return;
  emit('close');
}

watch(() => props.isOpen, async (open) => {
  if (open) {
    await nextTick();
    if (dialogRef) {
      dialogRef.showModal();
      const input = dialogRef.querySelector('.hx-confirm-dialog-type-input');
      if (input) {
        await nextTick();
        input.focus();
      }
    }
  } else if (dialogRef?.open) {
    dialogRef.close();
  }
});
</script>

<template>
  <dialog
    v-if="isOpen"
    ref="setDialogRef"
    class="hx-confirm-dialog"
    role="alertdialog"
    aria-modal="true"
    :aria-labelledby="isConfirming ? 'confirm-heading' : 'confirm-result-heading'"
    @cancel="onCancel"
    @click="onBackdropClick"
  >
    <template v-if="isConfirming">
      <header class="hx-confirm-dialog-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" class="hx-confirm-dialog-icon">
          <circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>
        </svg>
        <h2 id="confirm-heading" class="hx-confirm-dialog-title">{{ title }}</h2>
      </header>

      <div class="hx-confirm-dialog-body">
        <slot name="body">
          <p class="hx-text-muted">{{ gateLabel }}</p>
        </slot>

        <label
          v-if="confirmLevel !== CONFIRM_LEVEL.NONE"
          class="hx-confirm-dialog-check"
        >
          <input
            type="checkbox"
            :checked="acknowledged"
            :disabled="isExecuting"
            @change="onAcknowledgeChange"
          />
          <span>{{ gateLabel }}</span>
        </label>

        <label
          v-if="confirmLevel === CONFIRM_LEVEL.TYPE_TO_CONFIRM"
          class="hx-confirm-dialog-type-field"
        >
          <span class="hx-confirm-dialog-type-hint" v-if="confirmText">
            Type <code class="hx-confirm-dialog-type-code">{{ confirmText }}</code> to confirm:
          </span>
          <input
            :value="typed"
            type="text"
            class="hx-input hx-confirm-dialog-type-input"
            :disabled="isExecuting"
            autocomplete="off"
            spellcheck="false"
            @input="onTypedInput"
            @paste="onPaste"
          />
        </label>

        <div v-if="error" class="hx-confirm-dialog-error" role="alert">
          <p>{{ error }}</p>
        </div>
      </div>

      <footer class="hx-confirm-dialog-footer">
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          :disabled="isExecuting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="hx-btn hx-btn-danger-confirm"
          :class="{ 'is-ready': buttonEnabled }"
          :disabled="!buttonEnabled || isExecuting"
          @click="emit('execute')"
        >
          {{ isExecuting ? 'Running...' : 'Confirm' }}
        </button>
      </footer>
    </template>

    <template v-else-if="isExecuting">
      <div class="hx-confirm-dialog-status">
        <p class="hx-text-muted">Running operation...</p>
      </div>
    </template>

    <template v-else-if="isDone">
      <header class="hx-confirm-dialog-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" class="hx-confirm-dialog-icon hx-confirm-dialog-icon--success">
          <circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-5"/>
        </svg>
        <h2 id="confirm-result-heading" class="hx-confirm-dialog-title">Complete</h2>
      </header>

      <div class="hx-confirm-dialog-body">
        <slot name="result" :result="result">
          <p class="hx-text-muted">Operation completed successfully.</p>
        </slot>
      </div>

      <footer class="hx-confirm-dialog-footer">
        <button
          type="button"
          class="hx-btn"
          data-variant="primary"
          @click="emit('close')"
        >
          Done
        </button>
      </footer>
    </template>
  </dialog>
</template>
