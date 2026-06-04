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

/**
 * Pure helpers that define the single feedback (toast) convention shared by the
 * whole client. Kept framework-agnostic so the rules can be unit-tested without
 * mounting Vue. `useToast` composes these; `ToastStack.vue` consumes the role
 * mapping.
 *
 * Convention:
 *  - Severity drives persistence: errors stay until dismissed; success / info /
 *    warning auto-dismiss. This removes the long-standing drift where the design
 *    promised persistent errors but the implementation auto-dismissed them.
 *  - Severity drives the live-region role (W3C ARIA APG): error/warning use
 *    `role="alert"` (implicit assertive — interrupts the user), success/info use
 *    `role="status"` (implicit polite). This ensures errors are actually
 *    announced promptly by assistive technology.
 *  - Identical (tone + message) toasts are de-duplicated so bursts of the same
 *    feedback do not stack up.
 */

/** Default auto-dismiss duration, in ms, for non-error toasts. */
export const DEFAULT_TOAST_DURATION_MS = 4000;

/** A duration of 0 means "persist until dismissed". */
export const PERSIST_TOAST_DURATION_MS = 0;

/**
 * Resolve the auto-dismiss duration for a toast. An explicit numeric override
 * always wins; otherwise errors persist and everything else auto-dismisses.
 *
 * @param {'success'|'error'|'info'|'warning'} tone
 * @param {number} [explicitDurationMs] Caller override (must be a finite number).
 * @returns {number} Duration in ms; 0 means persist until dismissed.
 */
export function resolveToastDuration(tone, explicitDurationMs) {
  if (typeof explicitDurationMs === 'number' && Number.isFinite(explicitDurationMs)) {
    return Math.max(0, explicitDurationMs);
  }
  return tone === 'error' ? PERSIST_TOAST_DURATION_MS : DEFAULT_TOAST_DURATION_MS;
}

/**
 * Map a toast tone to the appropriate ARIA live-region role.
 *
 * @param {'success'|'error'|'info'|'warning'} tone
 * @returns {'alert'|'status'} `alert` (assertive) for error/warning, else `status`.
 */
export function resolveToastRole(tone) {
  return tone === 'error' || tone === 'warning' ? 'alert' : 'status';
}

/**
 * Determine whether a tone+message pair already exists in the active toast list.
 * Used to suppress duplicate feedback.
 *
 * @param {Array<{tone: string, message: string}>} toasts
 * @param {string} tone
 * @param {string} message
 * @returns {boolean}
 */
export function isDuplicateToast(toasts, tone, message) {
  if (!Array.isArray(toasts)) {
    return false;
  }
  return toasts.some((toast) => toast.tone === tone && toast.message === message);
}
