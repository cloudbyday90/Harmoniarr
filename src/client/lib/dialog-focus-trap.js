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
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isFocusableElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function getFocusableDialogElements(container) {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(isFocusableElement);
}

export function containDialogTabFocus(event, container) {
  if (event.key !== 'Tab' || !container) {
    return;
  }

  const focusableElements = getFocusableDialogElements(container);
  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus?.({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = container.ownerDocument.activeElement;

  if (!container.contains(activeElement)) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
    return;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus({ preventScroll: true });
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}
