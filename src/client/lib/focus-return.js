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
 * Pure decision logic for dialog focus return.
 *
 * The W3C APG Dialog (Modal) pattern states that when a dialog closes, focus
 * returns to the element that invoked it — *unless* that element no longer
 * exists or can no longer be focused, in which case focus should move to
 * another element that provides a logical work flow. This module isolates that
 * yes/no decision into a DOM-free predicate so it can be unit-tested with the
 * native Node runner, while the component performs the actual `.focus()` call.
 */

/**
 * Decide whether the original invoking element should receive focus when a
 * dialog closes.
 *
 * Returns `false` when the invoker has been disconnected from the document or
 * has become disabled (e.g. an "Add" button that flips to a disabled
 * "Monitored" state after the action completes). In those cases the caller is
 * expected to move focus to a logical fallback instead.
 *
 * @param {object} descriptor
 * @param {boolean} descriptor.invokerConnected
 *   Whether the invoking element is still attached to the document
 *   (`Node.isConnected`).
 * @param {boolean} descriptor.invokerDisabled
 *   Whether the invoking element is currently disabled (native `disabled`
 *   property or `aria-disabled="true"`).
 * @returns {boolean} `true` if focus may be restored to the invoker.
 */
export function shouldRestoreInvokerFocus({ invokerConnected, invokerDisabled } = {}) {
  return invokerConnected === true && invokerDisabled !== true;
}

/**
 * Build the focus-return descriptor from a live DOM element.
 *
 * Kept as a thin adapter so the testable decision (`shouldRestoreInvokerFocus`)
 * stays free of DOM types.
 *
 * @param {Element|null|undefined} element
 * @returns {{ invokerConnected: boolean, invokerDisabled: boolean }}
 */
export function describeInvoker(element) {
  if (!element) {
    return { invokerConnected: false, invokerDisabled: false };
  }
  return {
    invokerConnected: element.isConnected === true,
    invokerDisabled:
      element.disabled === true || element.getAttribute?.('aria-disabled') === 'true',
  };
}
