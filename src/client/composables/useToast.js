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

import { readonly, ref } from 'vue';

/**
 * Lightweight modular toast system.
 *
 * One shared reactive store is created at module scope so that all callers of
 * `useToast()` operate on the same queue. `ToastStack.vue` reads from this
 * store and renders the visible stack.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Artist monitored.');
 *   toast.error('Could not submit request.');
 *   toast.info('Searching…');
 *   toast.dismiss(id);
 */

const DEFAULT_DURATION_MS = 4000;

/** @type {import('vue').Ref<Array<{id: string, tone: string, message: string, durationMs: number}>>} */
const toasts = ref([]);

let _nextId = 1;

function generateId() {
  return `toast-${_nextId++}`;
}

/**
 * Add a toast to the stack and schedule auto-dismiss.
 *
 * @param {'success'|'error'|'info'|'warning'} tone
 * @param {string} message
 * @param {{ durationMs?: number }} [options]
 * @returns {string} toast id
 */
function push(tone, message, { durationMs = DEFAULT_DURATION_MS } = {}) {
  const id = generateId();
  toasts.value.push({ id, tone, message, durationMs });
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

/**
 * Remove a toast by id.
 * @param {string} id
 */
function dismiss(id) {
  const idx = toasts.value.findIndex((t) => t.id === id);
  if (idx !== -1) {
    toasts.value.splice(idx, 1);
  }
}

/**
 * Composable that exposes toast helpers.
 * Callers share the same reactive store.
 */
export function useToast() {
  return {
    /** Reactive list of active toasts (read-only for consumers). */
    toasts: readonly(toasts),

    /** Show a success toast. */
    success: (message, options) => push('success', message, options),

    /** Show an error toast. */
    error: (message, options) => push('error', message, options),

    /** Show an info toast. */
    info: (message, options) => push('info', message, options),

    /** Show a warning toast. */
    warning: (message, options) => push('warning', message, options),

    /** Manually dismiss a toast by id. */
    dismiss,
  };
}
