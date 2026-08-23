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
import { createMusicQueueReleaseFocusController } from '../lib/music-queue-release-focus-controller.js';

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

/**
 * Coordinates focus around Music Queue's conditional, non-modal release
 * inspector. It deliberately waits for Vue's next render before focusing a
 * target, so removed controls never retain the browser's focus.
 */
export function useMusicQueueReleaseFocus({
  focusElementFn = focusElement,
  nextTickFn = nextTick,
} = {}) {
  const controller = createMusicQueueReleaseFocusController();

  async function focusFirstAvailableAfterRender(candidates = []) {
    await nextTickFn();

    for (const candidate of candidates) {
      if (focusElementFn(resolveFocusTarget(candidate))) {
        return true;
      }
    }

    return false;
  }

  async function focusAfterRender(targetOrResolver) {
    return focusFirstAvailableAfterRender([targetOrResolver]);
  }

  async function focusDirectInspectorHeading({
    headingResolver,
    isLoading = false,
    isReady = false,
    releaseId,
  } = {}) {
    await nextTickFn();
    let heading = headingResolver?.();

    // A conditional panel heading may still refer to the element Vue is
    // replacing during the first render tick. Resolve once more before
    // recording direct-route focus so a disconnected heading cannot consume
    // the one intentional focus move for this route.
    if (heading?.isConnected === false) {
      await nextTickFn();
      heading = headingResolver?.();
    }

    if (!heading || heading.isConnected === false || !controller.shouldFocusDirectInspectorHeading({
      isLoading,
      isReady,
      releaseId,
    })) {
      return false;
    }

    return focusElementFn(heading);
  }

  return {
    focusAfterRender,
    focusDirectInspectorHeading,
    focusFirstAvailableAfterRender,
    getSelection: controller.getSelection,
    selectFromRow: controller.selectFromRow,
    shouldFocusDirectInspectorHeading: controller.shouldFocusDirectInspectorHeading,
    synchronizeRouteSelection: controller.synchronizeRouteSelection,
    takeCloseFocusTargets: controller.takeCloseFocusTargets,
  };
}
