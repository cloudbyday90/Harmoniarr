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

import { nextTick } from 'vue';
import { createMusicQueueReleaseMutationFocusController } from '../lib/music-queue-release-mutation-focus-controller.js';

function focusElement(element) {
  if (!element || typeof element.focus !== 'function' || element.isConnected === false) {
    return false;
  }

  element.focus();
  return true;
}

function resolveFocusTarget(targetOrResolver) {
  return typeof targetOrResolver === 'function'
    ? targetOrResolver()
    : targetOrResolver;
}

function getDocumentActiveElement() {
  return globalThis.document?.activeElement ?? null;
}

function getDocumentBodyElement() {
  return globalThis.document?.body ?? null;
}

/**
 * Preserves keyboard focus through an in-place Music Queue mutation. A
 * retained action keeps focus naturally; a removed focused action recovers to
 * the semantic outcome heading after Vue has rendered the updated inspector.
 */
export function useMusicQueueReleaseMutationFocus({
  activeElementFn = getDocumentActiveElement,
  bodyElementFn = getDocumentBodyElement,
  focusElementFn = focusElement,
  nextTickFn = nextTick,
} = {}) {
  const controller = createMusicQueueReleaseMutationFocusController();

  function startMutation({ trigger, wasFocused = activeElementFn() === trigger } = {}) {
    return controller.startMutation({
      trigger,
      wasFocused,
    });
  }

  async function focusAfterMutation({
    actionResolver,
    mutationId,
    outcomeHeadingResolver,
  } = {}) {
    await nextTickFn();

    const actionTarget = resolveFocusTarget(actionResolver);
    const outcomeTarget = resolveFocusTarget(outcomeHeadingResolver);

    const target = controller.takeFocusTarget({
      actionTarget,
      activeElement: activeElementFn(),
      bodyElement: bodyElementFn(),
      mutationId,
      outcomeTarget,
    });

    return focusElementFn(target);
  }

  return {
    focusAfterMutation,
    startMutation,
  };
}
