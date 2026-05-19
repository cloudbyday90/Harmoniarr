/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';

export const CONFIRM_LEVEL = Object.freeze({
  NONE: 'none',
  CHECKBOX: 'checkbox',
  TYPE_TO_CONFIRM: 'type_to_confirm',
});

export function useConfirmDialog({
  confirmLevel = CONFIRM_LEVEL.CHECKBOX,
  confirmText = '',
  execute = null,
  errorLabel = 'Operation failed',
  gateLabel = 'I understand this action cannot be undone.',
  title = 'Confirm',
} = {}) {
  const stage = ref('closed');
  const typed = ref('');
  const acknowledged = ref(false);
  const error = ref('');
  const result = ref(null);

  const isOpen = computed(() => stage.value !== 'closed');
  const isConfirming = computed(() => stage.value === 'confirming');
  const isExecuting = computed(() => stage.value === 'executing');
  const isDone = computed(() => stage.value === 'done');

  const matches = computed(() => {
    if (confirmLevel !== CONFIRM_LEVEL.TYPE_TO_CONFIRM) return true;
    return typed.value === confirmText;
  });

  const canConfirm = computed(() => {
    if (confirmLevel === CONFIRM_LEVEL.CHECKBOX) return acknowledged.value;
    if (confirmLevel === CONFIRM_LEVEL.TYPE_TO_CONFIRM) return acknowledged.value && matches.value;
    return true;
  });

  const buttonEnabled = computed(() => canConfirm.value);

  function open() {
    error.value = '';
    result.value = null;
    typed.value = '';
    acknowledged.value = false;
    stage.value = 'confirming';
  }

  function close() {
    stage.value = 'closed';
    result.value = null;
    error.value = '';
    typed.value = '';
    acknowledged.value = false;
  }

  async function handleExecute() {
    if (!canConfirm.value || !buttonEnabled.value) return;
    if (!execute) return;

    stage.value = 'executing';
    error.value = '';
    try {
      result.value = await execute();
      stage.value = 'done';
    } catch (err) {
      error.value = getErrorMessage(err, errorLabel);
      stage.value = 'confirming';
    }
  }

  return {
    acknowledged,
    buttonEnabled,
    canConfirm,
    close,
    confirmLevel,
    confirmText,
    error,
    execute: execute ? handleExecute : null,
    gateLabel,
    handleExecute,
    isConfirming,
    isDone,
    isExecuting,
    isOpen,
    matches,
    open,
    result,
    stage,
    title,
    typed,
  };
}
