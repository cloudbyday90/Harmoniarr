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
import { computed } from 'vue';
import ConfirmDialog from './ConfirmDialog.vue';
import { useConfirmHost } from '../composables/useConfirm.js';

/**
 * ConfirmDialogHost — the single mounted host for the imperative confirm
 * service. Mounted once near the app root (AppShell). It renders the shared
 * presentational `ConfirmDialog` and resolves the active `confirm()` promise
 * when the operator accepts or dismisses.
 */
const {
  accept,
  acknowledged,
  activeRequest,
  cancel,
  canConfirm,
  isOpen,
  matches,
  setAcknowledged,
  setTyped,
  typed,
} = useConfirmHost();

const request = computed(() => activeRequest.value);
</script>

<template>
  <ConfirmDialog
    :is-open="isOpen"
    :is-confirming="true"
    :is-executing="false"
    :is-done="false"
    :title="request?.title ?? 'Confirm'"
    :message="request?.message ?? ''"
    :tone="request?.tone ?? 'danger'"
    :confirm-level="request?.level ?? 'none'"
    :confirm-text="request?.confirmText ?? ''"
    :gate-label="request?.gateLabel ?? ''"
    :confirm-label="request?.confirmLabel ?? 'Confirm'"
    :cancel-label="request?.cancelLabel ?? 'Cancel'"
    :acknowledged="acknowledged"
    :typed="typed"
    :matches="matches"
    :can-confirm="canConfirm"
    :button-enabled="canConfirm"
    :error="''"
    @close="cancel"
    @execute="accept"
    @update:typed="setTyped"
    @update:acknowledged="setAcknowledged"
  />
</template>
