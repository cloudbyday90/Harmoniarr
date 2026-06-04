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

import { computed, readonly, ref } from 'vue';
import { normalizeConfirmRequest, resolveConfirmGate } from '../lib/confirm-intent.js';

/**
 * Imperative, promise-based confirmation service.
 *
 * One shared reactive store is created at module scope (mirroring `useToast`)
 * so every caller of `useConfirm()` drives the single `ConfirmDialogHost`
 * mounted near the app root. Call sites await a boolean instead of wiring
 * props/v-model:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Cancel request?', message: '…', confirmLabel: 'Cancel request' }))) {
 *     return;
 *   }
 *   await doDestructiveThing();
 *
 * The host (`ConfirmDialogHost.vue`) consumes the host-facing bindings exposed
 * by `useConfirmHost()` to render and resolve the active request.
 */

/** @type {import('vue').Ref<import('../lib/confirm-intent.js').ConfirmRequest | null>} */
const activeRequest = ref(null);

/** Resolver for the in-flight confirmation promise (null when idle). */
let activeResolver = null;

/** Operator-entered "type to confirm" text for the active request. */
const typed = ref('');

/** Whether the operator ticked the acknowledgement checkbox. */
const acknowledged = ref(false);

const isOpen = computed(() => activeRequest.value !== null);

const gate = computed(() =>
  resolveConfirmGate({
    acknowledged: acknowledged.value,
    confirmText: activeRequest.value?.confirmText ?? '',
    level: activeRequest.value?.level ?? 'none',
    typed: typed.value,
  }),
);

/** Settle the active request with a boolean and reset transient input state. */
function settle(result) {
  const resolver = activeResolver;
  activeResolver = null;
  activeRequest.value = null;
  typed.value = '';
  acknowledged.value = false;
  if (resolver) resolver(result);
}

/**
 * Open the confirmation dialog and resolve once the operator decides.
 *
 * If a confirmation is already in flight it is auto-cancelled (resolved
 * `false`) before the new one opens, so a stray second prompt can never strand
 * an unresolved promise.
 *
 * @param {object} [options] See `normalizeConfirmRequest` for accepted fields.
 * @returns {Promise<boolean>} Resolves `true` when confirmed, `false` otherwise.
 */
function confirm(options = {}) {
  if (activeResolver) {
    settle(false);
  }
  activeRequest.value = normalizeConfirmRequest(options);
  typed.value = '';
  acknowledged.value = false;
  return new Promise((resolve) => {
    activeResolver = resolve;
  });
}

/** Confirm the active request (no-op when the gate is not satisfied). */
function accept() {
  if (!activeRequest.value || !gate.value.canConfirm) return;
  settle(true);
}

/** Dismiss the active request (resolves `false`). */
function cancel() {
  if (!activeRequest.value) return;
  settle(false);
}

/**
 * Composable for call sites: returns the `confirm()` function directly so it
 * reads naturally at the call site (`const confirm = useConfirm()`).
 *
 * @returns {(options?: object) => Promise<boolean>}
 */
export function useConfirm() {
  return confirm;
}

/**
 * Host-facing bindings consumed by `ConfirmDialogHost.vue`. Not intended for
 * general call sites.
 */
export function useConfirmHost() {
  return {
    accept,
    acknowledged,
    activeRequest: readonly(activeRequest),
    cancel,
    canConfirm: computed(() => gate.value.canConfirm),
    isOpen,
    matches: computed(() => gate.value.matches),
    setAcknowledged: (value) => {
      acknowledged.value = value === true;
    },
    setTyped: (value) => {
      typed.value = typeof value === 'string' ? value : '';
    },
    typed: readonly(typed),
  };
}
