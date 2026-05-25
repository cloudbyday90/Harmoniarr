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

import { NavigationFailureType, isNavigationFailure } from 'vue-router';

function isAtResolvedLocation(router, resolvedTarget) {
  const currentRoute = router.currentRoute?.value;
  if (!currentRoute) {
    return false;
  }

  return currentRoute.fullPath === resolvedTarget.fullPath
    || currentRoute.path === resolvedTarget.path;
}

function performDocumentNavigation(windowObject, href) {
  if (typeof windowObject?.location?.replace === 'function') {
    windowObject.location.replace(href);
    return;
  }

  if (typeof windowObject?.location?.assign === 'function') {
    windowObject.location.assign(href);
    return;
  }

  throw new Error(`Could not document-navigate to ${href}.`);
}

export async function navigateAfterAuthSuccess({
  router,
  target,
  windowObject = globalThis.window,
} = {}) {
  const resolvedTarget = router.resolve(target);
  let navigationResult;

  try {
    navigationResult = await router.replace(target);
  } catch (error) {
    navigationResult = error;
  }

  if (isAtResolvedLocation(router, resolvedTarget)) {
    return {
      navigationResult,
      usedDocumentNavigation: false,
    };
  }

  if (
    navigationResult
    && !isNavigationFailure(
      navigationResult,
      NavigationFailureType.aborted
      | NavigationFailureType.cancelled
      | NavigationFailureType.duplicated,
    )
    && typeof windowObject?.location?.replace !== 'function'
    && typeof windowObject?.location?.assign !== 'function'
  ) {
    throw navigationResult;
  }

  performDocumentNavigation(windowObject, resolvedTarget.href);

  return {
    navigationResult,
    usedDocumentNavigation: true,
  };
}
