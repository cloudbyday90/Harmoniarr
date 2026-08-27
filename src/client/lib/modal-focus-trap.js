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

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Resolves the focusable index that must receive focus to keep Tab navigation
 * inside a modal. A null result means the browser can perform the ordinary
 * next or previous focus movement itself.
 */
export function getModalFocusWrapIndex({
  activeIndex = -1,
  focusableCount = 0,
  isShiftTab = false,
} = {}) {
  if (focusableCount < 1) return null;
  if (activeIndex < 0) return isShiftTab ? focusableCount - 1 : 0;
  if (isShiftTab && activeIndex === 0) return focusableCount - 1;
  if (!isShiftTab && activeIndex === focusableCount - 1) return 0;
  return null;
}

function getFocusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    element.getAttribute('aria-hidden') !== 'true'
    && element.tabIndex >= 0
  ));
}

/**
 * Adds only the missing Tab wrap behavior to a native modal dialog. The
 * platform still owns opening, Escape dismissal, backdrop inertness, and
 * normal focus return to the invoker.
 */
export function trapModalTabFocus(event, dialog = event?.currentTarget) {
  if (event?.key !== 'Tab' || !dialog?.open) return false;

  const focusableElements = getFocusableElements(dialog);
  const activeIndex = focusableElements.indexOf(dialog.ownerDocument.activeElement);
  const nextIndex = getModalFocusWrapIndex({
    activeIndex,
    focusableCount: focusableElements.length,
    isShiftTab: event.shiftKey,
  });
  if (nextIndex === null) return false;

  event.preventDefault();
  focusableElements[nextIndex]?.focus();
  return true;
}
